// src/infrastructure/capability/capability.registry.ts
import type {
  CapabilityGraphqlOperationContribution,
  CapabilityHealthCheck,
  CapabilityHealthReport,
  CapabilityId,
  CapabilityAnchor,
  CapabilityRuntimeContribution,
  CapabilityOperationDefinition,
  CapabilityOperationDescriptor,
  CapabilityProcess,
  CapabilitySessionAuthorityClaimContribution,
  CapabilitySessionPrincipalContribution,
} from '@app-types/common/capability.types';
import { Inject, Injectable } from '@nestjs/common';
import { DiscoveryService, type DiscoverableDecorator } from '@nestjs/core';
import { BULLMQ_JOB_PAYLOAD_VALIDATORS } from '@src/infrastructure/bullmq/contracts/job-contract.registry';
import { BULLMQ_QUEUE_REGISTRY } from '@src/infrastructure/bullmq/queue-registry';
import type {
  CapabilitySessionAuthorityScopeAuthorizer,
  CapabilitySessionAuthoritySummaryResolver,
  CapabilitySessionIdentityResolver,
} from '@src/usecases/common/ports/capability-session-context-builder.contract';
import {
  CAPABILITY_ANCHOR_DISCOVERABLE,
  CAPABILITY_RUNTIME_CONTRIBUTION_DISCOVERABLE,
  CAPABILITY_EVENT_SUBSCRIBER_DISCOVERABLE,
  CAPABILITY_HEALTH_CHECK_DISCOVERABLE,
  CAPABILITY_OPERATION_HANDLER_DISCOVERABLE,
  CAPABILITY_SESSION_AUTHORITY_SCOPE_AUTHORIZER_DISCOVERABLE,
  CAPABILITY_SESSION_AUTHORITY_SUMMARY_RESOLVER_DISCOVERABLE,
  CAPABILITY_SESSION_IDENTITY_RESOLVER_DISCOVERABLE,
  CAPABILITY_PROVIDER_BINDING_DISCOVERABLE,
  CAPABILITY_QUEUE_BINDING_DISCOVERABLE,
  isCapabilityHealthCheck,
  type CapabilityEventSubscriberMetadata,
  type CapabilityHealthCheckMetadata,
  type CapabilityOperationHandlerMetadata,
  type CapabilityProviderBindingMetadata,
  type CapabilityQueueBindingMetadata,
  type CapabilitySessionAuthorityScopeAuthorizerMetadata,
  type CapabilitySessionAuthoritySummaryResolverMetadata,
  type CapabilitySessionIdentityResolverMetadata,
} from './capability.decorators';
import { validateCapabilityProcessTopology } from './capability-topology.validator';
import type {
  CapabilityEventSubscriber,
  CapabilityOperationHandler,
  CapabilityQueueTransportDescriptor,
} from '@src/usecases/common/ports/capability-bus.contract';

export const CAPABILITY_PROCESS = Symbol('CAPABILITY_PROCESS');

export interface CapabilityProviderBinding {
  readonly metadata: CapabilityProviderBindingMetadata;
  readonly instance: unknown;
}

export interface CapabilityGraphqlOperationBinding extends CapabilityGraphqlOperationContribution {
  readonly capabilityId: CapabilityId;
}

export interface CapabilityHealthCheckBinding {
  readonly metadata: CapabilityHealthCheckMetadata;
  readonly instance: CapabilityHealthCheck;
}

export interface CapabilityOperationHandlerBinding {
  readonly metadata: CapabilityOperationHandlerMetadata;
  readonly instance: CapabilityOperationHandler;
}

export interface CapabilityEventSubscriberBinding {
  readonly metadata: CapabilityEventSubscriberMetadata;
  readonly instance: CapabilityEventSubscriber;
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
    | 'CAPABILITY_RUNTIME_ANCHOR_MISSING'
    | 'CAPABILITY_DEPENDENCY_MISSING'
    | 'CAPABILITY_DEPENDENCY_CYCLE'
    | 'CAPABILITY_PROVIDER_BINDING_MISSING'
    | 'CAPABILITY_QUEUE_BINDING_MISSING'
    | 'CAPABILITY_QUEUE_NOT_REGISTERED'
    | 'CAPABILITY_JOB_NOT_REGISTERED'
    | 'CAPABILITY_HEALTH_CHECK_MISSING'
    | 'CAPABILITY_GRAPHQL_OPERATION_INVALID'
    | 'CAPABILITY_OPERATION_HANDLER_MISSING'
    | 'CAPABILITY_OPERATION_HANDLER_DUPLICATE'
    | 'CAPABILITY_OPERATION_HANDLER_PROCESS_MISMATCH'
    | 'CAPABILITY_OPERATION_HANDLER_NOT_DECLARED'
    | 'CAPABILITY_OPERATION_QUEUE_BINDING_MISSING'
    | 'CAPABILITY_SESSION_PRINCIPAL_CODE_INVALID'
    | 'CAPABILITY_SESSION_IDENTITY_RESOLVER_MISSING'
    | 'CAPABILITY_SESSION_AUTHORITY_CLAIM_CODE_INVALID'
    | 'CAPABILITY_SESSION_AUTHORITY_SUMMARY_RESOLVER_MISSING'
    | 'CAPABILITY_SESSION_AUTHORITY_SCOPE_AUTHORIZER_MISSING'
    | 'CAPABILITY_SESSION_SUBJECT_PRINCIPAL_MISSING'
    | 'CAPABILITY_SESSION_SUBJECT_PRINCIPAL_DEPENDENCY_MISSING';
  readonly message: string;
  readonly capabilityId?: CapabilityId;
  readonly severity?: 'error' | 'warning';
}

export interface CapabilityBootstrapValidationResult {
  readonly process: CapabilityProcess;
  readonly issues: readonly CapabilityBootstrapIssue[];
}

interface CapabilitySnapshot {
  readonly anchors: readonly CapabilityAnchor[];
  readonly runtimeContributions: readonly CapabilityRuntimeContribution[];
  readonly providerBindings: readonly CapabilityProviderBinding[];
  readonly queueBindings: readonly CapabilityQueueBindingMetadata[];
  readonly healthChecks: readonly CapabilityHealthCheckBinding[];
  readonly operationHandlers: readonly CapabilityOperationHandlerBinding[];
  readonly eventSubscribers: readonly CapabilityEventSubscriberBinding[];
  readonly sessionIdentityResolvers: readonly CapabilitySessionIdentityResolverBinding[];
  readonly sessionAuthoritySummaryResolvers: readonly CapabilitySessionAuthoritySummaryResolverBinding[];
  readonly sessionAuthorityScopeAuthorizers: readonly CapabilitySessionAuthorityScopeAuthorizerBinding[];
}

interface DiscoveredCapabilityProvider<TMetadata> {
  readonly metadata: TMetadata;
  readonly instance: unknown;
}

@Injectable()
export class CapabilityRegistry {
  private snapshot: CapabilitySnapshot | null = null;

  constructor(
    @Inject(CAPABILITY_PROCESS)
    private readonly currentProcess: CapabilityProcess,
    private readonly discoveryService: DiscoveryService,
  ) {}

  getActiveCapabilityAnchors(): readonly CapabilityAnchor[] {
    return this.resolveSnapshot().anchors;
  }

  getActiveRuntimeContributions(): readonly CapabilityRuntimeContribution[] {
    return this.resolveSnapshot().runtimeContributions;
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

  getOperationDescriptor(input: {
    readonly capabilityId: CapabilityId;
    readonly operation: string;
    readonly operationKind: 'command' | 'query';
  }): CapabilityOperationDescriptor | null {
    const runtimeContribution = this.resolveSnapshot().runtimeContributions.find(
      (item) =>
        normalizeRequiredText(item.capabilityId) === normalizeRequiredText(input.capabilityId),
    );
    if (!runtimeContribution) {
      return null;
    }
    const definition = findOperationDefinition({
      runtimeContribution,
      operation: input.operation,
      operationKind: input.operationKind,
    });
    if (!definition) {
      return null;
    }
    return buildOperationDescriptor({
      runtimeContribution,
      definition,
    });
  }

  getOperationHandler(input: {
    readonly capabilityId: CapabilityId;
    readonly operation: string;
    readonly operationKind: 'command' | 'query';
  }): CapabilityOperationHandler | null {
    const key = buildOperationKey({
      capabilityId: input.capabilityId,
      operation: input.operation,
      operationKind: input.operationKind,
    });
    const binding = this.resolveSnapshot().operationHandlers.find(
      (item) =>
        isMetadataEnabledForProcess({
          currentProcess: this.currentProcess,
          processes: item.metadata.processes,
        }) &&
        buildOperationKey({
          capabilityId: item.metadata.capabilityId,
          operation: item.metadata.operation,
          operationKind: item.metadata.operationKind,
        }) === key,
    );
    return binding?.instance ?? null;
  }

  getQueueTransportDescriptor(input: {
    readonly capabilityId: CapabilityId;
    readonly operation: string;
    readonly operationKind: 'command' | 'event';
  }): CapabilityQueueTransportDescriptor | null {
    const key = buildQueueOperationBindingKey({
      capabilityId: input.capabilityId,
      operation: input.operation,
      operationKind: input.operationKind,
    });
    const binding = this.resolveSnapshot().queueBindings.find(
      (item) =>
        buildQueueOperationBindingKey({
          capabilityId: item.capabilityId,
          operation: item.operation,
          operationKind: item.operationKind,
        }) === key,
    );
    if (!binding) {
      return null;
    }
    return {
      capabilityId: binding.capabilityId,
      operation: binding.operation,
      operationKind: binding.operationKind,
      queueName: binding.queueName,
      jobName: binding.jobName,
      ...(binding.dedupKeyMapping === undefined
        ? {}
        : { dedupKeyMapping: binding.dedupKeyMapping }),
    };
  }

  getGraphqlOperationContributions(): readonly CapabilityGraphqlOperationBinding[] {
    return this.resolveSnapshot().runtimeContributions.flatMap((runtimeContribution) =>
      (runtimeContribution.contributions?.api?.graphqlOperations ?? []).map((operation) => ({
        capabilityId: runtimeContribution.capabilityId,
        operationName: operation.operationName,
        operationKind: operation.operationKind,
        ...(operation.requiredPermissions === undefined
          ? {}
          : { requiredPermissions: operation.requiredPermissions }),
      })),
    );
  }

  getEventSubscribers(input: {
    readonly capabilityId: CapabilityId;
    readonly event: string;
  }): readonly CapabilityEventSubscriber[] {
    const key = buildEventSubscriberKey(input);
    return this.resolveSnapshot()
      .eventSubscribers.filter(
        (item) =>
          isMetadataEnabledForProcess({
            currentProcess: this.currentProcess,
            processes: item.metadata.processes,
          }) &&
          buildEventSubscriberKey({
            capabilityId: item.metadata.capabilityId,
            event: item.metadata.event,
          }) === key,
      )
      .map((item) => item.instance);
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
    const topologyIssues = validateCapabilityProcessTopology({
      process: this.currentProcess,
      anchors: snapshot.anchors,
      runtimeContributions: snapshot.runtimeContributions,
      providerBindings: snapshot.providerBindings.map((binding) => binding.metadata),
      queueBindings: snapshot.queueBindings,
      healthChecks: snapshot.healthChecks.map((binding) => binding.metadata),
      operationHandlers: snapshot.operationHandlers.map((binding) => binding.metadata),
      sessionIdentityResolvers: snapshot.sessionIdentityResolvers.map(
        (binding) => binding.metadata,
      ),
      sessionAuthoritySummaryResolvers: snapshot.sessionAuthoritySummaryResolvers.map(
        (binding) => binding.metadata,
      ),
      sessionAuthorityScopeAuthorizers: snapshot.sessionAuthorityScopeAuthorizers.map(
        (binding) => binding.metadata,
      ),
    }).map(toBootstrapIssue);
    const issues = dedupeBootstrapIssues([
      ...topologyIssues,
      ...validateContributionIds(snapshot.anchors),
      ...validateContributionIds(snapshot.runtimeContributions),
      ...validateDependencies(snapshot.runtimeContributions),
      ...validateProviderContributions({
        runtimeContributions: snapshot.runtimeContributions,
        providerBindings: snapshot.providerBindings,
      }),
      ...validateQueueContributions({
        runtimeContributions: snapshot.runtimeContributions,
        queueBindings: snapshot.queueBindings,
      }),
      ...validateQueueRuntime(snapshot.queueBindings),
      ...validateHealthChecks({
        runtimeContributions: snapshot.runtimeContributions,
        healthChecks: snapshot.healthChecks,
      }),
      ...validateApiContributions(snapshot.runtimeContributions),
      ...validateOperationHandlers({
        runtimeContributions: snapshot.runtimeContributions,
        operationHandlers: snapshot.operationHandlers,
        queueBindings: snapshot.queueBindings,
        currentProcess: this.currentProcess,
      }),
      ...validateSessionContributions({
        runtimeContributions: snapshot.runtimeContributions,
        identityResolvers: snapshot.sessionIdentityResolvers,
        summaryResolvers: snapshot.sessionAuthoritySummaryResolvers,
        scopeAuthorizers: snapshot.sessionAuthorityScopeAuthorizers,
      }),
    ]);
    return { process: this.currentProcess, issues };
  }

  assertBootstrapValid(): void {
    const result = this.validateBootstrap();
    const blockingIssues = result.issues.filter(isBlockingBootstrapIssue);
    if (blockingIssues.length > 0) {
      throw new CapabilityBootstrapError({ ...result, issues: blockingIssues });
    }
  }

  private resolveSnapshot(): CapabilitySnapshot {
    if (!this.snapshot) {
      const anchors = this.discoverCapabilityAnchors();
      const runtimeContributions = this.discoverRuntimeContributions();
      this.snapshot = {
        anchors,
        runtimeContributions,
        providerBindings: this.discoverProviderBindings(runtimeContributions),
        queueBindings: this.discoverQueueBindings(runtimeContributions),
        healthChecks: this.discoverHealthChecks(runtimeContributions),
        operationHandlers: this.discoverOperationHandlers(runtimeContributions),
        eventSubscribers: this.discoverEventSubscribers(runtimeContributions),
        sessionIdentityResolvers: this.discoverSessionIdentityResolvers(runtimeContributions),
        sessionAuthoritySummaryResolvers:
          this.discoverSessionAuthoritySummaryResolvers(runtimeContributions),
        sessionAuthorityScopeAuthorizers:
          this.discoverSessionAuthorityScopeAuthorizers(runtimeContributions),
      };
    }
    return this.snapshot;
  }

  private discoverCapabilityAnchors(): readonly CapabilityAnchor[] {
    return this.discoverDecoratedProviders(CAPABILITY_ANCHOR_DISCOVERABLE).map(
      ({ metadata }) => metadata,
    );
  }

  private discoverRuntimeContributions(): readonly CapabilityRuntimeContribution[] {
    return this.discoverDecoratedProviders(CAPABILITY_RUNTIME_CONTRIBUTION_DISCOVERABLE).map(
      ({ metadata }) => metadata,
    );
  }

  private discoverProviderBindings(
    activeRuntimeContributions: readonly CapabilityRuntimeContribution[],
  ): readonly CapabilityProviderBinding[] {
    const activeCapabilityIds = new Set(
      activeRuntimeContributions.map((runtimeContribution) => runtimeContribution.capabilityId),
    );
    return this.discoverDecoratedProviders(CAPABILITY_PROVIDER_BINDING_DISCOVERABLE).filter(
      ({ metadata }) => activeCapabilityIds.has(metadata.capabilityId),
    );
  }

  private discoverQueueBindings(
    activeRuntimeContributions: readonly CapabilityRuntimeContribution[],
  ): readonly CapabilityQueueBindingMetadata[] {
    const activeCapabilityIds = new Set(
      activeRuntimeContributions.map((runtimeContribution) => runtimeContribution.capabilityId),
    );
    return this.discoverDecoratedProviders(CAPABILITY_QUEUE_BINDING_DISCOVERABLE)
      .map(({ metadata }) => metadata)
      .filter((metadata) => activeCapabilityIds.has(metadata.capabilityId));
  }

  private discoverHealthChecks(
    activeRuntimeContributions: readonly CapabilityRuntimeContribution[],
  ): readonly CapabilityHealthCheckBinding[] {
    const activeCapabilityIds = new Set(
      activeRuntimeContributions.map((runtimeContribution) => runtimeContribution.capabilityId),
    );
    return this.discoverDecoratedProviders(CAPABILITY_HEALTH_CHECK_DISCOVERABLE)
      .map(({ metadata, instance }): CapabilityHealthCheckBinding | null => {
        if (!activeCapabilityIds.has(metadata.capabilityId) || !isCapabilityHealthCheck(instance)) {
          return null;
        }
        return { metadata, instance };
      })
      .filter((binding): binding is CapabilityHealthCheckBinding => binding !== null);
  }

  private discoverOperationHandlers(
    activeRuntimeContributions: readonly CapabilityRuntimeContribution[],
  ): readonly CapabilityOperationHandlerBinding[] {
    const activeCapabilityIds = new Set(
      activeRuntimeContributions.map((runtimeContribution) => runtimeContribution.capabilityId),
    );
    return this.discoverDecoratedProviders(CAPABILITY_OPERATION_HANDLER_DISCOVERABLE)
      .map(({ metadata, instance }): CapabilityOperationHandlerBinding | null => {
        if (!activeCapabilityIds.has(metadata.capabilityId)) {
          return null;
        }
        if (!isCapabilityOperationHandler(instance)) {
          return null;
        }
        return { metadata, instance };
      })
      .filter((binding): binding is CapabilityOperationHandlerBinding => binding !== null);
  }

  private discoverEventSubscribers(
    activeRuntimeContributions: readonly CapabilityRuntimeContribution[],
  ): readonly CapabilityEventSubscriberBinding[] {
    const activeCapabilityIds = new Set(
      activeRuntimeContributions.map((runtimeContribution) => runtimeContribution.capabilityId),
    );
    return this.discoverDecoratedProviders(CAPABILITY_EVENT_SUBSCRIBER_DISCOVERABLE)
      .map(({ metadata, instance }): CapabilityEventSubscriberBinding | null => {
        if (!activeCapabilityIds.has(metadata.capabilityId)) {
          return null;
        }
        if (!isCapabilityEventSubscriber(instance)) {
          return null;
        }
        return { metadata, instance };
      })
      .filter((binding): binding is CapabilityEventSubscriberBinding => binding !== null);
  }

  private discoverSessionIdentityResolvers(
    activeRuntimeContributions: readonly CapabilityRuntimeContribution[],
  ): readonly CapabilitySessionIdentityResolverBinding[] {
    const activeCapabilityIds = new Set(
      activeRuntimeContributions.map((runtimeContribution) => runtimeContribution.capabilityId),
    );
    return this.discoverDecoratedProviders(CAPABILITY_SESSION_IDENTITY_RESOLVER_DISCOVERABLE)
      .map(({ metadata, instance }): CapabilitySessionIdentityResolverBinding | null => {
        if (!activeCapabilityIds.has(metadata.capabilityId)) {
          return null;
        }
        if (!isCapabilitySessionIdentityResolver(instance)) {
          return null;
        }
        return { metadata, instance };
      })
      .filter((binding): binding is CapabilitySessionIdentityResolverBinding => binding !== null);
  }

  private discoverSessionAuthoritySummaryResolvers(
    activeRuntimeContributions: readonly CapabilityRuntimeContribution[],
  ): readonly CapabilitySessionAuthoritySummaryResolverBinding[] {
    const activeCapabilityIds = new Set(
      activeRuntimeContributions.map((runtimeContribution) => runtimeContribution.capabilityId),
    );
    return this.discoverDecoratedProviders(
      CAPABILITY_SESSION_AUTHORITY_SUMMARY_RESOLVER_DISCOVERABLE,
    )
      .map(({ metadata, instance }): CapabilitySessionAuthoritySummaryResolverBinding | null => {
        if (!activeCapabilityIds.has(metadata.capabilityId)) {
          return null;
        }
        if (!isCapabilitySessionAuthoritySummaryResolver(instance)) {
          return null;
        }
        return { metadata, instance };
      })
      .filter(
        (binding): binding is CapabilitySessionAuthoritySummaryResolverBinding => binding !== null,
      );
  }

  private discoverSessionAuthorityScopeAuthorizers(
    activeRuntimeContributions: readonly CapabilityRuntimeContribution[],
  ): readonly CapabilitySessionAuthorityScopeAuthorizerBinding[] {
    const activeCapabilityIds = new Set(
      activeRuntimeContributions.map((runtimeContribution) => runtimeContribution.capabilityId),
    );
    return this.discoverDecoratedProviders(
      CAPABILITY_SESSION_AUTHORITY_SCOPE_AUTHORIZER_DISCOVERABLE,
    )
      .map(({ metadata, instance }): CapabilitySessionAuthorityScopeAuthorizerBinding | null => {
        if (!activeCapabilityIds.has(metadata.capabilityId)) {
          return null;
        }
        if (!isCapabilitySessionAuthorityScopeAuthorizer(instance)) {
          return null;
        }
        return { metadata, instance };
      })
      .filter(
        (binding): binding is CapabilitySessionAuthorityScopeAuthorizerBinding => binding !== null,
      );
  }

  private discoverDecoratedProviders<TMetadata>(
    decorator: DiscoverableDecorator<TMetadata>,
  ): readonly DiscoveredCapabilityProvider<TMetadata>[] {
    const seenInstances = new Set<unknown>();
    return this.discoveryService
      .getProviders()
      .map((wrapper): DiscoveredCapabilityProvider<TMetadata> | null => {
        const metadata = this.discoveryService.getMetadataByDecorator(decorator, wrapper);
        const instance: unknown = wrapper.instance;
        if (metadata === undefined || instance === null || instance === undefined) {
          return null;
        }
        if (seenInstances.has(instance)) {
          return null;
        }
        seenInstances.add(instance);
        return { metadata, instance };
      })
      .filter((provider): provider is DiscoveredCapabilityProvider<TMetadata> => provider !== null);
  }
}

export class CapabilityBootstrapError extends Error {
  constructor(readonly result: CapabilityBootstrapValidationResult) {
    super(formatBootstrapIssues(result));
    this.name = 'CapabilityBootstrapError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function validateContributionIds(
  runtimeContributions: readonly { readonly capabilityId: CapabilityId }[],
): readonly CapabilityBootstrapIssue[] {
  const issues: CapabilityBootstrapIssue[] = [];
  const seen = new Set<CapabilityId>();
  for (const runtimeContribution of runtimeContributions) {
    if (!isValidCapabilityId(runtimeContribution.capabilityId)) {
      issues.push({
        code: 'CAPABILITY_ID_INVALID',
        capabilityId: runtimeContribution.capabilityId,
        message: `invalid_capability_id:${runtimeContribution.capabilityId}`,
      });
    }
    if (seen.has(runtimeContribution.capabilityId)) {
      issues.push({
        code: 'CAPABILITY_ID_DUPLICATE',
        capabilityId: runtimeContribution.capabilityId,
        message: `duplicate_capability_id:${runtimeContribution.capabilityId}`,
      });
    }
    seen.add(runtimeContribution.capabilityId);
  }
  return issues;
}

function validateDependencies(
  runtimeContributions: readonly CapabilityRuntimeContribution[],
): readonly CapabilityBootstrapIssue[] {
  const capabilityIds = new Set(
    runtimeContributions.map((runtimeContribution) => runtimeContribution.capabilityId),
  );
  const issues: CapabilityBootstrapIssue[] = [];
  for (const runtimeContribution of runtimeContributions) {
    for (const dependency of runtimeContribution.runtimeDependencies ?? []) {
      if (dependency.mode === 'required' && !capabilityIds.has(dependency.capabilityId)) {
        issues.push({
          code: 'CAPABILITY_DEPENDENCY_MISSING',
          capabilityId: runtimeContribution.capabilityId,
          message: `capability_dependency_missing:${runtimeContribution.capabilityId}:${dependency.capabilityId}`,
        });
      }
    }
  }
  issues.push(...detectDependencyCycles(runtimeContributions));
  return issues;
}

function validateProviderContributions(input: {
  readonly runtimeContributions: readonly CapabilityRuntimeContribution[];
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
  for (const runtimeContribution of input.runtimeContributions) {
    for (const contribution of runtimeContribution.contributions?.providers ?? []) {
      const key = buildProviderBindingKey({
        capabilityId: runtimeContribution.capabilityId,
        providerKind: contribution.providerKind,
        providerName: contribution.providerName,
      });
      if (!bindingKeys.has(key)) {
        issues.push({
          code: 'CAPABILITY_PROVIDER_BINDING_MISSING',
          capabilityId: runtimeContribution.capabilityId,
          message: `capability_provider_binding_missing:${runtimeContribution.capabilityId}:${contribution.providerKind}:${contribution.providerName}`,
        });
      }
    }
  }
  return issues;
}

function validateQueueContributions(input: {
  readonly runtimeContributions: readonly CapabilityRuntimeContribution[];
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
  for (const runtimeContribution of input.runtimeContributions) {
    for (const contribution of runtimeContribution.contributions?.queues ?? []) {
      const key = buildQueueBindingKey({
        capabilityId: runtimeContribution.capabilityId,
        operation: contribution.operation,
        operationKind: contribution.operationKind,
        queueName: contribution.queueName,
        jobName: contribution.jobName,
      });
      if (!bindingKeys.has(key)) {
        issues.push({
          code: 'CAPABILITY_QUEUE_BINDING_MISSING',
          capabilityId: runtimeContribution.capabilityId,
          message: `capability_queue_binding_missing:${runtimeContribution.capabilityId}:${contribution.operation}:${contribution.queueName}/${contribution.jobName}`,
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
  readonly runtimeContributions: readonly CapabilityRuntimeContribution[];
  readonly healthChecks: readonly CapabilityHealthCheckBinding[];
}): readonly CapabilityBootstrapIssue[] {
  const healthCheckCapabilityIds = new Set(
    input.healthChecks.map((binding) => normalizeRequiredText(binding.metadata.capabilityId)),
  );
  const issues: CapabilityBootstrapIssue[] = [];
  for (const runtimeContribution of input.runtimeContributions) {
    if (
      runtimeContribution.runtime?.healthCheck === true &&
      !healthCheckCapabilityIds.has(normalizeRequiredText(runtimeContribution.capabilityId))
    ) {
      issues.push({
        code: 'CAPABILITY_HEALTH_CHECK_MISSING',
        capabilityId: runtimeContribution.capabilityId,
        message: `capability_health_check_missing:${runtimeContribution.capabilityId}`,
      });
    }
  }
  return issues;
}

function validateApiContributions(
  runtimeContributions: readonly CapabilityRuntimeContribution[],
): readonly CapabilityBootstrapIssue[] {
  const issues: CapabilityBootstrapIssue[] = [];
  for (const runtimeContribution of runtimeContributions) {
    for (const operation of runtimeContribution.contributions?.api?.graphqlOperations ?? []) {
      if (!operation.operationName.trim() || !isGraphqlOperationKind(operation.operationKind)) {
        issues.push({
          code: 'CAPABILITY_GRAPHQL_OPERATION_INVALID',
          capabilityId: runtimeContribution.capabilityId,
          message: `capability_graphql_operation_invalid:${runtimeContribution.capabilityId}:${operation.operationKind}:${operation.operationName}`,
        });
      }
    }
  }
  return issues;
}

function validateOperationHandlers(input: {
  readonly runtimeContributions: readonly CapabilityRuntimeContribution[];
  readonly operationHandlers: readonly CapabilityOperationHandlerBinding[];
  readonly queueBindings: readonly CapabilityQueueBindingMetadata[];
  readonly currentProcess: CapabilityProcess;
}): readonly CapabilityBootstrapIssue[] {
  const declaredOperations = buildDeclaredOperationMap(input.runtimeContributions);
  const enabledHandlerCounts = buildEnabledOperationHandlerCounts({
    handlers: input.operationHandlers,
    currentProcess: input.currentProcess,
  });
  const queueBindingKeys = new Set(
    input.queueBindings.map((binding) =>
      buildQueueOperationBindingKey({
        capabilityId: binding.capabilityId,
        operation: binding.operation,
        operationKind: binding.operationKind,
      }),
    ),
  );
  const issues: CapabilityBootstrapIssue[] = [];

  for (const [key, item] of declaredOperations) {
    if (item.definition.kind === 'event') {
      continue;
    }
    const descriptor = buildOperationDescriptor({
      runtimeContribution: item.runtimeContribution,
      definition: item.definition,
    });
    if (descriptor.transport === 'queue') {
      if (!queueBindingKeys.has(key)) {
        issues.push({
          code: 'CAPABILITY_OPERATION_QUEUE_BINDING_MISSING',
          capabilityId: item.runtimeContribution.capabilityId,
          message: `capability_operation_queue_binding_missing:${item.runtimeContribution.capabilityId}:${item.definition.kind}:${item.definition.name}`,
        });
      }
      continue;
    }

    const handlerCount = enabledHandlerCounts.get(key) ?? 0;
    if (handlerCount === 0) {
      issues.push({
        code: 'CAPABILITY_OPERATION_HANDLER_MISSING',
        capabilityId: item.runtimeContribution.capabilityId,
        message: `capability_operation_handler_missing:${item.runtimeContribution.capabilityId}:${item.definition.kind}:${item.definition.name}`,
      });
      continue;
    }
    if (handlerCount > 1) {
      issues.push({
        code: 'CAPABILITY_OPERATION_HANDLER_DUPLICATE',
        capabilityId: item.runtimeContribution.capabilityId,
        message: `capability_operation_handler_duplicate:${item.runtimeContribution.capabilityId}:${item.definition.kind}:${item.definition.name}`,
      });
    }
  }

  for (const binding of input.operationHandlers) {
    const key = buildOperationKey({
      capabilityId: binding.metadata.capabilityId,
      operation: binding.metadata.operation,
      operationKind: binding.metadata.operationKind,
    });
    if (
      !isMetadataEnabledForProcess({
        currentProcess: input.currentProcess,
        processes: binding.metadata.processes,
      })
    ) {
      issues.push({
        code: 'CAPABILITY_OPERATION_HANDLER_PROCESS_MISMATCH',
        capabilityId: binding.metadata.capabilityId,
        message: `capability_operation_handler_process_mismatch:${binding.metadata.capabilityId}:${binding.metadata.operationKind}:${binding.metadata.operation}`,
      });
    }
    if (!declaredOperations.has(key)) {
      issues.push({
        code: 'CAPABILITY_OPERATION_HANDLER_NOT_DECLARED',
        capabilityId: binding.metadata.capabilityId,
        severity: 'warning',
        message: `capability_operation_handler_not_declared:${binding.metadata.capabilityId}:${binding.metadata.operationKind}:${binding.metadata.operation}`,
      });
    }
  }

  return issues;
}

function validateSessionContributions(input: {
  readonly runtimeContributions: readonly CapabilityRuntimeContribution[];
  readonly identityResolvers: readonly CapabilitySessionIdentityResolverBinding[];
  readonly summaryResolvers: readonly CapabilitySessionAuthoritySummaryResolverBinding[];
  readonly scopeAuthorizers: readonly CapabilitySessionAuthorityScopeAuthorizerBinding[];
}): readonly CapabilityBootstrapIssue[] {
  const identityResolverKeys = buildSessionIdentityResolverKeys(input.identityResolvers);
  const summaryResolverKeys = buildSessionAuthoritySummaryResolverKeys(input.summaryResolvers);
  const scopeAuthorizerKeys = buildSessionAuthorityScopeAuthorizerKeys(input.scopeAuthorizers);
  const principalOwners = buildSessionPrincipalOwnerMap(input.runtimeContributions);
  const issues: CapabilityBootstrapIssue[] = [];

  for (const runtimeContribution of input.runtimeContributions) {
    for (const principal of runtimeContribution.contributions?.session?.principals ?? []) {
      issues.push(
        ...validateSessionPrincipalContribution({
          runtimeContribution,
          principal,
          identityResolverKeys,
        }),
      );
    }

    for (const claim of runtimeContribution.contributions?.session?.authorityClaims ?? []) {
      issues.push(
        ...validateSessionAuthorityClaimContribution({
          runtimeContribution,
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
  readonly runtimeContribution: CapabilityRuntimeContribution;
  readonly principal: CapabilitySessionPrincipalContribution;
  readonly identityResolverKeys: ReadonlySet<string>;
}): readonly CapabilityBootstrapIssue[] {
  const issues: CapabilityBootstrapIssue[] = [];
  if (!input.principal.principalCode.trim()) {
    issues.push({
      code: 'CAPABILITY_SESSION_PRINCIPAL_CODE_INVALID',
      capabilityId: input.runtimeContribution.capabilityId,
      message: `capability_session_principal_code_invalid:${input.runtimeContribution.capabilityId}`,
    });
  }
  if (!input.principal.identityResolver.trim()) {
    issues.push({
      code: 'CAPABILITY_SESSION_IDENTITY_RESOLVER_MISSING',
      capabilityId: input.runtimeContribution.capabilityId,
      message: `capability_session_identity_resolver_missing:${input.runtimeContribution.capabilityId}:${input.principal.principalCode}:${input.principal.identityResolver}`,
    });
    return issues;
  }

  const key = buildSessionBindingKey({
    capabilityId: input.runtimeContribution.capabilityId,
    name: input.principal.identityResolver,
  });
  if (input.identityResolverKeys.has(key)) {
    return issues;
  }
  issues.push({
    code: 'CAPABILITY_SESSION_IDENTITY_RESOLVER_MISSING',
    capabilityId: input.runtimeContribution.capabilityId,
    message: `capability_session_identity_resolver_missing:${input.runtimeContribution.capabilityId}:${input.principal.principalCode}:${input.principal.identityResolver}`,
  });
  return issues;
}

function validateSessionAuthorityClaimContribution(input: {
  readonly runtimeContribution: CapabilityRuntimeContribution;
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
  readonly runtimeContribution: CapabilityRuntimeContribution;
  readonly claim: CapabilitySessionAuthorityClaimContribution;
}): readonly CapabilityBootstrapIssue[] {
  if (input.claim.claimCode.trim()) {
    return [];
  }
  return [
    {
      code: 'CAPABILITY_SESSION_AUTHORITY_CLAIM_CODE_INVALID',
      capabilityId: input.runtimeContribution.capabilityId,
      message: `capability_session_authority_claim_code_invalid:${input.runtimeContribution.capabilityId}`,
    },
  ];
}

function validateSessionAuthoritySummaryResolver(input: {
  readonly runtimeContribution: CapabilityRuntimeContribution;
  readonly claim: CapabilitySessionAuthorityClaimContribution;
  readonly summaryResolverKeys: ReadonlySet<string>;
}): readonly CapabilityBootstrapIssue[] {
  if (!input.claim.summaryResolver.trim()) {
    return [
      {
        code: 'CAPABILITY_SESSION_AUTHORITY_SUMMARY_RESOLVER_MISSING',
        capabilityId: input.runtimeContribution.capabilityId,
        message: `capability_session_authority_summary_resolver_missing:${input.runtimeContribution.capabilityId}:${input.claim.claimCode}:${input.claim.summaryResolver}`,
      },
    ];
  }

  const key = buildSessionBindingKey({
    capabilityId: input.runtimeContribution.capabilityId,
    name: input.claim.summaryResolver,
  });
  if (input.summaryResolverKeys.has(key)) {
    return [];
  }
  return [
    {
      code: 'CAPABILITY_SESSION_AUTHORITY_SUMMARY_RESOLVER_MISSING',
      capabilityId: input.runtimeContribution.capabilityId,
      message: `capability_session_authority_summary_resolver_missing:${input.runtimeContribution.capabilityId}:${input.claim.claimCode}:${input.claim.summaryResolver}`,
    },
  ];
}

function validateSessionAuthorityScopeAuthorizer(input: {
  readonly runtimeContribution: CapabilityRuntimeContribution;
  readonly claim: CapabilitySessionAuthorityClaimContribution;
  readonly scopeAuthorizerKeys: ReadonlySet<string>;
}): readonly CapabilityBootstrapIssue[] {
  if (!input.claim.scopeAuthorizer?.trim()) {
    return [
      {
        code: 'CAPABILITY_SESSION_AUTHORITY_SCOPE_AUTHORIZER_MISSING',
        capabilityId: input.runtimeContribution.capabilityId,
        message: `capability_session_authority_scope_authorizer_missing:${input.runtimeContribution.capabilityId}:${input.claim.claimCode}`,
      },
    ];
  }

  const key = buildSessionBindingKey({
    capabilityId: input.runtimeContribution.capabilityId,
    name: input.claim.scopeAuthorizer,
  });
  if (input.scopeAuthorizerKeys.has(key)) {
    return [];
  }
  return [
    {
      code: 'CAPABILITY_SESSION_AUTHORITY_SCOPE_AUTHORIZER_MISSING',
      capabilityId: input.runtimeContribution.capabilityId,
      message: `capability_session_authority_scope_authorizer_missing:${input.runtimeContribution.capabilityId}:${input.claim.claimCode}:${input.claim.scopeAuthorizer}`,
    },
  ];
}

function validateSessionAuthoritySubjectPrincipal(input: {
  readonly runtimeContribution: CapabilityRuntimeContribution;
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
        capabilityId: input.runtimeContribution.capabilityId,
        message: `capability_session_subject_principal_missing:${input.runtimeContribution.capabilityId}:${input.claim.claimCode}:${input.claim.subjectPrincipalCode}`,
      },
    ];
  }
  if (
    normalizeRequiredText(principalOwner) ===
      normalizeRequiredText(input.runtimeContribution.capabilityId) ||
    hasDeclaredCapabilityDependency({
      runtimeContribution: input.runtimeContribution,
      capabilityId: principalOwner,
    })
  ) {
    return [];
  }
  return [
    {
      code: 'CAPABILITY_SESSION_SUBJECT_PRINCIPAL_DEPENDENCY_MISSING',
      capabilityId: input.runtimeContribution.capabilityId,
      message: `capability_session_subject_principal_dependency_missing:${input.runtimeContribution.capabilityId}:${input.claim.claimCode}:${input.claim.subjectPrincipalCode}:${principalOwner}`,
    },
  ];
}

function buildSessionPrincipalOwnerMap(
  runtimeContributions: readonly CapabilityRuntimeContribution[],
): ReadonlyMap<string, CapabilityId> {
  const owners = new Map<string, CapabilityId>();
  for (const runtimeContribution of runtimeContributions) {
    for (const principal of runtimeContribution.contributions?.session?.principals ?? []) {
      if (!principal.principalCode.trim()) {
        continue;
      }
      owners.set(normalizeSessionCode(principal.principalCode), runtimeContribution.capabilityId);
    }
  }
  return owners;
}

function hasDeclaredCapabilityDependency(input: {
  readonly runtimeContribution: CapabilityRuntimeContribution;
  readonly capabilityId: CapabilityId;
}): boolean {
  const normalizedCapabilityId = normalizeRequiredText(input.capabilityId);
  return (input.runtimeContribution.runtimeDependencies ?? []).some(
    (dependency) => normalizeRequiredText(dependency.capabilityId) === normalizedCapabilityId,
  );
}

function buildDeclaredOperationMap(
  runtimeContributions: readonly CapabilityRuntimeContribution[],
): ReadonlyMap<
  string,
  {
    readonly runtimeContribution: CapabilityRuntimeContribution;
    readonly definition: CapabilityOperationDefinition;
  }
> {
  const operations = new Map<
    string,
    {
      readonly runtimeContribution: CapabilityRuntimeContribution;
      readonly definition: CapabilityOperationDefinition;
    }
  >();
  for (const runtimeContribution of runtimeContributions) {
    for (const definition of getContributionOperationDefinitions(runtimeContribution)) {
      operations.set(
        buildOperationKey({
          capabilityId: runtimeContribution.capabilityId,
          operation: definition.name,
          operationKind: definition.kind,
        }),
        { runtimeContribution, definition },
      );
    }
  }
  return operations;
}

function buildEnabledOperationHandlerCounts(input: {
  readonly handlers: readonly CapabilityOperationHandlerBinding[];
  readonly currentProcess: CapabilityProcess;
}): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const handler of input.handlers) {
    if (
      !isMetadataEnabledForProcess({
        currentProcess: input.currentProcess,
        processes: handler.metadata.processes,
      })
    ) {
      continue;
    }
    const key = buildOperationKey({
      capabilityId: handler.metadata.capabilityId,
      operation: handler.metadata.operation,
      operationKind: handler.metadata.operationKind,
    });
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function findOperationDefinition(input: {
  readonly runtimeContribution: CapabilityRuntimeContribution;
  readonly operation: string;
  readonly operationKind: 'command' | 'query';
}): CapabilityOperationDefinition | null {
  const key = buildOperationKey({
    capabilityId: input.runtimeContribution.capabilityId,
    operation: input.operation,
    operationKind: input.operationKind,
  });
  return (
    getContributionOperationDefinitions(input.runtimeContribution).find(
      (definition) =>
        buildOperationKey({
          capabilityId: input.runtimeContribution.capabilityId,
          operation: definition.name,
          operationKind: definition.kind,
        }) === key,
    ) ?? null
  );
}

function getContributionOperationDefinitions(
  runtimeContribution: CapabilityRuntimeContribution,
): readonly CapabilityOperationDefinition[] {
  return [
    ...(runtimeContribution.operations?.commands ?? []),
    ...(runtimeContribution.operations?.queries ?? []),
    ...(runtimeContribution.operations?.events ?? []),
  ];
}

function buildOperationDescriptor(input: {
  readonly runtimeContribution: CapabilityRuntimeContribution;
  readonly definition: CapabilityOperationDefinition;
}): CapabilityOperationDescriptor {
  return {
    capabilityId: input.runtimeContribution.capabilityId,
    operation: input.definition.name,
    operationKind: input.definition.kind,
    transport: input.definition.transport ?? 'in-process',
    enabled: input.definition.enabledByDefault ?? true,
    ...(input.definition.version === undefined
      ? {}
      : { operationVersion: input.definition.version }),
    ...(input.definition.requiredPermissions === undefined
      ? {}
      : { requiredPermissions: input.definition.requiredPermissions }),
    ...(input.definition.timeoutMs === undefined ? {} : { timeoutMs: input.definition.timeoutMs }),
  };
}

function isMetadataEnabledForProcess(input: {
  readonly currentProcess: CapabilityProcess;
  readonly processes?: readonly CapabilityProcess[];
}): boolean {
  return !input.processes || input.processes.includes(input.currentProcess);
}

function detectDependencyCycles(
  runtimeContributions: readonly CapabilityRuntimeContribution[],
): readonly CapabilityBootstrapIssue[] {
  const graph = new Map<CapabilityId, readonly CapabilityId[]>();
  for (const runtimeContribution of runtimeContributions) {
    graph.set(
      runtimeContribution.capabilityId,
      (runtimeContribution.runtimeDependencies ?? [])
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

function buildOperationKey(input: {
  readonly capabilityId: CapabilityId;
  readonly operation: string;
  readonly operationKind: string;
}): string {
  return [
    normalizeRequiredText(input.capabilityId),
    normalizeRequiredText(input.operationKind),
    normalizeRequiredText(input.operation),
  ].join(':');
}

function buildQueueOperationBindingKey(input: {
  readonly capabilityId: CapabilityId;
  readonly operation: string;
  readonly operationKind: string;
}): string {
  return buildOperationKey(input);
}

function buildEventSubscriberKey(input: {
  readonly capabilityId: CapabilityId;
  readonly event: string;
}): string {
  return [normalizeRequiredText(input.capabilityId), normalizeRequiredText(input.event)].join(':');
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

function isGraphqlOperationKind(value: string): boolean {
  return value === 'query' || value === 'mutation' || value === 'subscription';
}

function isCapabilityOperationHandler(value: unknown): value is CapabilityOperationHandler {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { readonly handle?: unknown };
  return typeof candidate.handle === 'function';
}

function isCapabilityEventSubscriber(value: unknown): value is CapabilityEventSubscriber {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { readonly handle?: unknown };
  return typeof candidate.handle === 'function';
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

function isBlockingBootstrapIssue(issue: CapabilityBootstrapIssue): boolean {
  return issue.severity !== 'warning';
}

function toBootstrapIssue(issue: {
  readonly code: string;
  readonly message: string;
  readonly capabilityId?: CapabilityId;
  readonly severity?: 'error' | 'warning';
}): CapabilityBootstrapIssue {
  return {
    code: issue.code as CapabilityBootstrapIssue['code'],
    message: issue.message,
    ...(issue.capabilityId === undefined ? {} : { capabilityId: issue.capabilityId }),
    ...(issue.severity === undefined ? {} : { severity: issue.severity }),
  };
}

function dedupeBootstrapIssues(
  issues: readonly CapabilityBootstrapIssue[],
): readonly CapabilityBootstrapIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatBootstrapIssues(result: CapabilityBootstrapValidationResult): string {
  return `Capability bootstrap validation failed for ${result.process}:\n- ${result.issues
    .map((issue) => issue.message)
    .join('\n- ')}`;
}
