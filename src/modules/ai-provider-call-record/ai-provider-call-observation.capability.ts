import { Injectable } from '@nestjs/common';
import { CapabilityAnchorProvider } from '@src/infrastructure/capability/capability.decorators';

export const AI_PROVIDER_CALL_OBSERVATION_CAPABILITY_ID = 'ai.provider-call-observation' as const;

@Injectable()
@CapabilityAnchorProvider({
  capabilityId: AI_PROVIDER_CALL_OBSERVATION_CAPABILITY_ID,
  mode: 'always-on',
  decisionRef: 'docs/capabilities/current.md',
})
export class AiProviderCallObservationCapabilityAnchor {}
