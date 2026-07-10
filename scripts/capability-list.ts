/// <reference types="node" />

/* eslint-disable no-console -- This command writes its projection and status to stdout. */

import 'reflect-metadata';

import type {
  CapabilityId,
  CapabilityAnchor,
  CapabilityProcess,
  CapabilityRuntimeContribution,
} from '@app-types/common/capability.types';
import { MODULE_METADATA } from '@nestjs/common/constants';
import type { DynamicModule, Provider, Type } from '@nestjs/common';
import { ApiModule } from '@src/bootstraps/api/api.module';
import { WorkerModule } from '@src/bootstraps/worker/worker.module';
import {
  CAPABILITY_HEALTH_CHECK_METADATA_KEY,
  CAPABILITY_OPERATION_HANDLER_METADATA_KEY,
  CAPABILITY_ANCHOR_METADATA_KEY,
  CAPABILITY_PROVIDER_BINDING_METADATA_KEY,
  CAPABILITY_QUEUE_BINDING_METADATA_KEY,
  CAPABILITY_RUNTIME_CONTRIBUTION_METADATA_KEY,
  CAPABILITY_SESSION_AUTHORITY_SCOPE_AUTHORIZER_METADATA_KEY,
  CAPABILITY_SESSION_AUTHORITY_SUMMARY_RESOLVER_METADATA_KEY,
  CAPABILITY_SESSION_IDENTITY_RESOLVER_METADATA_KEY,
  type CapabilityHealthCheckMetadata,
  type CapabilityOperationHandlerMetadata,
  type CapabilityProviderBindingMetadata,
  type CapabilityQueueBindingMetadata,
  type CapabilitySessionAuthorityScopeAuthorizerMetadata,
  type CapabilitySessionAuthoritySummaryResolverMetadata,
  type CapabilitySessionIdentityResolverMetadata,
} from '@src/infrastructure/capability/capability.decorators';
import {
  validateCapabilityProcessTopology,
  type CapabilityProcessTopology,
} from '@src/infrastructure/capability/capability-topology.validator';
import { promises as fs } from 'node:fs';
import path from 'node:path';

type Command = 'list' | 'docs' | 'check';

interface ProviderObservation {
  readonly process: CapabilityProcess;
  readonly moduleName: string;
  readonly providerType: Type<unknown>;
}

export interface CapabilityViewEntry {
  readonly anchor: CapabilityAnchor;
  readonly entryModule: string;
  readonly installedProcesses: readonly CapabilityProcess[];
  readonly runtimeContribution: CapabilityRuntimeContribution | null;
  readonly runtimeProcesses: readonly CapabilityProcess[];
}

const PROJECT_ROOT = process.cwd();
const GENERATED_DOC_PATH = path.join(PROJECT_ROOT, 'docs/generated/capabilities-current.md');
const CAPABILITY_ID_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/;
const PROCESS_ORDER: readonly CapabilityProcess[] = ['api', 'worker'];

async function main(): Promise<void> {
  const command = parseCommand(process.argv.slice(2));
  const entries = await collectCapabilityView();
  const markdown = renderMarkdown(entries);

  if (command === 'list') {
    console.log(renderTable(entries));
    return;
  }
  if (command === 'docs') {
    await fs.mkdir(path.dirname(GENERATED_DOC_PATH), { recursive: true });
    await fs.writeFile(GENERATED_DOC_PATH, markdown, 'utf8');
    console.log(`Wrote ${toProjectPath(GENERATED_DOC_PATH)}`);
    return;
  }
  await assertGeneratedFileMatches(markdown);
}

function parseCommand(argv: readonly string[]): Command {
  const args = argv.filter((arg) => arg !== '--');
  if (args.length === 0) {
    return 'list';
  }
  if (args.length === 1 && (args[0] === 'list' || args[0] === 'docs' || args[0] === 'check')) {
    return args[0];
  }
  throw new Error('Usage: capability-list.ts [list|docs|check]');
}

export async function collectCapabilityView(): Promise<readonly CapabilityViewEntry[]> {
  const [apiObservations, workerObservations] = await Promise.all([
    collectProviderObservations({ process: 'api', rootModule: ApiModule }),
    collectProviderObservations({ process: 'worker', rootModule: WorkerModule }),
  ]);
  const observations = [...apiObservations, ...workerObservations];
  const anchorsById = collectAnchors(observations);
  const runtimeById = collectRuntimeContributions(observations);

  const issues = await validateAnchors(anchorsById);
  const topologyIssues = PROCESS_ORDER.flatMap((process) =>
    validateCapabilityProcessTopology(buildProcessTopology({ process, observations })).filter(
      (issue) => issue.severity !== 'warning',
    ),
  );
  const allIssues = [...issues, ...topologyIssues.map((issue) => issue.message)];
  if (allIssues.length > 0) {
    throw new Error(`Capability governance validation failed\n- ${allIssues.join('\n- ')}`);
  }

  return [...anchorsById.entries()]
    .map(([capabilityId, item]) => {
      const runtime = runtimeById.get(capabilityId);
      return {
        anchor: item.anchor,
        entryModule: [...item.modules][0] ?? '',
        installedProcesses: sortProcesses(item.processes),
        runtimeContribution: runtime?.contribution ?? null,
        runtimeProcesses: sortProcesses(runtime?.processes ?? new Set()),
      };
    })
    .sort((left, right) => left.anchor.capabilityId.localeCompare(right.anchor.capabilityId));
}

async function collectProviderObservations(input: {
  readonly process: CapabilityProcess;
  readonly rootModule: Type<unknown>;
}): Promise<readonly ProviderObservation[]> {
  const observations: ProviderObservation[] = [];
  const visitedModuleTypes = new Set<Type<unknown>>();
  const visitedDynamicModules = new Set<DynamicModule>();

  const observeProviders = (moduleType: Type<unknown>, providers: readonly Provider[]): void => {
    for (const provider of providers) {
      const providerType = readProviderType(provider);
      if (!providerType) {
        continue;
      }
      observations.push({
        process: input.process,
        moduleName: moduleType.name,
        providerType,
      });
    }
  };

  const visitModuleType = async (moduleType: Type<unknown>): Promise<void> => {
    if (visitedModuleTypes.has(moduleType)) {
      return;
    }
    visitedModuleTypes.add(moduleType);
    observeProviders(
      moduleType,
      readModuleMetadata<readonly Provider[]>(moduleType, MODULE_METADATA.PROVIDERS) ?? [],
    );
    for (const imported of readModuleMetadata<readonly unknown[]>(
      moduleType,
      MODULE_METADATA.IMPORTS,
    ) ?? []) {
      await visitModuleDefinition(imported);
    }
  };

  const visitDynamicModule = async (dynamicModule: DynamicModule): Promise<void> => {
    if (visitedDynamicModules.has(dynamicModule)) {
      return;
    }
    visitedDynamicModules.add(dynamicModule);
    await visitModuleType(dynamicModule.module);
    observeProviders(dynamicModule.module, dynamicModule.providers ?? []);
    for (const imported of dynamicModule.imports ?? []) {
      await visitModuleDefinition(imported);
    }
  };

  const visitModuleDefinition = async (definition: unknown): Promise<void> => {
    const forwardResolved = unwrapForwardReference(definition);
    const resolved = isPromiseLike(forwardResolved) ? await forwardResolved : forwardResolved;
    if (isDynamicModule(resolved)) {
      await visitDynamicModule(resolved);
      return;
    }
    if (typeof resolved === 'function') {
      await visitModuleType(resolved as Type<unknown>);
      return;
    }
    if (resolved !== null && resolved !== undefined) {
      throw new Error(`Unsupported Nest module definition in ${input.rootModule.name}`);
    }
  };

  await visitModuleType(input.rootModule);
  return dedupeProviderObservations(observations);
}

function collectAnchors(observations: readonly ProviderObservation[]): Map<
  CapabilityId,
  {
    readonly anchor: CapabilityAnchor;
    readonly modules: Set<string>;
    readonly processes: Set<CapabilityProcess>;
  }
> {
  const anchorsById = new Map<
    CapabilityId,
    {
      readonly anchor: CapabilityAnchor;
      readonly modules: Set<string>;
      readonly processes: Set<CapabilityProcess>;
    }
  >();
  for (const observation of observations) {
    const anchor = Reflect.getMetadata(CAPABILITY_ANCHOR_METADATA_KEY, observation.providerType) as
      CapabilityAnchor | undefined;
    if (!anchor) {
      continue;
    }
    const current = anchorsById.get(anchor.capabilityId);
    if (!current) {
      anchorsById.set(anchor.capabilityId, {
        anchor,
        modules: new Set([observation.moduleName]),
        processes: new Set([observation.process]),
      });
      continue;
    }
    if (!metadataEquals(current.anchor, anchor)) {
      throw new Error(`Conflicting capability anchors: ${anchor.capabilityId}`);
    }
    current.modules.add(observation.moduleName);
    current.processes.add(observation.process);
  }
  return anchorsById;
}

function collectRuntimeContributions(observations: readonly ProviderObservation[]): Map<
  CapabilityId,
  {
    readonly contribution: CapabilityRuntimeContribution;
    readonly processes: Set<CapabilityProcess>;
  }
> {
  const runtimeById = new Map<
    CapabilityId,
    {
      readonly contribution: CapabilityRuntimeContribution;
      readonly processes: Set<CapabilityProcess>;
    }
  >();
  for (const observation of observations) {
    const contribution = Reflect.getMetadata(
      CAPABILITY_RUNTIME_CONTRIBUTION_METADATA_KEY,
      observation.providerType,
    ) as CapabilityRuntimeContribution | undefined;
    if (!contribution) {
      continue;
    }
    const current = runtimeById.get(contribution.capabilityId);
    if (!current) {
      runtimeById.set(contribution.capabilityId, {
        contribution,
        processes: new Set([observation.process]),
      });
      continue;
    }
    if (!metadataEquals(current.contribution, contribution)) {
      throw new Error(`Conflicting capability runtime contributions: ${contribution.capabilityId}`);
    }
    current.processes.add(observation.process);
  }
  return runtimeById;
}

function buildProcessTopology(input: {
  readonly process: CapabilityProcess;
  readonly observations: readonly ProviderObservation[];
}): CapabilityProcessTopology {
  const observations = input.observations.filter(
    (observation) => observation.process === input.process,
  );
  return {
    process: input.process,
    anchors: collectProviderMetadata<CapabilityAnchor>(
      observations,
      CAPABILITY_ANCHOR_METADATA_KEY,
    ),
    runtimeContributions: collectProviderMetadata<CapabilityRuntimeContribution>(
      observations,
      CAPABILITY_RUNTIME_CONTRIBUTION_METADATA_KEY,
    ),
    providerBindings: collectProviderMetadata<CapabilityProviderBindingMetadata>(
      observations,
      CAPABILITY_PROVIDER_BINDING_METADATA_KEY,
    ),
    queueBindings: collectProviderMetadata<CapabilityQueueBindingMetadata>(
      observations,
      CAPABILITY_QUEUE_BINDING_METADATA_KEY,
    ),
    healthChecks: collectProviderMetadata<CapabilityHealthCheckMetadata>(
      observations,
      CAPABILITY_HEALTH_CHECK_METADATA_KEY,
    ),
    operationHandlers: collectProviderMetadata<CapabilityOperationHandlerMetadata>(
      observations,
      CAPABILITY_OPERATION_HANDLER_METADATA_KEY,
    ),
    sessionIdentityResolvers: collectProviderMetadata<CapabilitySessionIdentityResolverMetadata>(
      observations,
      CAPABILITY_SESSION_IDENTITY_RESOLVER_METADATA_KEY,
    ),
    sessionAuthoritySummaryResolvers:
      collectProviderMetadata<CapabilitySessionAuthoritySummaryResolverMetadata>(
        observations,
        CAPABILITY_SESSION_AUTHORITY_SUMMARY_RESOLVER_METADATA_KEY,
      ),
    sessionAuthorityScopeAuthorizers:
      collectProviderMetadata<CapabilitySessionAuthorityScopeAuthorizerMetadata>(
        observations,
        CAPABILITY_SESSION_AUTHORITY_SCOPE_AUTHORIZER_METADATA_KEY,
      ),
  };
}

function collectProviderMetadata<T>(
  observations: readonly ProviderObservation[],
  metadataKey: string,
): readonly T[] {
  return observations.flatMap((observation) => {
    const metadata = Reflect.getMetadata(metadataKey, observation.providerType) as T | undefined;
    return metadata === undefined ? [] : [metadata];
  });
}

async function validateAnchors(
  anchorsById: ReadonlyMap<
    CapabilityId,
    {
      readonly anchor: CapabilityAnchor;
      readonly modules: ReadonlySet<string>;
    }
  >,
): Promise<readonly string[]> {
  const decisionDocuments = new Map<string, string>();
  const issues: string[] = [];
  for (const [capabilityId, item] of anchorsById) {
    if (!CAPABILITY_ID_PATTERN.test(capabilityId)) {
      issues.push(`capability_anchor_id_invalid:${capabilityId}`);
    }
    if (item.modules.size !== 1) {
      issues.push(
        `capability_anchor_entry_module_ambiguous:${capabilityId}:${[...item.modules].sort().join(',')}`,
      );
    }
    issues.push(
      ...(await validateCapabilityDecisionRef({
        capabilityId,
        decisionRef: item.anchor.decisionRef,
        decisionDocuments,
      })),
    );
  }
  return issues;
}

export async function validateCapabilityDecisionRef(input: {
  readonly capabilityId: CapabilityId;
  readonly decisionRef: string;
  readonly decisionDocuments?: Map<string, string>;
}): Promise<readonly string[]> {
  const decisionRef = normalizeProjectPath(input.decisionRef.trim());
  if (!isCapabilityDecisionPath(decisionRef)) {
    return [`capability_decision_ref_invalid:${input.capabilityId}:${input.decisionRef}`];
  }

  const decisionDocuments = input.decisionDocuments ?? new Map<string, string>();
  let content = decisionDocuments.get(decisionRef);
  if (content === undefined) {
    try {
      content = await fs.readFile(path.resolve(PROJECT_ROOT, decisionRef), 'utf8');
      decisionDocuments.set(decisionRef, content);
    } catch {
      return [`capability_decision_ref_missing:${input.capabilityId}:${decisionRef}`];
    }
  }

  const capabilityHeading = new RegExp('^## `' + escapeRegExp(input.capabilityId) + '`\\s*$', 'm');
  return capabilityHeading.test(content)
    ? []
    : [`capability_decision_ref_capability_missing:${input.capabilityId}:${decisionRef}`];
}

function isCapabilityDecisionPath(value: string): boolean {
  return (
    value.startsWith('docs/capabilities/') &&
    value.endsWith('.md') &&
    !value.split('/').includes('..') &&
    !path.isAbsolute(value)
  );
}

function renderTable(entries: readonly CapabilityViewEntry[]): string {
  const rows = [
    ['ID', 'Mode', 'Default', 'Entry module', 'Installed', 'Runtime', 'Resources', 'Decision'],
    ...entries.map((entry) => [
      entry.anchor.capabilityId,
      entry.anchor.mode,
      resolveDefaultState(entry),
      entry.entryModule,
      entry.installedProcesses.join(',') || '-',
      entry.runtimeProcesses.join(',') || '-',
      summarizeRuntimeResources(entry.runtimeContribution),
      entry.anchor.decisionRef,
    ]),
  ];
  const widths = rows[0].map((_, index) =>
    Math.max(...rows.map((row) => (row[index] ?? '').length)),
  );
  return rows
    .map((row) =>
      row
        .map((cell, index) => cell.padEnd(widths[index] ?? 0))
        .join('  ')
        .trimEnd(),
    )
    .join('\n');
}

function renderMarkdown(entries: readonly CapabilityViewEntry[]): string {
  const lines = [
    '<!-- generated by npm run capability:docs; do not edit manually -->',
    '',
    '# Current Capabilities',
    '',
    'This shallow projection is derived from the Nest API and Worker module graphs. Entry Module is a navigation seed, not a file-level ownership claim. Semantic decisions live at Decision Ref.',
    '',
    '| ID | Mode | Default State | Entry Module | Installed Processes | Runtime Processes | Runtime Resources | Decision Ref |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...entries.map((entry) =>
      markdownRow([
        entry.anchor.capabilityId,
        entry.anchor.mode,
        resolveDefaultState(entry),
        entry.entryModule,
        entry.installedProcesses.join(', ') || '-',
        entry.runtimeProcesses.join(', ') || '-',
        summarizeRuntimeResources(entry.runtimeContribution),
        markdownDecisionLink(entry.anchor.decisionRef),
      ]),
    ),
    '',
    'Validation: anchor IDs and decision references are valid; runtime contributions and bindings are complete in each installed process; required runtime dependencies form no cycle.',
    '',
  ];
  return lines.join('\n');
}

async function assertGeneratedFileMatches(output: string): Promise<void> {
  const current = await fs.readFile(GENERATED_DOC_PATH, 'utf8');
  if (current !== output) {
    throw new Error(`Generated capability docs are stale: ${toProjectPath(GENERATED_DOC_PATH)}`);
  }
  console.log(`Generated capability docs are current: ${toProjectPath(GENERATED_DOC_PATH)}`);
}

function readModuleMetadata<T>(moduleType: Type<unknown>, key: string): T | undefined {
  return Reflect.getMetadata(key, moduleType) as T | undefined;
}

function readProviderType(provider: Provider): Type<unknown> | null {
  if (typeof provider === 'function') return provider as Type<unknown>;
  if ('useClass' in provider && provider.useClass) return provider.useClass as Type<unknown>;
  return null;
}

function unwrapForwardReference(value: unknown): unknown {
  if (hasForwardReference(value)) {
    return value.forwardRef();
  }
  return value;
}

function hasForwardReference(value: unknown): value is { readonly forwardRef: () => unknown } {
  if (!value || typeof value !== 'object' || !('forwardRef' in value)) {
    return false;
  }
  return typeof value.forwardRef === 'function';
}

function isDynamicModule(value: unknown): value is DynamicModule {
  return Boolean(value && typeof value === 'object' && 'module' in value);
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return Boolean(
    value && typeof value === 'object' && 'then' in value && typeof value.then === 'function',
  );
}

function dedupeProviderObservations(
  observations: readonly ProviderObservation[],
): readonly ProviderObservation[] {
  const seen = new Map<Type<unknown>, Set<string>>();
  return observations.filter((observation) => {
    const key = `${observation.process}:${observation.moduleName}`;
    const providerKeys = seen.get(observation.providerType) ?? new Set<string>();
    if (providerKeys.has(key)) return false;
    providerKeys.add(key);
    seen.set(observation.providerType, providerKeys);
    return true;
  });
}

function metadataEquals(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sortProcesses(processes: ReadonlySet<CapabilityProcess>): readonly CapabilityProcess[] {
  return PROCESS_ORDER.filter((process) => processes.has(process));
}

function resolveDefaultState(entry: CapabilityViewEntry): 'enabled' | 'disabled' {
  if (entry.anchor.mode === 'always-on') {
    return 'enabled';
  }
  return entry.runtimeContribution?.runtime?.defaultState ?? 'enabled';
}

function summarizeRuntimeResources(contribution: CapabilityRuntimeContribution | null): string {
  if (!contribution) {
    return '-';
  }
  const resources = [
    ...summarizeRuntimeDependencyResources(contribution),
    ...summarizeProviderResources(contribution),
    ...summarizeQueueResources(contribution),
    ...summarizeOperationResources(contribution),
    ...summarizeApiResources(contribution),
    ...summarizeSessionResources(contribution),
    ...summarizeHealthResources(contribution),
  ];
  return resources.join('; ') || '-';
}

function summarizeRuntimeDependencyResources(
  contribution: CapabilityRuntimeContribution,
): readonly string[] {
  return (contribution.runtimeDependencies ?? []).map(
    (dependency) => `dependency:${dependency.mode}:${dependency.capabilityId}`,
  );
}

function summarizeProviderResources(
  contribution: CapabilityRuntimeContribution,
): readonly string[] {
  return (contribution.contributions?.providers ?? []).map(
    (provider) => `provider:${provider.providerKind}:${provider.providerName}`,
  );
}

function summarizeQueueResources(contribution: CapabilityRuntimeContribution): readonly string[] {
  return (contribution.contributions?.queues ?? []).map(
    (queue) =>
      `queue:${queue.operationKind}:${queue.operation}->${queue.queueName}/${queue.jobName}`,
  );
}

function summarizeOperationResources(
  contribution: CapabilityRuntimeContribution,
): readonly string[] {
  return [
    ...(contribution.operations?.commands ?? []).map(
      (operation) => `operation:command:${operation.name}`,
    ),
    ...(contribution.operations?.queries ?? []).map(
      (operation) => `operation:query:${operation.name}`,
    ),
    ...(contribution.operations?.events ?? []).map(
      (operation) => `operation:event:${operation.name}`,
    ),
  ];
}

function summarizeApiResources(contribution: CapabilityRuntimeContribution): readonly string[] {
  const graphqlOperationCount = contribution.contributions?.api?.graphqlOperations?.length ?? 0;
  return graphqlOperationCount > 0 ? [`api:${graphqlOperationCount}`] : [];
}

function summarizeSessionResources(contribution: CapabilityRuntimeContribution): readonly string[] {
  const principalCount = contribution.contributions?.session?.principals?.length ?? 0;
  const authorityClaimCount = contribution.contributions?.session?.authorityClaims?.length ?? 0;
  return principalCount > 0 || authorityClaimCount > 0
    ? [`session:${principalCount}/${authorityClaimCount}`]
    : [];
}

function summarizeHealthResources(contribution: CapabilityRuntimeContribution): readonly string[] {
  return contribution.runtime?.healthCheck ? ['health'] : [];
}

function markdownDecisionLink(decisionRef: string): string {
  const relativePath = path
    .relative(path.dirname(GENERATED_DOC_PATH), path.resolve(PROJECT_ROOT, decisionRef))
    .replaceAll(path.sep, '/');
  return `[${decisionRef}](${relativePath})`;
}

function normalizeProjectPath(value: string): string {
  return value.replaceAll('\\', '/').replace(/\/$/, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function markdownRow(cells: readonly string[]): string {
  return `| ${cells.map(escapeMarkdownCell).join(' | ')} |`;
}

function escapeMarkdownCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function toProjectPath(filePath: string): string {
  return path.relative(PROJECT_ROOT, filePath).replaceAll(path.sep, '/');
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
