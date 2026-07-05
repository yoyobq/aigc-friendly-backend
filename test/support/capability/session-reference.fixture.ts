import { Injectable } from '@nestjs/common';
import type { CapabilityManifest } from '@app-types/common/capability.types';
import {
  CapabilityManifestProvider,
  CapabilitySessionAuthorityScopeAuthorizerProvider,
  CapabilitySessionAuthoritySummaryResolverProvider,
  CapabilitySessionIdentityResolverProvider,
} from '@src/infrastructure/capability/capability.decorators';
import type {
  CapabilitySessionAuthorityScopeAuthorizeInput,
  CapabilitySessionAuthorityScopeAuthorizer,
  CapabilitySessionAuthorityScopeDecision,
  CapabilitySessionAuthoritySummary,
  CapabilitySessionAuthoritySummaryResolver,
  CapabilitySessionAuthoritySummaryResolverInput,
  CapabilitySessionIdentityResolution,
  CapabilitySessionIdentityResolver,
  CapabilitySessionIdentityResolverInput,
} from '@src/usecases/common/ports/capability-session-context-builder.contract';

export const SESSION_REFERENCE_CAPABILITY_ID = 'reference.session';

export const SESSION_REFERENCE_CAPABILITY_MANIFEST: CapabilityManifest = {
  id: SESSION_REFERENCE_CAPABILITY_ID,
  kind: 'business',
  displayName: 'Reference Session Capability',
  version: '0.1.0',
  processes: ['api'],
  contributions: {
    session: {
      principals: [
        {
          principalCode: 'CLIENT',
          identityResolver: 'clientIdentityResolver',
          sessionProjectionKey: 'accessGroup',
          exposedInSessionIdentity: true,
        },
      ],
      authorityClaims: [
        {
          claimCode: 'RESOURCE_MANAGER',
          subjectPrincipalCode: 'CLIENT',
          summaryResolver: 'resourceManagerSummaryResolver',
          scopeAuthorizer: 'resourceManagerScopeAuthorizer',
          exposedInSession: true,
        },
      ],
    },
  },
};

@Injectable()
@CapabilityManifestProvider(SESSION_REFERENCE_CAPABILITY_MANIFEST)
export class ReferenceSessionCapability {}

@Injectable()
@CapabilitySessionIdentityResolverProvider({
  capabilityId: SESSION_REFERENCE_CAPABILITY_ID,
  resolverName: 'clientIdentityResolver',
})
export class ClientIdentityResolver implements CapabilitySessionIdentityResolver {
  resolveIdentity(
    input: CapabilitySessionIdentityResolverInput,
  ): Promise<CapabilitySessionIdentityResolution | null> {
    if (input.actor.accountId === undefined) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      principalCode: 'CLIENT',
    });
  }
}

@Injectable()
@CapabilitySessionAuthoritySummaryResolverProvider({
  capabilityId: SESSION_REFERENCE_CAPABILITY_ID,
  resolverName: 'resourceManagerSummaryResolver',
})
export class ResourceManagerSummaryResolver implements CapabilitySessionAuthoritySummaryResolver {
  resolveSummary(
    input: CapabilitySessionAuthoritySummaryResolverInput,
  ): Promise<CapabilitySessionAuthoritySummary | null> {
    if (!input.actor.principalCodes?.includes('CLIENT')) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      claimCode: 'RESOURCE_MANAGER',
    });
  }
}

@Injectable()
@CapabilitySessionAuthorityScopeAuthorizerProvider({
  capabilityId: SESSION_REFERENCE_CAPABILITY_ID,
  authorizerName: 'resourceManagerScopeAuthorizer',
})
export class ResourceManagerScopeAuthorizer implements CapabilitySessionAuthorityScopeAuthorizer {
  canAccessScope(
    _input: CapabilitySessionAuthorityScopeAuthorizeInput,
  ): Promise<CapabilitySessionAuthorityScopeDecision> {
    return Promise.resolve({ allowed: true });
  }
}

export const SESSION_REFERENCE_CAPABILITY_PROVIDERS = [
  ReferenceSessionCapability,
  ClientIdentityResolver,
  ResourceManagerSummaryResolver,
  ResourceManagerScopeAuthorizer,
] as const;
