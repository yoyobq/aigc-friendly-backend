import { Injectable } from '@nestjs/common';
import { CapabilityOwnershipProvider } from '@src/infrastructure/capability/capability.decorators';

export const PLATFORM_AUTH_CAPABILITY_ID = 'platform.auth' as const;

@Injectable()
@CapabilityOwnershipProvider({
  capabilityId: PLATFORM_AUTH_CAPABILITY_ID,
  kind: 'platform',
  semanticScope: 'Authentication, token/session issuance, and current-user projection.',
  owns: ['Authentication, JWT/session issuance and current-user projection.'],
  nonGoals: [
    'Account persistence.',
    'Third-party binding persistence.',
    'Business principal facts.',
  ],
  physicalScopes: [
    { path: 'src/modules/auth', role: 'primary' },
    { path: 'src/usecases/auth', role: 'primary' },
    { path: 'src/adapters/api/graphql/auth', role: 'primary' },
    { path: 'src/types/auth', role: 'primary' },
    { path: 'src/types/models/auth.types.ts', role: 'primary' },
  ],
  publicSurfaces: [{ status: 'present', path: 'src/types/auth/session.types.ts' }],
  allowedDependencies: ['platform.account', 'third-party-auth.binding'],
  foundationClassification: 'platform-foundation',
  validationEntrypoints: [
    'test/01-auth/auth.e2e-spec.ts',
    'test/01-auth/auth-identity.e2e-spec.ts',
  ],
})
export class PlatformAuthCapabilityOwnership {}
