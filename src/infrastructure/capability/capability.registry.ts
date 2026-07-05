// src/infrastructure/capability/capability.registry.ts
import type {
  CapabilityId,
  CapabilityManifest,
  CapabilityProcess,
} from '@app-types/common/capability.types';
import { Inject, Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { BULLMQ_JOB_PAYLOAD_VALIDATORS } from '@src/infrastructure/bullmq/contracts/job-contract.registry';
import { BULLMQ_QUEUE_REGISTRY } from '@src/infrastructure/bullmq/queue-registry';
import {
  CAPABILITY_MANIFEST_DISCOVERABLE,
  CAPABILITY_MANIFEST_METADATA_KEY,
  CAPABILITY_PROVIDER_BINDING_DISCOVERABLE,
  CAPABILITY_PROVIDER_BINDING_METADATA_KEY,
  CAPABILITY_QUEUE_BINDING_DISCOVERABLE,
  CAPABILITY_QUEUE_BINDING_METADATA_KEY,
  type CapabilityProviderBindingMetadata,
  type CapabilityQueueBindingMetadata,
} from './capability.decorators';

export const CAPABILITY_PROCESS = Symbol('CAPABILITY_PROCESS');

export interface CapabilityProviderBinding {
  readonly metadata: CapabilityProviderBindingMetadata;
  readonly instance: unknown;
}

export interface CapabilityBootstrapIssue {
  readonly code:
    | 'CAPABILITY_ID_INVALID'
    | 'CAPABILITY_ID_DUPLICATE'
    | 'CAPABILITY_PROCESS_MISMATCH'
    | 'CAPABILITY_DEPENDENCY_MISSING'
    | 'CAPABILITY_DEPENDENCY_CYCLE'
    | 'CAPABILITY_PROVIDER_BINDING_MISSING'
    | 'CAPABILITY_QUEUE_BINDING_MISSING'
    | 'CAPABILITY_QUEUE_NOT_REGISTERED'
    | 'CAPABILITY_JOB_NOT_REGISTERED';
  readonly message: string;
  readonly capabilityId?: CapabilityId;
}

export interface CapabilityBootstrapValidationResult {
  readonly process: CapabilityProcess;
  readonly issues: readonly CapabilityBootstrapIssue[];
}

interface CapabilitySnapshot {
  readonly manifests: readonly CapabilityManifest[];
  readonly providerBindings: readonly CapabilityProviderBinding[];
  readonly queueBindings: readonly CapabilityQueueBindingMetadata[];
}

@Injectable()
export class CapabilityRegistry {
  private snapshot: CapabilitySnapshot | null = null;

  constructor(
    @Inject(CAPABILITY_PROCESS)
    private readonly currentProcess: CapabilityProcess,
    private readonly discoveryService: DiscoveryService,
  ) {}

  getActiveManifests(): readonly CapabilityManifest[] {
    return this.resolveSnapshot().manifests;
  }

  getProviderClient<TClient>(input: {
    readonly providerKind: string;
    readonly providerName: string;
  }): TClient | null {
    const normalizedProviderName = normalizeRequiredText(input.providerName);
    const normalizedProviderKind = normalizeRequiredText(input.providerKind);
    const binding = this.resolveSnapshot().providerBindings.find(
      (item) =>
        normalizeRequiredText(item.metadata.providerName) === normalizedProviderName &&
        normalizeRequiredText(item.metadata.providerKind) === normalizedProviderKind,
    );
    return binding ? (binding.instance as TClient) : null;
  }

  validateBootstrap(): CapabilityBootstrapValidationResult {
    const snapshot = this.resolveSnapshot();
    const issues = [
      ...validateManifestIds(snapshot.manifests),
      ...validateDependencies(snapshot.manifests),
      ...validateProviderContributions({
        manifests: snapshot.manifests,
        providerBindings: snapshot.providerBindings,
      }),
      ...validateQueueContributions({
        manifests: snapshot.manifests,
        queueBindings: snapshot.queueBindings,
      }),
      ...validateQueueRuntime(snapshot.queueBindings),
    ];
    return { process: this.currentProcess, issues };
  }

  assertBootstrapValid(): void {
    const result = this.validateBootstrap();
    if (result.issues.length > 0) {
      throw new CapabilityBootstrapError(result);
    }
  }

  private resolveSnapshot(): CapabilitySnapshot {
    if (!this.snapshot) {
      const manifests = this.discoverManifests();
      this.snapshot = {
        manifests,
        providerBindings: this.discoverProviderBindings(manifests),
        queueBindings: this.discoverQueueBindings(manifests),
      };
    }
    return this.snapshot;
  }

  private discoverManifests(): readonly CapabilityManifest[] {
    return this.discoveryService
      .getProviders({ metadataKey: CAPABILITY_MANIFEST_METADATA_KEY })
      .map((wrapper) =>
        this.discoveryService.getMetadataByDecorator(CAPABILITY_MANIFEST_DISCOVERABLE, wrapper),
      )
      .filter((manifest): manifest is CapabilityManifest =>
        Boolean(manifest && manifest.processes.includes(this.currentProcess)),
      );
  }

  private discoverProviderBindings(
    activeManifests: readonly CapabilityManifest[],
  ): readonly CapabilityProviderBinding[] {
    const activeCapabilityIds = new Set(activeManifests.map((manifest) => manifest.id));
    return this.discoveryService
      .getProviders({ metadataKey: CAPABILITY_PROVIDER_BINDING_METADATA_KEY })
      .map((wrapper): CapabilityProviderBinding | null => {
        const metadata = this.discoveryService.getMetadataByDecorator(
          CAPABILITY_PROVIDER_BINDING_DISCOVERABLE,
          wrapper,
        );
        if (!metadata || !activeCapabilityIds.has(metadata.capabilityId)) {
          return null;
        }
        if (wrapper.instance === null || wrapper.instance === undefined) {
          return null;
        }
        return { metadata, instance: wrapper.instance };
      })
      .filter((binding): binding is CapabilityProviderBinding => binding !== null);
  }

  private discoverQueueBindings(
    activeManifests: readonly CapabilityManifest[],
  ): readonly CapabilityQueueBindingMetadata[] {
    const activeCapabilityIds = new Set(activeManifests.map((manifest) => manifest.id));
    return this.discoveryService
      .getProviders({ metadataKey: CAPABILITY_QUEUE_BINDING_METADATA_KEY })
      .map((wrapper) =>
        this.discoveryService.getMetadataByDecorator(
          CAPABILITY_QUEUE_BINDING_DISCOVERABLE,
          wrapper,
        ),
      )
      .filter((metadata): metadata is CapabilityQueueBindingMetadata =>
        Boolean(metadata && activeCapabilityIds.has(metadata.capabilityId)),
      );
  }
}

export class CapabilityBootstrapError extends Error {
  constructor(readonly result: CapabilityBootstrapValidationResult) {
    super(formatBootstrapIssues(result));
    this.name = 'CapabilityBootstrapError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function validateManifestIds(
  manifests: readonly CapabilityManifest[],
): readonly CapabilityBootstrapIssue[] {
  const issues: CapabilityBootstrapIssue[] = [];
  const seen = new Set<CapabilityId>();
  for (const manifest of manifests) {
    if (!isValidCapabilityId(manifest.id)) {
      issues.push({
        code: 'CAPABILITY_ID_INVALID',
        capabilityId: manifest.id,
        message: `invalid_capability_id:${manifest.id}`,
      });
    }
    if (seen.has(manifest.id)) {
      issues.push({
        code: 'CAPABILITY_ID_DUPLICATE',
        capabilityId: manifest.id,
        message: `duplicate_capability_id:${manifest.id}`,
      });
    }
    seen.add(manifest.id);
    if (manifest.processes.length === 0) {
      issues.push({
        code: 'CAPABILITY_PROCESS_MISMATCH',
        capabilityId: manifest.id,
        message: `capability_processes_empty:${manifest.id}`,
      });
    }
  }
  return issues;
}

function validateDependencies(
  manifests: readonly CapabilityManifest[],
): readonly CapabilityBootstrapIssue[] {
  const capabilityIds = new Set(manifests.map((manifest) => manifest.id));
  const issues: CapabilityBootstrapIssue[] = [];
  for (const manifest of manifests) {
    for (const dependency of manifest.dependsOn ?? []) {
      if (dependency.mode === 'required' && !capabilityIds.has(dependency.capabilityId)) {
        issues.push({
          code: 'CAPABILITY_DEPENDENCY_MISSING',
          capabilityId: manifest.id,
          message: `capability_dependency_missing:${manifest.id}:${dependency.capabilityId}`,
        });
      }
    }
  }
  issues.push(...detectDependencyCycles(manifests));
  return issues;
}

function validateProviderContributions(input: {
  readonly manifests: readonly CapabilityManifest[];
  readonly providerBindings: readonly CapabilityProviderBinding[];
}): readonly CapabilityBootstrapIssue[] {
  const bindingKeys = new Set(
    input.providerBindings.map((binding) =>
      buildProviderBindingKey({
        capabilityId: binding.metadata.capabilityId,
        providerKind: binding.metadata.providerKind,
        providerName: binding.metadata.providerName,
      }),
    ),
  );
  const issues: CapabilityBootstrapIssue[] = [];
  for (const manifest of input.manifests) {
    for (const contribution of manifest.contributions?.providers ?? []) {
      const key = buildProviderBindingKey({
        capabilityId: manifest.id,
        providerKind: contribution.providerKind,
        providerName: contribution.providerName,
      });
      if (!bindingKeys.has(key)) {
        issues.push({
          code: 'CAPABILITY_PROVIDER_BINDING_MISSING',
          capabilityId: manifest.id,
          message: `capability_provider_binding_missing:${manifest.id}:${contribution.providerKind}:${contribution.providerName}`,
        });
      }
    }
  }
  return issues;
}

function validateQueueContributions(input: {
  readonly manifests: readonly CapabilityManifest[];
  readonly queueBindings: readonly CapabilityQueueBindingMetadata[];
}): readonly CapabilityBootstrapIssue[] {
  const bindingKeys = new Set(
    input.queueBindings.map((binding) =>
      buildQueueBindingKey({
        capabilityId: binding.capabilityId,
        operation: binding.operation,
        operationKind: binding.operationKind,
        queueName: binding.queueName,
        jobName: binding.jobName,
      }),
    ),
  );
  const issues: CapabilityBootstrapIssue[] = [];
  for (const manifest of input.manifests) {
    for (const contribution of manifest.contributions?.queues ?? []) {
      const key = buildQueueBindingKey({
        capabilityId: manifest.id,
        operation: contribution.operation,
        operationKind: contribution.operationKind,
        queueName: contribution.queueName,
        jobName: contribution.jobName,
      });
      if (!bindingKeys.has(key)) {
        issues.push({
          code: 'CAPABILITY_QUEUE_BINDING_MISSING',
          capabilityId: manifest.id,
          message: `capability_queue_binding_missing:${manifest.id}:${contribution.operation}:${contribution.queueName}/${contribution.jobName}`,
        });
      }
    }
  }
  return issues;
}

function validateQueueRuntime(
  queueBindings: readonly CapabilityQueueBindingMetadata[],
): readonly CapabilityBootstrapIssue[] {
  const issues: CapabilityBootstrapIssue[] = [];
  for (const binding of queueBindings) {
    if (!hasQueueRuntime(binding.queueName)) {
      issues.push({
        code: 'CAPABILITY_QUEUE_NOT_REGISTERED',
        capabilityId: binding.capabilityId,
        message: `capability_queue_not_registered:${binding.capabilityId}:${binding.queueName}`,
      });
      continue;
    }
    if (!hasJobContract({ queueName: binding.queueName, jobName: binding.jobName })) {
      issues.push({
        code: 'CAPABILITY_JOB_NOT_REGISTERED',
        capabilityId: binding.capabilityId,
        message: `capability_job_not_registered:${binding.capabilityId}:${binding.queueName}/${binding.jobName}`,
      });
    }
  }
  return issues;
}

function detectDependencyCycles(
  manifests: readonly CapabilityManifest[],
): readonly CapabilityBootstrapIssue[] {
  const graph = new Map<CapabilityId, readonly CapabilityId[]>();
  for (const manifest of manifests) {
    graph.set(
      manifest.id,
      (manifest.dependsOn ?? [])
        .filter((dependency) => dependency.mode === 'required')
        .map((dependency) => dependency.capabilityId),
    );
  }

  const visiting = new Set<CapabilityId>();
  const visited = new Set<CapabilityId>();
  const issues: CapabilityBootstrapIssue[] = [];

  const visit = (capabilityId: CapabilityId, path: readonly CapabilityId[]): void => {
    if (visited.has(capabilityId)) {
      return;
    }
    if (visiting.has(capabilityId)) {
      issues.push({
        code: 'CAPABILITY_DEPENDENCY_CYCLE',
        capabilityId,
        message: `capability_dependency_cycle:${[...path, capabilityId].join('>')}`,
      });
      return;
    }
    visiting.add(capabilityId);
    for (const dependencyId of graph.get(capabilityId) ?? []) {
      if (graph.has(dependencyId)) {
        visit(dependencyId, [...path, capabilityId]);
      }
    }
    visiting.delete(capabilityId);
    visited.add(capabilityId);
  };

  for (const capabilityId of graph.keys()) {
    visit(capabilityId, []);
  }
  return issues;
}

function hasQueueRuntime(queueName: string): boolean {
  return Object.prototype.hasOwnProperty.call(BULLMQ_QUEUE_REGISTRY, queueName);
}

function hasJobContract(input: { readonly queueName: string; readonly jobName: string }): boolean {
  const validatorsByQueue = (
    BULLMQ_JOB_PAYLOAD_VALIDATORS as Readonly<Record<string, Readonly<Record<string, unknown>>>>
  )[input.queueName];
  return Boolean(
    validatorsByQueue && Object.prototype.hasOwnProperty.call(validatorsByQueue, input.jobName),
  );
}

function buildProviderBindingKey(input: {
  readonly capabilityId: CapabilityId;
  readonly providerKind: string;
  readonly providerName: string;
}): string {
  return [
    normalizeRequiredText(input.capabilityId),
    normalizeRequiredText(input.providerKind),
    normalizeRequiredText(input.providerName),
  ].join(':');
}

function buildQueueBindingKey(input: {
  readonly capabilityId: CapabilityId;
  readonly operation: string;
  readonly operationKind: string;
  readonly queueName: string;
  readonly jobName: string;
}): string {
  return [
    normalizeRequiredText(input.capabilityId),
    normalizeRequiredText(input.operationKind),
    normalizeRequiredText(input.operation),
    normalizeRequiredText(input.queueName),
    normalizeRequiredText(input.jobName),
  ].join(':');
}

function isValidCapabilityId(value: string): boolean {
  return /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(value);
}

function normalizeRequiredText(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    throw new Error('capability_text_required');
  }
  return normalized;
}

function formatBootstrapIssues(result: CapabilityBootstrapValidationResult): string {
  return `Capability bootstrap validation failed for ${result.process}:\n- ${result.issues
    .map((issue) => issue.message)
    .join('\n- ')}`;
}
