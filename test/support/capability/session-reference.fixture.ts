import { Injectable } from '@nestjs/common';
import type { CapabilityRuntimeManifest } from '@app-types/common/capability.types';
import {
  CapabilityOwnershipProvider,
  CapabilityRuntimeManifestProvider,
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

@Injectable()
@CapabilityOwnershipProvider({
  capabilityId: SESSION_REFERENCE_CAPABILITY_ID,
  kind: 'business',
  semanticScope: 'Test-only session principal and authority contribution.',
  owns: ['Reference session principal and authority contribution semantics.'],
  nonGoals: ['Production session ownership.'],
  physicalScopes: [
    { path: 'test/support/capability/session-reference.fixture.ts', role: 'primary' },
  ],
  publicSurfaces: [{ status: 'not-required', reason: 'Test-only session fixture.' }],
  allowedDependencies: [],
  foundationClassification: 'domain-owned',
  validationEntrypoints: [
    'src/infrastructure/capability/capability-session-context.builder.spec.ts',
  ],
})
export class ReferenceSessionCapabilityOwnership {}

export const SESSION_REFERENCE_CAPABILITY_MANIFEST: CapabilityRuntimeManifest = {
  capabilityId: SESSION_REFERENCE_CAPABILITY_ID,
  version: '0.1.0',
  contributions: {
    api: {
      graphqlOperations: [
        {
          operationName: 'referenceClient',
          operationKind: 'query',
          requiredPermissions: ['reference.client.read'],
        },
      ],
    },
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
@CapabilityRuntimeManifestProvider(SESSION_REFERENCE_CAPABILITY_MANIFEST)
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
  ReferenceSessionCapabilityOwnership,
  ReferenceSessionCapability,
  ClientIdentityResolver,
  ResourceManagerSummaryResolver,
  ResourceManagerScopeAuthorizer,
] as const;
