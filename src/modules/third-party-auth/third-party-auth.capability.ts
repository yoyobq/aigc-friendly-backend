// src/modules/third-party-auth/third-party-auth.capability.ts
import { Injectable } from '@nestjs/common';
import { CapabilityAnchorProvider } from '@src/infrastructure/capability/capability.decorators';

export const THIRD_PARTY_AUTH_BINDING_CAPABILITY_ID = 'third-party-auth.binding' as const;

@Injectable()
@CapabilityAnchorProvider({
  capabilityId: THIRD_PARTY_AUTH_BINDING_CAPABILITY_ID,
  mode: 'always-on',
  decisionRef: 'docs/capabilities/current.md',
})
export class ThirdPartyAuthBindingCapabilityAnchor {}
