import { Injectable } from '@nestjs/common';
import { CapabilityAnchorProvider } from '@src/infrastructure/capability/capability.decorators';

export const PLATFORM_VERIFICATION_RECORD_CAPABILITY_ID = 'platform.verification-record' as const;

@Injectable()
@CapabilityAnchorProvider({
  capabilityId: PLATFORM_VERIFICATION_RECORD_CAPABILITY_ID,
  mode: 'always-on',
  decisionRef: 'docs/capabilities/current.md',
})
export class VerificationRecordCapabilityAnchor {}
