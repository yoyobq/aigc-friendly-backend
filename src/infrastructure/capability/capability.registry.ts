// src/infrastructure/capability/capability.registry.ts
import type {
  CapabilityHealthCheck,
  CapabilityHealthReport,
  CapabilityId,
  CapabilityManifest,
  CapabilityProcess,
  CapabilitySessionAuthorityClaimContribution,
  CapabilitySessionPrincipalContribution,
} from '@app-types/common/capability.types';
import { Inject, Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { BULLMQ_JOB_PAYLOAD_VALIDATORS } from '@src/infrastructure/bullmq/contracts/job-contract.registry';
import { BULLMQ_QUEUE_REGISTRY } from '@src/infrastructure/bullmq/queue-registry';
import type {
  CapabilitySessionAuthorityScopeAuthorizer,
  CapabilitySessionAuthoritySummaryResolver,
  CapabilitySessionIdentityResolver,
} from '@src/usecases/common/ports/capability-session-context-builder.contract';
import {
  CAPABILITY_MANIFEST_DISCOVERABLE,
  CAPABILITY_MANIFEST_METADATA_KEY,
  CAPABILITY_HEALTH_CHECK_DISCOVERABLE,
  CAPABILITY_SESSION_AUTHORITY_SCOPE_AUTHORIZER_DISCOVERABLE,
  CAPABILITY_SESSION_AUTHORITY_SCOPE_AUTHORIZER_METADATA_KEY,
  CAPABILITY_SESSION_AUTHORITY_SUMMARY_RESOLVER_DISCOVERABLE,
  CAPABILITY_SESSION_AUTHORITY_SUMMARY_RESOLVER_METADATA_KEY,
  CAPABILITY_SESSION_IDENTITY_RESOLVER_DISCOVERABLE,
  CAPABILITY_SESSION_IDENTITY_RESOLVER_METADATA_KEY,
  CAPABILITY_PROVIDER_BINDING_DISCOVERABLE,
  CAPABILITY_PROVIDER_BINDING_METADATA_KEY,
  CAPABILITY_QUEUE_BINDING_DISCOVERABLE,
  CAPABILITY_QUEUE_BINDING_METADATA_KEY,
  isCapabilityHealthCheck,
  type CapabilityHealthCheckMetadata,
  type CapabilityProviderBindingMetadata,
  type CapabilityQueueBindingMetadata,
  type CapabilitySessionAuthorityScopeAuthorizerMetadata,
  type CapabilitySessionAuthoritySummaryResolverMetadata,
  type CapabilitySessionIdentityResolverMetadata,
} from './capability.decorators';

export const CAPABILITY_PROCESS = Symbol('CAPABILITY_PROCESS');

export interface CapabilityProviderBinding {
  readonly metadata: CapabilityProviderBindingMetadata;
  readonly instance: unknown;
}

export interface CapabilityHealthCheckBinding {
  readonly metadata: CapabilityHealthCheckMetadata;
  readonly instance: CapabilityHealthCheck;
}

export interface CapabilitySessionIdentityResolverBinding {
  readonly metadata: CapabilitySessionIdentityResolverMetadata;
  readonly instance: CapabilitySessionIdentityResolver;
}

export interface CapabilitySessionAuthoritySummaryResolverBinding {
  readonly metadata: CapabilitySessionAuthoritySummaryResolverMetadata;
  readonly instance: CapabilitySessionAuthoritySummaryResolver;
}

export interface CapabilitySessionAuthorityScopeAuthorizerBinding {
  readonly metadata: CapabilitySessionAuthorityScopeAuthorizerMetadata;
  readonly instance: CapabilitySessionAuthorityScopeAuthorizer;
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
    | 'CAPABILITY_JOB_NOT_REGISTERED'
    | 'CAPABILITY_HEALTH_CHECK_MISSING'
    | 'CAPABILITY_SESSION_PRINCIPAL_CODE_INVALID'
    | 'CAPABILITY_SESSION_IDENTITY_RESOLVER_MISSING'
    | 'CAPABILITY_SESSION_AUTHORITY_CLAIM_CODE_INVALID'
    | 'CAPABILITY_SESSION_AUTHORITY_SUMMARY_RESOLVER_MISSING'
    | 'CAPABILITY_SESSION_AUTHORITY_SCOPE_AUTHORIZER_MISSING'
    | 'CAPABILITY_SESSION_SUBJECT_PRINCIPAL_MISSING'
    | 'CAPABILITY_SESSION_SUBJECT_PRINCIPAL_DEPENDENCY_MISSING';
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
  readonly healthChecks: readonly CapabilityHealthCheckBinding[];
  readonly sessionIdentityResolvers: readonly CapabilitySessionIdentityResolverBinding[];
  readonly sessionAuthoritySummaryResolvers: readonly CapabilitySessionAuthoritySummaryResolverBinding[];
  readonly sessionAuthorityScopeAuthorizers: readonly CapabilitySessionAuthorityScopeAuthorizerBinding[];
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

  getSessionIdentityResolver(input: {
    readonly capabilityId: CapabilityId;
    readonly resolverName: string;
  }): CapabilitySessionIdentityResolver | null {
    const key = buildSessionBindingKey({
      capabilityId: input.capabilityId,
      name: input.resolverName,
    });
    const binding = this.resolveSnapshot().sessionIdentityResolvers.find(
      (item) =>
        buildSessionBindingKey({
          capabilityId: item.metadata.capabilityId,
          name: item.metadata.resolverName,
        }) === key,
    );
    return binding?.instance ?? null;
  }

  getSessionAuthoritySummaryResolver(input: {
    readonly capabilityId: CapabilityId;
    readonly resolverName: string;
  }): CapabilitySessionAuthoritySummaryResolver | null {
    const key = buildSessionBindingKey({
      capabilityId: input.capabilityId,
      name: input.resolverName,
    });
    const binding = this.resolveSnapshot().sessionAuthoritySummaryResolvers.find(
      (item) =>
        buildSessionBindingKey({
          capabilityId: item.metadata.capabilityId,
          name: item.metadata.resolverName,
        }) === key,
    );
    return binding?.instance ?? null;
  }

  getSessionAuthorityScopeAuthorizer(input: {
    readonly capabilityId: CapabilityId;
    readonly authorizerName: string;
  }): CapabilitySessionAuthorityScopeAuthorizer | null {
    const key = buildSessionBindingKey({
      capabilityId: input.capabilityId,
      name: input.authorizerName,
    });
    const binding = this.resolveSnapshot().sessionAuthorityScopeAuthorizers.find(
      (item) =>
        buildSessionBindingKey({
          capabilityId: item.metadata.capabilityId,
          name: item.metadata.authorizerName,
        }) === key,
    );
    return binding?.instance ?? null;
  }

  async checkHealth(): Promise<readonly CapabilityHealthReport[]> {
    const reports = await Promise.all(
      this.resolveSnapshot().healthChecks.map(async (binding): Promise<CapabilityHealthReport> => {
        try {
          const result = await binding.instance.check();
          return {
            capabilityId: binding.metadata.capabilityId,
            name: binding.metadata.name,
            ...result,
          };
        } catch {
          return {
            capabilityId: binding.metadata.capabilityId,
            name: binding.metadata.name,
            status: 'unhealthy',
            checkedAt: new Date(),
            message: 'capability_health_check_failed',
          };
        }
      }),
    );
    return reports;
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
      ...validateHealthChecks({
        manifests: snapshot.manifests,
        healthChecks: snapshot.healthChecks,
      }),
      ...validateSessionContributions({
        manifests: snapshot.manifests,
        identityResolvers: snapshot.sessionIdentityResolvers,
        summaryResolvers: snapshot.sessionAuthoritySummaryResolvers,
        scopeAuthorizers: snapshot.sessionAuthorityScopeAuthorizers,
      }),
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
        healthChecks: this.discoverHealthChecks(manifests),
        sessionIdentityResolvers: this.discoverSessionIdentityResolvers(manifests),
        sessionAuthoritySummaryResolvers: this.discoverSessionAuthoritySummaryResolvers(manifests),
        sessionAuthorityScopeAuthorizers: this.discoverSessionAuthorityScopeAuthorizers(manifests),
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

  private discoverHealthChecks(
    activeManifests: readonly CapabilityManifest[],
  ): readonly CapabilityHealthCheckBinding[] {
    const activeCapabilityIds = new Set(activeManifests.map((manifest) => manifest.id));
    return this.discoveryService
      .getProviders()
      .map((wrapper): CapabilityHealthCheckBinding | null => {
        const metadata = this.discoveryService.getMetadataByDecorator(
          CAPABILITY_HEALTH_CHECK_DISCOVERABLE,
          wrapper,
        );
        if (!metadata || !activeCapabilityIds.has(metadata.capabilityId)) {
          return null;
        }
        if (!isCapabilityHealthCheck(wrapper.instance)) {
          return null;
        }
        return { metadata, instance: wrapper.instance };
      })
      .filter((binding): binding is CapabilityHealthCheckBinding => binding !== null);
  }

  private discoverSessionIdentityResolvers(
    activeManifests: readonly CapabilityManifest[],
  ): readonly CapabilitySessionIdentityResolverBinding[] {
    const activeCapabilityIds = new Set(activeManifests.map((manifest) => manifest.id));
    return this.discoveryService
      .getProviders({ metadataKey: CAPABILITY_SESSION_IDENTITY_RESOLVER_METADATA_KEY })
      .map((wrapper): CapabilitySessionIdentityResolverBinding | null => {
        const metadata = this.discoveryService.getMetadataByDecorator(
          CAPABILITY_SESSION_IDENTITY_RESOLVER_DISCOVERABLE,
          wrapper,
        );
        if (!metadata || !activeCapabilityIds.has(metadata.capabilityId)) {
          return null;
        }
        if (!isCapabilitySessionIdentityResolver(wrapper.instance)) {
          return null;
        }
        return { metadata, instance: wrapper.instance };
      })
      .filter((binding): binding is CapabilitySessionIdentityResolverBinding => binding !== null);
  }

  private discoverSessionAuthoritySummaryResolvers(
    activeManifests: readonly CapabilityManifest[],
  ): readonly CapabilitySessionAuthoritySummaryResolverBinding[] {
    const activeCapabilityIds = new Set(activeManifests.map((manifest) => manifest.id));
    return this.discoveryService
      .getProviders({ metadataKey: CAPABILITY_SESSION_AUTHORITY_SUMMARY_RESOLVER_METADATA_KEY })
      .map((wrapper): CapabilitySessionAuthoritySummaryResolverBinding | null => {
        const metadata = this.discoveryService.getMetadataByDecorator(
          CAPABILITY_SESSION_AUTHORITY_SUMMARY_RESOLVER_DISCOVERABLE,
          wrapper,
        );
        if (!metadata || !activeCapabilityIds.has(metadata.capabilityId)) {
          return null;
        }
        if (!isCapabilitySessionAuthoritySummaryResolver(wrapper.instance)) {
          return null;
        }
        return { metadata, instance: wrapper.instance };
      })
      .filter(
        (binding): binding is CapabilitySessionAuthoritySummaryResolverBinding => binding !== null,
      );
  }

  private discoverSessionAuthorityScopeAuthorizers(
    activeManifests: readonly CapabilityManifest[],
  ): readonly CapabilitySessionAuthorityScopeAuthorizerBinding[] {
    const activeCapabilityIds = new Set(activeManifests.map((manifest) => manifest.id));
    return this.discoveryService
      .getProviders({ metadataKey: CAPABILITY_SESSION_AUTHORITY_SCOPE_AUTHORIZER_METADATA_KEY })
      .map((wrapper): CapabilitySessionAuthorityScopeAuthorizerBinding | null => {
        const metadata = this.discoveryService.getMetadataByDecorator(
          CAPABILITY_SESSION_AUTHORITY_SCOPE_AUTHORIZER_DISCOVERABLE,
          wrapper,
        );
        if (!metadata || !activeCapabilityIds.has(metadata.capabilityId)) {
          return null;
        }
        if (!isCapabilitySessionAuthorityScopeAuthorizer(wrapper.instance)) {
          return null;
        }
        return { metadata, instance: wrapper.instance };
      })
      .filter(
        (binding): binding is CapabilitySessionAuthorityScopeAuthorizerBinding => binding !== null,
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

function validateHealthChecks(input: {
  readonly manifests: readonly CapabilityManifest[];
  readonly healthChecks: readonly CapabilityHealthCheckBinding[];
}): readonly CapabilityBootstrapIssue[] {
  const healthCheckCapabilityIds = new Set(
    input.healthChecks.map((binding) => normalizeRequiredText(binding.metadata.capabilityId)),
  );
  const issues: CapabilityBootstrapIssue[] = [];
  for (const manifest of input.manifests) {
    if (
      manifest.runtime?.healthCheck === true &&
      !healthCheckCapabilityIds.has(normalizeRequiredText(manifest.id))
    ) {
      issues.push({
        code: 'CAPABILITY_HEALTH_CHECK_MISSING',
        capabilityId: manifest.id,
        message: `capability_health_check_missing:${manifest.id}`,
      });
    }
  }
  return issues;
}

function validateSessionContributions(input: {
  readonly manifests: readonly CapabilityManifest[];
  readonly identityResolvers: readonly CapabilitySessionIdentityResolverBinding[];
  readonly summaryResolvers: readonly CapabilitySessionAuthoritySummaryResolverBinding[];
  readonly scopeAuthorizers: readonly CapabilitySessionAuthorityScopeAuthorizerBinding[];
}): readonly CapabilityBootstrapIssue[] {
  const identityResolverKeys = buildSessionIdentityResolverKeys(input.identityResolvers);
  const summaryResolverKeys = buildSessionAuthoritySummaryResolverKeys(input.summaryResolvers);
  const scopeAuthorizerKeys = buildSessionAuthorityScopeAuthorizerKeys(input.scopeAuthorizers);
  const principalOwners = buildSessionPrincipalOwnerMap(input.manifests);
  const issues: CapabilityBootstrapIssue[] = [];

  for (const manifest of input.manifests) {
    for (const principal of manifest.contributions?.session?.principals ?? []) {
      issues.push(
        ...validateSessionPrincipalContribution({
          manifest,
          principal,
          identityResolverKeys,
        }),
      );
    }

    for (const claim of manifest.contributions?.session?.authorityClaims ?? []) {
      issues.push(
        ...validateSessionAuthorityClaimContribution({
          manifest,
          claim,
          summaryResolverKeys,
          scopeAuthorizerKeys,
          principalOwners,
        }),
      );
    }
  }

  return issues;
}

function buildSessionIdentityResolverKeys(
  bindings: readonly CapabilitySessionIdentityResolverBinding[],
): ReadonlySet<string> {
  return new Set(
    bindings.map((binding) =>
      buildSessionBindingKey({
        capabilityId: binding.metadata.capabilityId,
        name: binding.metadata.resolverName,
      }),
    ),
  );
}

function buildSessionAuthoritySummaryResolverKeys(
  bindings: readonly CapabilitySessionAuthoritySummaryResolverBinding[],
): ReadonlySet<string> {
  return new Set(
    bindings.map((binding) =>
      buildSessionBindingKey({
        capabilityId: binding.metadata.capabilityId,
        name: binding.metadata.resolverName,
      }),
    ),
  );
}

function buildSessionAuthorityScopeAuthorizerKeys(
  bindings: readonly CapabilitySessionAuthorityScopeAuthorizerBinding[],
): ReadonlySet<string> {
  return new Set(
    bindings.map((binding) =>
      buildSessionBindingKey({
        capabilityId: binding.metadata.capabilityId,
        name: binding.metadata.authorizerName,
      }),
    ),
  );
}

function validateSessionPrincipalContribution(input: {
  readonly manifest: CapabilityManifest;
  readonly principal: CapabilitySessionPrincipalContribution;
  readonly identityResolverKeys: ReadonlySet<string>;
}): readonly CapabilityBootstrapIssue[] {
  const issues: CapabilityBootstrapIssue[] = [];
  if (!input.principal.principalCode.trim()) {
    issues.push({
      code: 'CAPABILITY_SESSION_PRINCIPAL_CODE_INVALID',
      capabilityId: input.manifest.id,
      message: `capability_session_principal_code_invalid:${input.manifest.id}`,
    });
  }
  if (!input.principal.identityResolver.trim()) {
    issues.push({
      code: 'CAPABILITY_SESSION_IDENTITY_RESOLVER_MISSING',
      capabilityId: input.manifest.id,
      message: `capability_session_identity_resolver_missing:${input.manifest.id}:${input.principal.principalCode}:${input.principal.identityResolver}`,
    });
    return issues;
  }

  const key = buildSessionBindingKey({
    capabilityId: input.manifest.id,
    name: input.principal.identityResolver,
  });
  if (input.identityResolverKeys.has(key)) {
    return issues;
  }
  issues.push({
    code: 'CAPABILITY_SESSION_IDENTITY_RESOLVER_MISSING',
    capabilityId: input.manifest.id,
    message: `capability_session_identity_resolver_missing:${input.manifest.id}:${input.principal.principalCode}:${input.principal.identityResolver}`,
  });
  return issues;
}

function validateSessionAuthorityClaimContribution(input: {
  readonly manifest: CapabilityManifest;
  readonly claim: CapabilitySessionAuthorityClaimContribution;
  readonly summaryResolverKeys: ReadonlySet<string>;
  readonly scopeAuthorizerKeys: ReadonlySet<string>;
  readonly principalOwners: ReadonlyMap<string, CapabilityId>;
}): readonly CapabilityBootstrapIssue[] {
  return [
    ...validateSessionAuthorityClaimCode(input),
    ...validateSessionAuthoritySummaryResolver(input),
    ...validateSessionAuthorityScopeAuthorizer(input),
    ...validateSessionAuthoritySubjectPrincipal(input),
  ];
}

function validateSessionAuthorityClaimCode(input: {
  readonly manifest: CapabilityManifest;
  readonly claim: CapabilitySessionAuthorityClaimContribution;
}): readonly CapabilityBootstrapIssue[] {
  if (input.claim.claimCode.trim()) {
    return [];
  }
  return [
    {
      code: 'CAPABILITY_SESSION_AUTHORITY_CLAIM_CODE_INVALID',
      capabilityId: input.manifest.id,
      message: `capability_session_authority_claim_code_invalid:${input.manifest.id}`,
    },
  ];
}

function validateSessionAuthoritySummaryResolver(input: {
  readonly manifest: CapabilityManifest;
  readonly claim: CapabilitySessionAuthorityClaimContribution;
  readonly summaryResolverKeys: ReadonlySet<string>;
}): readonly CapabilityBootstrapIssue[] {
  if (!input.claim.summaryResolver.trim()) {
    return [
      {
        code: 'CAPABILITY_SESSION_AUTHORITY_SUMMARY_RESOLVER_MISSING',
        capabilityId: input.manifest.id,
        message: `capability_session_authority_summary_resolver_missing:${input.manifest.id}:${input.claim.claimCode}:${input.claim.summaryResolver}`,
      },
    ];
  }

  const key = buildSessionBindingKey({
    capabilityId: input.manifest.id,
    name: input.claim.summaryResolver,
  });
  if (input.summaryResolverKeys.has(key)) {
    return [];
  }
  return [
    {
      code: 'CAPABILITY_SESSION_AUTHORITY_SUMMARY_RESOLVER_MISSING',
      capabilityId: input.manifest.id,
      message: `capability_session_authority_summary_resolver_missing:${input.manifest.id}:${input.claim.claimCode}:${input.claim.summaryResolver}`,
    },
  ];
}

function validateSessionAuthorityScopeAuthorizer(input: {
  readonly manifest: CapabilityManifest;
  readonly claim: CapabilitySessionAuthorityClaimContribution;
  readonly scopeAuthorizerKeys: ReadonlySet<string>;
}): readonly CapabilityBootstrapIssue[] {
  if (!input.claim.scopeAuthorizer?.trim()) {
    return [
      {
        code: 'CAPABILITY_SESSION_AUTHORITY_SCOPE_AUTHORIZER_MISSING',
        capabilityId: input.manifest.id,
        message: `capability_session_authority_scope_authorizer_missing:${input.manifest.id}:${input.claim.claimCode}`,
      },
    ];
  }

  const key = buildSessionBindingKey({
    capabilityId: input.manifest.id,
    name: input.claim.scopeAuthorizer,
  });
  if (input.scopeAuthorizerKeys.has(key)) {
    return [];
  }
  return [
    {
      code: 'CAPABILITY_SESSION_AUTHORITY_SCOPE_AUTHORIZER_MISSING',
      capabilityId: input.manifest.id,
      message: `capability_session_authority_scope_authorizer_missing:${input.manifest.id}:${input.claim.claimCode}:${input.claim.scopeAuthorizer}`,
    },
  ];
}

function validateSessionAuthoritySubjectPrincipal(input: {
  readonly manifest: CapabilityManifest;
  readonly claim: CapabilitySessionAuthorityClaimContribution;
  readonly principalOwners: ReadonlyMap<string, CapabilityId>;
}): readonly CapabilityBootstrapIssue[] {
  if (!input.claim.subjectPrincipalCode?.trim()) {
    return [];
  }

  const principalOwner = input.principalOwners.get(
    normalizeSessionCode(input.claim.subjectPrincipalCode),
  );
  if (!principalOwner) {
    return [
      {
        code: 'CAPABILITY_SESSION_SUBJECT_PRINCIPAL_MISSING',
        capabilityId: input.manifest.id,
        message: `capability_session_subject_principal_missing:${input.manifest.id}:${input.claim.claimCode}:${input.claim.subjectPrincipalCode}`,
      },
    ];
  }
  if (
    normalizeRequiredText(principalOwner) === normalizeRequiredText(input.manifest.id) ||
    hasDeclaredCapabilityDependency({ manifest: input.manifest, capabilityId: principalOwner })
  ) {
    return [];
  }
  return [
    {
      code: 'CAPABILITY_SESSION_SUBJECT_PRINCIPAL_DEPENDENCY_MISSING',
      capabilityId: input.manifest.id,
      message: `capability_session_subject_principal_dependency_missing:${input.manifest.id}:${input.claim.claimCode}:${input.claim.subjectPrincipalCode}:${principalOwner}`,
    },
  ];
}

function buildSessionPrincipalOwnerMap(
  manifests: readonly CapabilityManifest[],
): ReadonlyMap<string, CapabilityId> {
  const owners = new Map<string, CapabilityId>();
  for (const manifest of manifests) {
    for (const principal of manifest.contributions?.session?.principals ?? []) {
      if (!principal.principalCode.trim()) {
        continue;
      }
      owners.set(normalizeSessionCode(principal.principalCode), manifest.id);
    }
  }
  return owners;
}

function hasDeclaredCapabilityDependency(input: {
  readonly manifest: CapabilityManifest;
  readonly capabilityId: CapabilityId;
}): boolean {
  const normalizedCapabilityId = normalizeRequiredText(input.capabilityId);
  return (input.manifest.dependsOn ?? []).some(
    (dependency) => normalizeRequiredText(dependency.capabilityId) === normalizedCapabilityId,
  );
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

function buildSessionBindingKey(input: {
  readonly capabilityId: CapabilityId;
  readonly name: string;
}): string {
  return [normalizeRequiredText(input.capabilityId), normalizeRequiredText(input.name)].join(':');
}

function isValidCapabilityId(value: string): boolean {
  return /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(value);
}

function isCapabilitySessionIdentityResolver(
  value: unknown,
): value is CapabilitySessionIdentityResolver {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { readonly resolveIdentity?: unknown };
  return typeof candidate.resolveIdentity === 'function';
}

function isCapabilitySessionAuthoritySummaryResolver(
  value: unknown,
): value is CapabilitySessionAuthoritySummaryResolver {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { readonly resolveSummary?: unknown };
  return typeof candidate.resolveSummary === 'function';
}

function isCapabilitySessionAuthorityScopeAuthorizer(
  value: unknown,
): value is CapabilitySessionAuthorityScopeAuthorizer {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { readonly canAccessScope?: unknown };
  return typeof candidate.canAccessScope === 'function';
}

function normalizeSessionCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    throw new Error('capability_session_code_required');
  }
  return normalized;
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
