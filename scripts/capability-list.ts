/// <reference types="node" />

/* eslint-disable no-console -- This command writes its projection and status to stdout. */

import 'reflect-metadata';

import type {
  CapabilityId,
  CapabilityOwnershipManifest,
  CapabilityProcess,
  CapabilityRuntimeManifest,
} from '@app-types/common/capability.types';
import { MODULE_METADATA } from '@nestjs/common/constants';
import type { DynamicModule, Provider, Type } from '@nestjs/common';
import { ApiModule } from '@src/bootstraps/api/api.module';
import { WorkerModule } from '@src/bootstraps/worker/worker.module';
import {
  CAPABILITY_HEALTH_CHECK_METADATA_KEY,
  CAPABILITY_OPERATION_HANDLER_METADATA_KEY,
  CAPABILITY_OWNERSHIP_METADATA_KEY,
  CAPABILITY_PROVIDER_BINDING_METADATA_KEY,
  CAPABILITY_QUEUE_BINDING_METADATA_KEY,
  CAPABILITY_RUNTIME_MANIFEST_METADATA_KEY,
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
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';

type Command = 'list' | 'docs' | 'check';

interface ProviderObservation {
  readonly process: CapabilityProcess;
  readonly moduleName: string;
  readonly providerType: Type<unknown>;
}

export interface CapabilityViewEntry {
  readonly ownership: CapabilityOwnershipManifest;
  readonly declarationModules: readonly string[];
  readonly runtimeManifest: CapabilityRuntimeManifest | null;
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
  const ownershipById = collectOwnership(observations);
  const runtimeById = collectRuntime(observations);

  const issues = validateOwnershipView(ownershipById);
  const topologyIssues = PROCESS_ORDER.flatMap((process) =>
    validateCapabilityProcessTopology(buildProcessTopology({ process, observations })).filter(
      (issue) => issue.severity !== 'warning',
    ),
  );
  const allIssues = [...issues, ...topologyIssues.map((issue) => issue.message)];
  if (allIssues.length > 0) {
    throw new Error(`Capability governance validation failed\n- ${allIssues.join('\n- ')}`);
  }

  return [...ownershipById.entries()]
    .map(([capabilityId, ownership]) => {
      const runtime = runtimeById.get(capabilityId);
      return {
        ownership: ownership.manifest,
        declarationModules: [...ownership.modules].sort(),
        runtimeManifest: runtime?.manifest ?? null,
        runtimeProcesses: sortProcesses(runtime?.processes ?? new Set()),
      };
    })
    .sort((left, right) => left.ownership.capabilityId.localeCompare(right.ownership.capabilityId));
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

function collectOwnership(
  observations: readonly ProviderObservation[],
): Map<
  CapabilityId,
  { readonly manifest: CapabilityOwnershipManifest; readonly modules: Set<string> }
> {
  const ownershipById = new Map<
    CapabilityId,
    { readonly manifest: CapabilityOwnershipManifest; readonly modules: Set<string> }
  >();
  for (const observation of observations) {
    const manifest = Reflect.getMetadata(
      CAPABILITY_OWNERSHIP_METADATA_KEY,
      observation.providerType,
    ) as CapabilityOwnershipManifest | undefined;
    if (!manifest) {
      continue;
    }
    const current = ownershipById.get(manifest.capabilityId);
    if (!current) {
      ownershipById.set(manifest.capabilityId, {
        manifest,
        modules: new Set([observation.moduleName]),
      });
      continue;
    }
    if (!metadataEquals(current.manifest, manifest)) {
      throw new Error(`Conflicting capability ownership declarations: ${manifest.capabilityId}`);
    }
    current.modules.add(observation.moduleName);
  }
  return ownershipById;
}

function collectRuntime(
  observations: readonly ProviderObservation[],
): Map<
  CapabilityId,
  { readonly manifest: CapabilityRuntimeManifest; readonly processes: Set<CapabilityProcess> }
> {
  const runtimeById = new Map<
    CapabilityId,
    { readonly manifest: CapabilityRuntimeManifest; readonly processes: Set<CapabilityProcess> }
  >();
  for (const observation of observations) {
    const manifest = Reflect.getMetadata(
      CAPABILITY_RUNTIME_MANIFEST_METADATA_KEY,
      observation.providerType,
    ) as CapabilityRuntimeManifest | undefined;
    if (!manifest) {
      continue;
    }
    const current = runtimeById.get(manifest.capabilityId);
    if (!current) {
      runtimeById.set(manifest.capabilityId, {
        manifest,
        processes: new Set([observation.process]),
      });
      continue;
    }
    if (!metadataEquals(current.manifest, manifest)) {
      throw new Error(`Conflicting capability runtime manifests: ${manifest.capabilityId}`);
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
    ownerships: collectProviderMetadata<CapabilityOwnershipManifest>(
      observations,
      CAPABILITY_OWNERSHIP_METADATA_KEY,
    ),
    runtimeManifests: collectProviderMetadata<CapabilityRuntimeManifest>(
      observations,
      CAPABILITY_RUNTIME_MANIFEST_METADATA_KEY,
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

function validateOwnershipView(
  ownershipById: ReadonlyMap<CapabilityId, { readonly manifest: CapabilityOwnershipManifest }>,
): readonly string[] {
  const issues = [...ownershipById.entries()].flatMap(([capabilityId, item]) =>
    validateOwnershipManifest({ capabilityId, manifest: item.manifest, ownershipById }),
  );
  const primaryScopes = [...ownershipById.entries()].flatMap(([capabilityId, item]) =>
    item.manifest.physicalScopes
      .filter((scope) => scope.role === 'primary')
      .map((scope) => ({ capabilityId, path: scope.path })),
  );
  return [...issues, ...validatePrimaryScopeOverlaps(primaryScopes)];
}

function validateOwnershipManifest(input: {
  readonly capabilityId: CapabilityId;
  readonly manifest: CapabilityOwnershipManifest;
  readonly ownershipById: ReadonlyMap<
    CapabilityId,
    { readonly manifest: CapabilityOwnershipManifest }
  >;
}): readonly string[] {
  return [
    ...validateOwnershipSummary(input.capabilityId, input.manifest),
    ...validateOwnershipDependencies(input.capabilityId, input.manifest, input.ownershipById),
    ...validateOwnershipScopes(input.capabilityId, input.manifest),
    ...validateOwnershipPublicSurfaces(input.capabilityId, input.manifest),
    ...validateOwnershipEntrypoints(input.capabilityId, input.manifest),
  ];
}

function validateOwnershipSummary(
  capabilityId: CapabilityId,
  manifest: CapabilityOwnershipManifest,
): readonly string[] {
  const issues: string[] = [];
  if (!CAPABILITY_ID_PATTERN.test(capabilityId)) {
    issues.push(`invalid_ownership_id:${capabilityId}`);
  }
  if (
    !manifest.semanticScope.trim() ||
    !hasNonBlankItems(manifest.owns) ||
    !hasNonBlankItems(manifest.nonGoals) ||
    manifest.physicalScopes.length === 0 ||
    manifest.publicSurfaces.length === 0 ||
    manifest.validationEntrypoints.length === 0
  ) {
    issues.push(`incomplete_ownership:${capabilityId}`);
  }
  if (manifest.kind === 'platform' && manifest.foundationClassification !== 'platform-foundation') {
    issues.push(`invalid_foundation_classification:${capabilityId}`);
  }
  return issues;
}

function validateOwnershipDependencies(
  capabilityId: CapabilityId,
  manifest: CapabilityOwnershipManifest,
  ownershipById: ReadonlyMap<CapabilityId, unknown>,
): readonly string[] {
  return manifest.allowedDependencies.flatMap((dependency) =>
    dependency === capabilityId || !ownershipById.has(dependency)
      ? [`ownership_dependency_invalid:${capabilityId}:${dependency}`]
      : [],
  );
}

function validateOwnershipScopes(
  capabilityId: CapabilityId,
  manifest: CapabilityOwnershipManifest,
): readonly string[] {
  const issues: string[] = [];
  for (const scope of manifest.physicalScopes) {
    if (!isValidProjectPath(scope.path) || !existsSync(path.resolve(PROJECT_ROOT, scope.path))) {
      issues.push(`ownership_scope_missing:${capabilityId}:${scope.path}`);
    }
    if (scope.role !== 'primary' && !scope.reason?.trim()) {
      issues.push(`ownership_scope_reason_missing:${capabilityId}:${scope.path}`);
    }
  }
  if (!manifest.physicalScopes.some((scope) => scope.role === 'primary')) {
    issues.push(`ownership_primary_scope_missing:${capabilityId}`);
  }
  return issues;
}

function validateOwnershipPublicSurfaces(
  capabilityId: CapabilityId,
  manifest: CapabilityOwnershipManifest,
): readonly string[] {
  const issues: string[] = [];
  for (const surface of manifest.publicSurfaces) {
    if (surface.status !== 'present') {
      if (!surface.reason.trim()) {
        issues.push(`ownership_public_surface_reason_missing:${capabilityId}:${surface.status}`);
      }
      continue;
    }
    const isInsideScope = manifest.physicalScopes.some((scope) =>
      containsPath(scope.path, surface.path),
    );
    if (
      !isValidProjectPath(surface.path) ||
      !existsSync(path.resolve(PROJECT_ROOT, surface.path)) ||
      !isInsideScope
    ) {
      issues.push(`ownership_public_surface_invalid:${capabilityId}:${surface.path}`);
    }
  }
  return issues;
}

function validateOwnershipEntrypoints(
  capabilityId: CapabilityId,
  manifest: CapabilityOwnershipManifest,
): readonly string[] {
  return manifest.validationEntrypoints.flatMap((entrypoint) =>
    !isValidProjectPath(entrypoint) || !existsSync(path.resolve(PROJECT_ROOT, entrypoint))
      ? [`ownership_validation_entrypoint_missing:${capabilityId}:${entrypoint}`]
      : [],
  );
}

function validatePrimaryScopeOverlaps(
  primaryScopes: readonly { readonly capabilityId: CapabilityId; readonly path: string }[],
): readonly string[] {
  const issues: string[] = [];
  for (let leftIndex = 0; leftIndex < primaryScopes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < primaryScopes.length; rightIndex += 1) {
      const left = primaryScopes[leftIndex];
      const right = primaryScopes[rightIndex];
      if (
        left &&
        right &&
        left.capabilityId !== right.capabilityId &&
        pathsOverlap(left.path, right.path)
      ) {
        issues.push(
          `ownership_primary_scope_overlap:${left.capabilityId}:${right.capabilityId}:${left.path}:${right.path}`,
        );
      }
    }
  }
  return issues;
}

function renderTable(entries: readonly CapabilityViewEntry[]): string {
  const rows = [
    ['ID', 'Kind', 'Semantic scope', 'Primary scope', 'Runtime'],
    ...entries.map((entry) => [
      entry.ownership.capabilityId,
      entry.ownership.kind,
      entry.ownership.semanticScope,
      summarizePrimaryScopeForTable(entry.ownership),
      entry.runtimeProcesses.length > 0 ? entry.runtimeProcesses.join(',') : '-',
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
    'This document joins Nest ownership metadata with runtime manifests observed from the API and Worker module graphs.',
    '',
    '## Ownership Summary',
    '',
    '| ID | Kind | Semantic Scope | Owns | Non-goals | Physical Scopes | Public Surfaces | Allowed Dependencies | Foundation | Runtime | Declaration Modules |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...entries.map((entry) =>
      markdownRow([
        entry.ownership.capabilityId,
        entry.ownership.kind,
        entry.ownership.semanticScope,
        entry.ownership.owns.join('; '),
        entry.ownership.nonGoals.join('; '),
        summarizePhysicalScopes(entry.ownership),
        summarizePublicSurfaces(entry.ownership),
        entry.ownership.allowedDependencies.join(', ') || '-',
        entry.ownership.foundationClassification,
        entry.runtimeProcesses.join(', ') || '-',
        entry.declarationModules.join(', '),
      ]),
    ),
    '',
    '## Runtime Projection',
    '',
    '| ID | Processes | Dependencies | Providers | Queues | Operations |',
    '| --- | --- | --- | --- | --- | --- |',
    ...entries
      .filter((entry) => entry.runtimeManifest !== null)
      .map((entry) =>
        markdownRow([
          entry.ownership.capabilityId,
          entry.runtimeProcesses.join(', '),
          summarizeDependencies(entry.runtimeManifest),
          summarizeProviders(entry.runtimeManifest),
          summarizeQueues(entry.runtimeManifest),
          summarizeOperations(entry.runtimeManifest),
        ]),
      ),
    '',
    'Validation: ownership scopes and surfaces resolve; allowed dependencies exist; every runtime manifest and contribution is complete in its process; required runtime dependencies form no cycle.',
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

function summarizeDependencies(manifest: CapabilityRuntimeManifest | null): string {
  return (
    manifest?.runtimeDependencies
      ?.map((dependency) => `${dependency.mode}:${dependency.capabilityId}`)
      .join('; ') || '-'
  );
}

function summarizeProviders(manifest: CapabilityRuntimeManifest | null): string {
  return (
    manifest?.contributions?.providers
      ?.map((provider) => `${provider.providerKind}:${provider.providerName}`)
      .join('; ') || '-'
  );
}

function summarizeQueues(manifest: CapabilityRuntimeManifest | null): string {
  return (
    manifest?.contributions?.queues
      ?.map(
        (queue) => `${queue.operationKind}:${queue.operation}->${queue.queueName}/${queue.jobName}`,
      )
      .join('; ') || '-'
  );
}

function summarizeOperations(manifest: CapabilityRuntimeManifest | null): string {
  if (!manifest?.operations) return '-';
  return [
    ...(manifest.operations.commands ?? []).map((operation) => `command:${operation.name}`),
    ...(manifest.operations.queries ?? []).map((operation) => `query:${operation.name}`),
    ...(manifest.operations.events ?? []).map((operation) => `event:${operation.name}`),
  ].join('; ');
}

function summarizePhysicalScopes(manifest: CapabilityOwnershipManifest): string {
  return manifest.physicalScopes.map((scope) => `${scope.role}:${scope.path}`).join('; ');
}

function summarizePrimaryScopeForTable(manifest: CapabilityOwnershipManifest): string {
  const scopes = manifest.physicalScopes.filter((scope) => scope.role === 'primary');
  const first = scopes[0]?.path ?? '-';
  return scopes.length > 1 ? `${first} (+${scopes.length - 1})` : first;
}

function summarizePublicSurfaces(manifest: CapabilityOwnershipManifest): string {
  return manifest.publicSurfaces
    .map((surface) =>
      surface.status === 'present'
        ? `present:${surface.path}`
        : `${surface.status}:${surface.reason}`,
    )
    .join('; ');
}

function hasNonBlankItems(values: readonly string[]): boolean {
  return values.length > 0 && values.every((value) => value.trim().length > 0);
}

function isValidProjectPath(value: string): boolean {
  const normalized = value.replaceAll('\\', '/').trim();
  return (
    (normalized.startsWith('src/') || normalized.startsWith('test/')) &&
    !normalized.includes('../') &&
    !path.isAbsolute(normalized)
  );
}

function containsPath(scopePath: string, candidatePath: string): boolean {
  const scope = normalizeProjectPath(scopePath);
  const candidate = normalizeProjectPath(candidatePath);
  return candidate === scope || candidate.startsWith(`${scope}/`);
}

function pathsOverlap(leftPath: string, rightPath: string): boolean {
  return containsPath(leftPath, rightPath) || containsPath(rightPath, leftPath);
}

function normalizeProjectPath(value: string): string {
  return value.replaceAll('\\', '/').replace(/\/$/, '');
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
