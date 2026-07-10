import { Injectable } from '@nestjs/common';
import { CapabilityOwnershipProvider } from '@src/infrastructure/capability/capability.decorators';

export const PLATFORM_VERIFICATION_RECORD_CAPABILITY_ID = 'platform.verification-record' as const;

@Injectable()
@CapabilityOwnershipProvider({
  capabilityId: PLATFORM_VERIFICATION_RECORD_CAPABILITY_ID,
  kind: 'platform',
  semanticScope: 'Verification challenge creation, lookup, consumption, and revocation.',
  owns: ['Verification challenge creation, lookup, consumption and revocation facts.'],
  nonGoals: [
    'Password reset, registration, login or binding outcomes.',
    'Generic verification dispatcher ownership.',
  ],
  physicalScopes: [
    { path: 'src/modules/verification-record', role: 'primary' },
    { path: 'src/usecases/verification-record', role: 'primary' },
    { path: 'src/adapters/api/graphql/verification-record', role: 'primary' },
    { path: 'src/types/models/verification-record.types.ts', role: 'primary' },
  ],
  publicSurfaces: [
    { status: 'present', path: 'src/modules/verification-record/verification-record.types.ts' },
  ],
  allowedDependencies: [],
  foundationClassification: 'platform-foundation',
  validationEntrypoints: ['test/05-verification-record/verification-record-types.e2e-spec.ts'],
})
export class VerificationRecordCapabilityOwnership {}
