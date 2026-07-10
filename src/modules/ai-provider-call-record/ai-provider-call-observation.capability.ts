import { Injectable } from '@nestjs/common';
import { CapabilityOwnershipProvider } from '@src/infrastructure/capability/capability.decorators';

export const AI_PROVIDER_CALL_OBSERVATION_CAPABILITY_ID = 'ai.provider-call-observation' as const;

@Injectable()
@CapabilityOwnershipProvider({
  capabilityId: AI_PROVIDER_CALL_OBSERVATION_CAPABILITY_ID,
  kind: 'technical',
  semanticScope: 'Observation of individual AI provider requests, responses, usage, and failures.',
  owns: ['Individual AI provider-call request, response, timing, usage and error observations.'],
  nonGoals: ['Async task lifecycle ownership.', 'AI provider execution ownership.'],
  physicalScopes: [
    { path: 'src/modules/ai-provider-call-record', role: 'primary' },
    {
      path: 'src/usecases/ai-worker',
      role: 'transitional',
      reason: 'Provider observation writes are currently orchestrated inside AI worker usecases.',
    },
  ],
  publicSurfaces: [
    {
      status: 'present',
      path: 'src/modules/ai-provider-call-record/ai-provider-call-record.types.ts',
    },
  ],
  allowedDependencies: ['platform.async-task-audit'],
  foundationClassification: 'domain-owned',
  validationEntrypoints: ['test/08-qm-worker/ai-worker-consume-persistence.e2e-spec.ts'],
})
export class AiProviderCallObservationCapabilityOwnership {}
