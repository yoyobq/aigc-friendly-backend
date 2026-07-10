import { Injectable } from '@nestjs/common';
import { CapabilityOwnershipProvider } from '@src/infrastructure/capability/capability.decorators';

export const PLATFORM_ACCOUNT_CAPABILITY_ID = 'platform.account' as const;

@Injectable()
@CapabilityOwnershipProvider({
  capabilityId: PLATFORM_ACCOUNT_CAPABILITY_ID,
  kind: 'platform',
  semanticScope:
    'Account identity, profile, credential, access facts, and account-registration policy.',
  owns: [
    'Account, user-info, credential and account-access facts.',
    'Email and third-party account-registration policy and completion semantics.',
  ],
  nonGoals: [
    'Authentication and session issuance.',
    'Third-party provider integration and binding persistence.',
    'Verification challenge lifecycle.',
  ],
  physicalScopes: [
    { path: 'src/modules/account', role: 'primary' },
    { path: 'src/usecases/account', role: 'primary' },
    { path: 'src/usecases/registration', role: 'primary' },
    { path: 'src/adapters/api/graphql/account', role: 'primary' },
    { path: 'src/adapters/api/graphql/registration', role: 'primary' },
    { path: 'src/types/models/account.types.ts', role: 'primary' },
    { path: 'src/types/models/registration.types.ts', role: 'primary' },
    { path: 'src/types/services/register.types.ts', role: 'primary' },
  ],
  publicSurfaces: [{ status: 'present', path: 'src/modules/account/account.types.ts' }],
  allowedDependencies: [
    'platform.verification-record',
    'third-party-auth.binding',
    'third-party-auth.weapp',
  ],
  foundationClassification: 'platform-foundation',
  validationEntrypoints: [
    'test/02-register/register.e2e-spec.ts',
    'test/04-user-info/update-visible-user-info.e2e-spec.ts',
  ],
})
export class PlatformAccountCapabilityOwnership {}
