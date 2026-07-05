import type {
  CapabilityActorContext,
  CapabilityActorSource,
  CapabilityEntryPoint,
  CapabilityRequestContext,
  CapabilitySessionAuthorityClaimContribution,
  CapabilitySessionPrincipalContribution,
} from '@app-types/common/capability.types';

export const CAPABILITY_SESSION_CONTEXT_BUILDER = Symbol('CAPABILITY_SESSION_CONTEXT_BUILDER');

export interface BuildCapabilitySessionContextInput {
  readonly traceId?: string;
  readonly requestId?: string;
  readonly accountId?: number;
  readonly activeRole?: string | null;
  readonly accessGroup?: readonly string[];
  readonly source: CapabilityActorSource;
  readonly entryPoint: CapabilityEntryPoint;
  readonly tenantId?: string;
  readonly locale?: string;
  readonly ip?: string;
  readonly userAgent?: string;
}

export interface CapabilitySessionContextBuilder {
  build(input: BuildCapabilitySessionContextInput): Promise<CapabilityRequestContext>;
}

export interface CapabilitySessionIdentityResolverInput {
  readonly actor: CapabilityActorContext;
  readonly principal: CapabilitySessionPrincipalContribution;
}

export interface CapabilitySessionIdentityResolution {
  readonly principalCode: string;
}

export interface CapabilitySessionIdentityResolver {
  resolveIdentity(
    input: CapabilitySessionIdentityResolverInput,
  ): Promise<CapabilitySessionIdentityResolution | null>;
}

export interface CapabilitySessionAuthoritySummaryResolverInput {
  readonly actor: CapabilityActorContext;
  readonly claim: CapabilitySessionAuthorityClaimContribution;
}

export interface CapabilitySessionAuthoritySummary {
  readonly claimCode: string;
}

export interface CapabilitySessionAuthoritySummaryResolver {
  resolveSummary(
    input: CapabilitySessionAuthoritySummaryResolverInput,
  ): Promise<CapabilitySessionAuthoritySummary | null>;
}

export interface CapabilitySessionAuthorityScopeAuthorizeInput {
  readonly actor: CapabilityActorContext;
  readonly claim: CapabilitySessionAuthorityClaimContribution;
  readonly scope?: unknown;
}

export interface CapabilitySessionAuthorityScopeDecision {
  readonly allowed: boolean;
  readonly reason?: string;
}

export interface CapabilitySessionAuthorityScopeAuthorizer {
  canAccessScope(
    input: CapabilitySessionAuthorityScopeAuthorizeInput,
  ): Promise<CapabilitySessionAuthorityScopeDecision>;
}
