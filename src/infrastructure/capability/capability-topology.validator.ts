import type {
  CapabilityId,
  CapabilityOwnershipManifest,
  CapabilityProcess,
  CapabilityRuntimeManifest,
  CapabilitySessionAuthorityClaimContribution,
} from '@app-types/common/capability.types';
import type {
  CapabilityHealthCheckMetadata,
  CapabilityOperationHandlerMetadata,
  CapabilityProviderBindingMetadata,
  CapabilityQueueBindingMetadata,
  CapabilitySessionAuthorityScopeAuthorizerMetadata,
  CapabilitySessionAuthoritySummaryResolverMetadata,
  CapabilitySessionIdentityResolverMetadata,
} from './capability.decorators';

export interface CapabilityProcessTopology {
  readonly process: CapabilityProcess;
  readonly ownerships: readonly CapabilityOwnershipManifest[];
  readonly runtimeManifests: readonly CapabilityRuntimeManifest[];
  readonly providerBindings: readonly CapabilityProviderBindingMetadata[];
  readonly queueBindings: readonly CapabilityQueueBindingMetadata[];
  readonly healthChecks: readonly CapabilityHealthCheckMetadata[];
  readonly operationHandlers: readonly CapabilityOperationHandlerMetadata[];
  readonly sessionIdentityResolvers: readonly CapabilitySessionIdentityResolverMetadata[];
  readonly sessionAuthoritySummaryResolvers: readonly CapabilitySessionAuthoritySummaryResolverMetadata[];
  readonly sessionAuthorityScopeAuthorizers: readonly CapabilitySessionAuthorityScopeAuthorizerMetadata[];
}

export interface CapabilityTopologyIssue {
  readonly code: string;
  readonly message: string;
  readonly capabilityId?: CapabilityId;
  readonly severity?: 'error' | 'warning';
}

interface DeclaredOperation {
  readonly capabilityId: CapabilityId;
  readonly transport: string;
}

export function validateCapabilityProcessTopology(
  topology: CapabilityProcessTopology,
): readonly CapabilityTopologyIssue[] {
  const issues: CapabilityTopologyIssue[] = [];
  const ownershipIds = new Set(topology.ownerships.map((item) => item.capabilityId));
  const runtimeById = new Map(
    topology.runtimeManifests.map((manifest) => [manifest.capabilityId, manifest] as const),
  );

  for (const manifest of topology.runtimeManifests) {
    if (!ownershipIds.has(manifest.capabilityId)) {
      issues.push({
        code: 'CAPABILITY_RUNTIME_OWNERSHIP_MISSING',
        capabilityId: manifest.capabilityId,
        message: `capability_runtime_ownership_missing:${topology.process}:${manifest.capabilityId}`,
      });
    }
    for (const dependency of manifest.runtimeDependencies ?? []) {
      if (dependency.mode === 'required' && !runtimeById.has(dependency.capabilityId)) {
        issues.push({
          code: 'CAPABILITY_DEPENDENCY_MISSING',
          capabilityId: manifest.capabilityId,
          message: `capability_dependency_missing:${manifest.capabilityId}:${dependency.capabilityId}`,
        });
      }
    }
  }

  issues.push(...detectRuntimeDependencyCycles(topology.runtimeManifests));
  issues.push(...validateProviderContributions(topology));
  issues.push(...validateQueueContributions(topology));
  issues.push(...validateHealthChecks(topology));
  issues.push(...validateApiContributions(topology.runtimeManifests));
  issues.push(...validateOperations(topology));
  issues.push(...validateSessionContributions(topology));
  return dedupeTopologyIssues(issues);
}

function validateProviderContributions(
  topology: CapabilityProcessTopology,
): readonly CapabilityTopologyIssue[] {
  const bindings = new Set(
    topology.providerBindings.map((binding) =>
      [binding.capabilityId, binding.providerKind, binding.providerName]
        .map(normalizeText)
        .join(':'),
    ),
  );
  const issues: CapabilityTopologyIssue[] = [];
  for (const manifest of topology.runtimeManifests) {
    for (const provider of manifest.contributions?.providers ?? []) {
      const key = [manifest.capabilityId, provider.providerKind, provider.providerName]
        .map(normalizeText)
        .join(':');
      if (!bindings.has(key)) {
        issues.push({
          code: 'CAPABILITY_PROVIDER_BINDING_MISSING',
          capabilityId: manifest.capabilityId,
          message: `capability_provider_binding_missing:${manifest.capabilityId}:${provider.providerKind}:${provider.providerName}`,
        });
      }
    }
  }
  return issues;
}

function validateQueueContributions(
  topology: CapabilityProcessTopology,
): readonly CapabilityTopologyIssue[] {
  const bindings = new Set(topology.queueBindings.map(buildQueueBindingKey));
  const issues: CapabilityTopologyIssue[] = [];
  for (const manifest of topology.runtimeManifests) {
    for (const queue of manifest.contributions?.queues ?? []) {
      const key = buildQueueBindingKey({ capabilityId: manifest.capabilityId, ...queue });
      if (!bindings.has(key)) {
        issues.push({
          code: 'CAPABILITY_QUEUE_BINDING_MISSING',
          capabilityId: manifest.capabilityId,
          message: `capability_queue_binding_missing:${manifest.capabilityId}:${queue.operation}:${queue.queueName}/${queue.jobName}`,
        });
      }
    }
  }
  return issues;
}

function validateHealthChecks(
  topology: CapabilityProcessTopology,
): readonly CapabilityTopologyIssue[] {
  const capabilityIds = new Set(
    topology.healthChecks.map((item) => normalizeText(item.capabilityId)),
  );
  return topology.runtimeManifests.flatMap((manifest) =>
    manifest.runtime?.healthCheck === true &&
    !capabilityIds.has(normalizeText(manifest.capabilityId))
      ? [
          {
            code: 'CAPABILITY_HEALTH_CHECK_MISSING',
            capabilityId: manifest.capabilityId,
            message: `capability_health_check_missing:${manifest.capabilityId}`,
          },
        ]
      : [],
  );
}

function validateApiContributions(
  manifests: readonly CapabilityRuntimeManifest[],
): readonly CapabilityTopologyIssue[] {
  const issues: CapabilityTopologyIssue[] = [];
  for (const manifest of manifests) {
    for (const operation of manifest.contributions?.api?.graphqlOperations ?? []) {
      if (
        !operation.operationName.trim() ||
        !['query', 'mutation', 'subscription'].includes(operation.operationKind)
      ) {
        issues.push({
          code: 'CAPABILITY_GRAPHQL_OPERATION_INVALID',
          capabilityId: manifest.capabilityId,
          message: `capability_graphql_operation_invalid:${manifest.capabilityId}:${operation.operationKind}:${operation.operationName}`,
        });
      }
    }
  }
  return issues;
}

function validateOperations(
  topology: CapabilityProcessTopology,
): readonly CapabilityTopologyIssue[] {
  const declared = collectDeclaredOperations(topology.runtimeManifests);
  const queueOperationKeys = new Set(
    topology.queueBindings.map((binding) =>
      buildOperationKey(binding.capabilityId, binding.operationKind, binding.operation),
    ),
  );
  const handlerCounts = countEnabledOperationHandlers(topology);
  return [
    ...validateDeclaredOperationBindings({ declared, queueOperationKeys, handlerCounts }),
    ...validateRegisteredOperationHandlers({ topology, declared }),
  ];
}

function collectDeclaredOperations(
  manifests: readonly CapabilityRuntimeManifest[],
): ReadonlyMap<string, DeclaredOperation> {
  const declared = new Map<string, DeclaredOperation>();
  for (const manifest of manifests) {
    for (const operation of [
      ...(manifest.operations?.commands ?? []),
      ...(manifest.operations?.queries ?? []),
    ]) {
      declared.set(buildOperationKey(manifest.capabilityId, operation.kind, operation.name), {
        capabilityId: manifest.capabilityId,
        transport: operation.transport ?? 'in-process',
      });
    }
  }
  return declared;
}

function countEnabledOperationHandlers(
  topology: CapabilityProcessTopology,
): ReadonlyMap<string, number> {
  const enabledHandlers = topology.operationHandlers.filter((handler) =>
    isEnabledForProcess(handler.processes, topology.process),
  );
  const handlerCounts = new Map<string, number>();
  for (const handler of enabledHandlers) {
    const key = buildOperationKey(handler.capabilityId, handler.operationKind, handler.operation);
    handlerCounts.set(key, (handlerCounts.get(key) ?? 0) + 1);
  }
  return handlerCounts;
}

function validateDeclaredOperationBindings(input: {
  readonly declared: ReadonlyMap<string, DeclaredOperation>;
  readonly queueOperationKeys: ReadonlySet<string>;
  readonly handlerCounts: ReadonlyMap<string, number>;
}): readonly CapabilityTopologyIssue[] {
  const issues: CapabilityTopologyIssue[] = [];
  for (const [key, item] of input.declared) {
    if (item.transport === 'queue') {
      if (!input.queueOperationKeys.has(key)) {
        issues.push({
          code: 'CAPABILITY_OPERATION_QUEUE_BINDING_MISSING',
          capabilityId: item.capabilityId,
          message: `capability_operation_queue_binding_missing:${key}`,
        });
      }
      continue;
    }
    const count = input.handlerCounts.get(key) ?? 0;
    if (count === 0) {
      issues.push({
        code: 'CAPABILITY_OPERATION_HANDLER_MISSING',
        capabilityId: item.capabilityId,
        message: `capability_operation_handler_missing:${key}`,
      });
    } else if (count > 1) {
      issues.push({
        code: 'CAPABILITY_OPERATION_HANDLER_DUPLICATE',
        capabilityId: item.capabilityId,
        message: `capability_operation_handler_duplicate:${key}`,
      });
    }
  }
  return issues;
}

function validateRegisteredOperationHandlers(input: {
  readonly topology: CapabilityProcessTopology;
  readonly declared: ReadonlyMap<string, DeclaredOperation>;
}): readonly CapabilityTopologyIssue[] {
  const issues: CapabilityTopologyIssue[] = [];
  for (const handler of input.topology.operationHandlers) {
    const key = buildOperationKey(handler.capabilityId, handler.operationKind, handler.operation);
    if (!isEnabledForProcess(handler.processes, input.topology.process)) {
      issues.push({
        code: 'CAPABILITY_OPERATION_HANDLER_PROCESS_MISMATCH',
        capabilityId: handler.capabilityId,
        message: `capability_operation_handler_process_mismatch:${key}`,
      });
    }
    if (!input.declared.has(key)) {
      issues.push({
        code: 'CAPABILITY_OPERATION_HANDLER_NOT_DECLARED',
        capabilityId: handler.capabilityId,
        severity: 'warning',
        message: `capability_operation_handler_not_declared:${key}`,
      });
    }
  }
  return issues;
}

function validateSessionContributions(
  topology: CapabilityProcessTopology,
): readonly CapabilityTopologyIssue[] {
  const identityKeys = new Set(
    topology.sessionIdentityResolvers.map((item) =>
      buildSessionKey(item.capabilityId, item.resolverName),
    ),
  );
  const summaryKeys = new Set(
    topology.sessionAuthoritySummaryResolvers.map((item) =>
      buildSessionKey(item.capabilityId, item.resolverName),
    ),
  );
  const authorizerKeys = new Set(
    topology.sessionAuthorityScopeAuthorizers.map((item) =>
      buildSessionKey(item.capabilityId, item.authorizerName),
    ),
  );
  const principalOwners = collectSessionPrincipalOwners(topology.runtimeManifests);
  return topology.runtimeManifests.flatMap((manifest) => [
    ...validateSessionPrincipals(manifest, identityKeys),
    ...(manifest.contributions?.session?.authorityClaims ?? []).flatMap((claim) =>
      validateSessionClaim({
        manifest,
        claim,
        summaryKeys,
        authorizerKeys,
        principalOwners,
      }),
    ),
  ]);
}

function collectSessionPrincipalOwners(
  manifests: readonly CapabilityRuntimeManifest[],
): ReadonlyMap<string, CapabilityId> {
  const principalOwners = new Map<string, CapabilityId>();
  for (const manifest of manifests) {
    for (const principal of manifest.contributions?.session?.principals ?? []) {
      if (principal.principalCode.trim()) {
        principalOwners.set(principal.principalCode.trim().toUpperCase(), manifest.capabilityId);
      }
    }
  }
  return principalOwners;
}

function validateSessionPrincipals(
  manifest: CapabilityRuntimeManifest,
  identityKeys: ReadonlySet<string>,
): readonly CapabilityTopologyIssue[] {
  const issues: CapabilityTopologyIssue[] = [];
  for (const principal of manifest.contributions?.session?.principals ?? []) {
    if (!principal.principalCode.trim()) {
      issues.push(sessionIssue('CAPABILITY_SESSION_PRINCIPAL_CODE_INVALID', manifest.capabilityId));
    }
    if (!identityKeys.has(buildSessionKey(manifest.capabilityId, principal.identityResolver))) {
      issues.push(
        sessionIssue('CAPABILITY_SESSION_IDENTITY_RESOLVER_MISSING', manifest.capabilityId),
      );
    }
  }
  return issues;
}

function validateSessionClaim(input: {
  readonly manifest: CapabilityRuntimeManifest;
  readonly claim: CapabilitySessionAuthorityClaimContribution;
  readonly summaryKeys: ReadonlySet<string>;
  readonly authorizerKeys: ReadonlySet<string>;
  readonly principalOwners: ReadonlyMap<string, CapabilityId>;
}): readonly CapabilityTopologyIssue[] {
  const issues: CapabilityTopologyIssue[] = [];
  if (!input.claim.claimCode.trim()) {
    issues.push(
      sessionIssue('CAPABILITY_SESSION_AUTHORITY_CLAIM_CODE_INVALID', input.manifest.capabilityId),
    );
  }
  if (
    !input.summaryKeys.has(
      buildSessionKey(input.manifest.capabilityId, input.claim.summaryResolver),
    )
  ) {
    issues.push(
      sessionIssue(
        'CAPABILITY_SESSION_AUTHORITY_SUMMARY_RESOLVER_MISSING',
        input.manifest.capabilityId,
      ),
    );
  }
  if (
    !input.claim.scopeAuthorizer?.trim() ||
    !input.authorizerKeys.has(
      buildSessionKey(input.manifest.capabilityId, input.claim.scopeAuthorizer),
    )
  ) {
    issues.push(
      sessionIssue(
        'CAPABILITY_SESSION_AUTHORITY_SCOPE_AUTHORIZER_MISSING',
        input.manifest.capabilityId,
      ),
    );
  }
  const subjectCode = input.claim.subjectPrincipalCode?.trim().toUpperCase();
  if (!subjectCode) return issues;
  const owner = input.principalOwners.get(subjectCode);
  if (!owner) {
    issues.push(
      sessionIssue('CAPABILITY_SESSION_SUBJECT_PRINCIPAL_MISSING', input.manifest.capabilityId),
    );
  } else if (
    owner !== input.manifest.capabilityId &&
    !(input.manifest.runtimeDependencies ?? []).some(
      (dependency) => dependency.capabilityId === owner,
    )
  ) {
    issues.push(
      sessionIssue(
        'CAPABILITY_SESSION_SUBJECT_PRINCIPAL_DEPENDENCY_MISSING',
        input.manifest.capabilityId,
      ),
    );
  }
  return issues;
}

function detectRuntimeDependencyCycles(
  manifests: readonly CapabilityRuntimeManifest[],
): readonly CapabilityTopologyIssue[] {
  const graph = new Map(
    manifests.map(
      (manifest) =>
        [
          manifest.capabilityId,
          (manifest.runtimeDependencies ?? [])
            .filter((dependency) => dependency.mode === 'required')
            .map((dependency) => dependency.capabilityId),
        ] as const,
    ),
  );
  const visiting = new Set<CapabilityId>();
  const visited = new Set<CapabilityId>();
  const issues: CapabilityTopologyIssue[] = [];
  const visit = (capabilityId: CapabilityId, path: readonly CapabilityId[]): void => {
    if (visited.has(capabilityId)) return;
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
      if (graph.has(dependencyId)) visit(dependencyId, [...path, capabilityId]);
    }
    visiting.delete(capabilityId);
    visited.add(capabilityId);
  };
  for (const capabilityId of graph.keys()) visit(capabilityId, []);
  return issues;
}

function sessionIssue(code: string, capabilityId: CapabilityId): CapabilityTopologyIssue {
  return { code, capabilityId, message: `${code.toLowerCase()}:${capabilityId}` };
}

function buildQueueBindingKey(input: {
  readonly capabilityId: CapabilityId;
  readonly operation: string;
  readonly operationKind: string;
  readonly queueName: string;
  readonly jobName: string;
}): string {
  return [input.capabilityId, input.operationKind, input.operation, input.queueName, input.jobName]
    .map(normalizeText)
    .join(':');
}

function buildOperationKey(capabilityId: CapabilityId, kind: string, operation: string): string {
  return [capabilityId, kind, operation].map(normalizeText).join(':');
}

function buildSessionKey(capabilityId: CapabilityId, name: string): string {
  return [capabilityId, name].map(normalizeText).join(':');
}

function isEnabledForProcess(
  processes: readonly CapabilityProcess[] | undefined,
  process: CapabilityProcess,
): boolean {
  return !processes || processes.includes(process);
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function dedupeTopologyIssues(
  issues: readonly CapabilityTopologyIssue[],
): readonly CapabilityTopologyIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
