// src/types/common/capability.types.ts

export type CapabilityKind = 'platform' | 'technical' | 'business';

export type CapabilityProcess = 'api' | 'worker';

export type CapabilityId = string;

export type CapabilityOperationKind = 'command' | 'query' | 'event';

export type CapabilityProviderKind = string;

export type CapabilityEnableState = 'enabled' | 'disabled';

export type CapabilityHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export type CapabilityActorSource = 'anonymous' | 'account' | 'system' | 'worker';

export type CapabilityEntryPoint = 'graphql-api' | 'worker';

export type CapabilityErrorCode =
  | 'CAPABILITY_DISABLED'
  | 'CAPABILITY_OPERATION_DISABLED'
  | 'CAPABILITY_TEMPORARILY_UNAVAILABLE'
  | 'CAPABILITY_PROVIDER_UNAVAILABLE'
  | 'CAPABILITY_INTERNAL_ERROR'
  | 'CAPABILITY_IDEMPOTENCY_CONFLICT';

export interface CapabilityError {
  readonly code: CapabilityErrorCode;
  readonly message: string;
  readonly capabilityId?: CapabilityId;
  readonly operation?: string;
  readonly details?: unknown;
}

export type CapabilityResult<TResult> =
  | {
      readonly ok: true;
      readonly value: TResult;
    }
  | {
      readonly ok: false;
      readonly error: CapabilityError;
    };

export interface CapabilityDependency {
  readonly capabilityId: CapabilityId;
  readonly mode: 'required' | 'optional';
}

export interface CapabilityProviderContribution {
  readonly providerKind: CapabilityProviderKind;
  readonly providerName: string;
}

export interface CapabilityQueueContribution {
  readonly operation: string;
  readonly operationKind: CapabilityOperationKind;
  readonly queueName: string;
  readonly jobName: string;
  readonly dedupKeyMapping?: 'jobId' | 'bullmq-dedup-option' | 'none';
}

export interface CapabilitySessionContributionManifest {
  readonly principals?: readonly CapabilitySessionPrincipalContribution[];
  readonly authorityClaims?: readonly CapabilitySessionAuthorityClaimContribution[];
}

export interface CapabilitySessionPrincipalContribution {
  readonly principalCode: string;
  readonly description?: string;
  readonly identityResolver: string;
  readonly sessionProjectionKey?: string;
  readonly exposedInSessionIdentity?: boolean;
}

export interface CapabilitySessionAuthorityClaimContribution {
  readonly claimCode: string;
  readonly description?: string;
  readonly subjectPrincipalCode?: string;
  readonly summaryResolver: string;
  readonly scopeAuthorizer?: string;
  readonly exposedInSession?: boolean;
  readonly sessionProjectionKey?: string;
}

export interface CapabilityRuntimeManifest {
  readonly defaultState?: CapabilityEnableState;
  readonly isReadonly?: boolean;
  readonly healthCheck?: boolean;
}

export interface CapabilityContributionManifest {
  readonly providers?: readonly CapabilityProviderContribution[];
  readonly queues?: readonly CapabilityQueueContribution[];
  readonly session?: CapabilitySessionContributionManifest;
}

export interface CapabilityManifest {
  readonly id: CapabilityId;
  readonly kind: CapabilityKind;
  readonly displayName: string;
  readonly version: string;
  readonly processes: readonly CapabilityProcess[];
  readonly dependsOn?: readonly CapabilityDependency[];
  readonly runtime?: CapabilityRuntimeManifest;
  readonly contributions?: CapabilityContributionManifest;
}

export interface CapabilityHealthResult {
  readonly status: CapabilityHealthStatus;
  readonly checkedAt: Date;
  readonly message?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface CapabilityHealthReport extends CapabilityHealthResult {
  readonly capabilityId: CapabilityId;
  readonly name: string;
}

export interface CapabilityHealthCheck {
  check(): Promise<CapabilityHealthResult>;
}

export interface CapabilityActorContext {
  readonly accountId?: number;
  readonly activeRole?: string | null;
  readonly principalCodes?: readonly string[];
  readonly authorityClaims?: readonly string[];
  readonly accessGroup?: readonly string[];
  readonly source: CapabilityActorSource;
}

export interface CapabilityRequestContext {
  readonly traceId: string;
  readonly requestId: string;
  readonly actor: CapabilityActorContext;
  readonly entryPoint?: CapabilityEntryPoint;
  readonly tenantId?: string;
  readonly locale?: string;
  readonly ip?: string;
  readonly userAgent?: string;
}
