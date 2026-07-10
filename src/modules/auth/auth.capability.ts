import { Injectable } from '@nestjs/common';
import { CapabilityAnchorProvider } from '@src/infrastructure/capability/capability.decorators';

export const PLATFORM_AUTH_CAPABILITY_ID = 'platform.auth' as const;

@Injectable()
@CapabilityAnchorProvider({
  capabilityId: PLATFORM_AUTH_CAPABILITY_ID,
  mode: 'always-on',
  decisionRef: 'docs/capabilities/current.md',
})
export class PlatformAuthCapabilityAnchor {}
