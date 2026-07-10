// src/modules/third-party-auth/third-party-auth.capability.ts
import { Injectable } from '@nestjs/common';
import { CapabilityOwnershipProvider } from '@src/infrastructure/capability/capability.decorators';

export const THIRD_PARTY_AUTH_BINDING_CAPABILITY_ID = 'third-party-auth.binding' as const;
export const THIRD_PARTY_AUTH_WEAPP_CAPABILITY_ID = 'third-party-auth.weapp' as const;

@Injectable()
@CapabilityOwnershipProvider({
  capabilityId: THIRD_PARTY_AUTH_BINDING_CAPABILITY_ID,
  kind: 'business',
  semanticScope: 'Local account-to-provider identity binding and unbinding lifecycle.',
  owns: ['Local account-to-provider identity binding facts and lifecycle.'],
  nonGoals: ['Provider SDK exchange and health.', 'Authentication/session issuance.'],
  physicalScopes: [
    { path: 'src/modules/third-party-auth/third-party-auth.entity.ts', role: 'primary' },
    { path: 'src/modules/third-party-auth/third-party-auth.service.ts', role: 'primary' },
    { path: 'src/modules/third-party-auth/queries', role: 'primary' },
    { path: 'src/usecases/third-party-accounts', role: 'primary' },
    { path: 'src/adapters/api/graphql/third-party-auth', role: 'primary' },
    { path: 'src/types/models/third-party-auth.types.ts', role: 'primary' },
    {
      path: 'src/modules/third-party-auth/third-party-auth.capability.ts',
      role: 'shared-implementation',
      reason: 'Binding and provider ownership declarations share the bounded-context assembly.',
    },
  ],
  publicSurfaces: [{ status: 'present', path: 'src/types/models/third-party-auth.types.ts' }],
  allowedDependencies: ['platform.account', THIRD_PARTY_AUTH_WEAPP_CAPABILITY_ID],
  foundationClassification: 'domain-owned',
  validationEntrypoints: ['test/01-auth/auth-identity.e2e-spec.ts'],
})
export class ThirdPartyAuthBindingCapabilityOwnership {}

@Injectable()
@CapabilityOwnershipProvider({
  capabilityId: THIRD_PARTY_AUTH_WEAPP_CAPABILITY_ID,
  kind: 'technical',
  semanticScope: 'WeApp external identity, QR-code, and phone-number integration.',
  owns: ['WeApp external identity, QR code and phone-number provider integration.'],
  nonGoals: ['Local account binding.', 'Registration and authentication outcomes.'],
  physicalScopes: [
    {
      path: 'src/infrastructure/third-party-auth/providers/weapp-http.provider.ts',
      role: 'primary',
    },
    {
      path: 'src/modules/third-party-auth/third-party-auth.capability.ts',
      role: 'shared-implementation',
      reason: 'Binding and provider ownership declarations share the bounded-context assembly.',
    },
  ],
  publicSurfaces: [
    {
      status: 'not-required',
      reason: 'The provider is selected through the third-party provider contract.',
    },
  ],
  allowedDependencies: [],
  foundationClassification: 'domain-owned',
  validationEntrypoints: ['test/99-third-party-live-smoke/weapp-qrcode-real.e2e-spec.ts'],
})
export class ThirdPartyAuthWeappCapabilityOwnership {}
