import { Injectable } from '@nestjs/common';
import { CapabilityAnchorProvider } from '@src/infrastructure/capability/capability.decorators';

export const PLATFORM_ACCOUNT_CAPABILITY_ID = 'platform.account' as const;

@Injectable()
@CapabilityAnchorProvider({
  capabilityId: PLATFORM_ACCOUNT_CAPABILITY_ID,
  mode: 'always-on',
  decisionRef: 'docs/capabilities/current.md',
})
export class PlatformAccountCapabilityAnchor {}
