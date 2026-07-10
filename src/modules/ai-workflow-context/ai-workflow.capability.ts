import { Injectable } from '@nestjs/common';
import { CapabilityOwnershipProvider } from '@src/infrastructure/capability/capability.decorators';

export const AI_WORKFLOW_CAPABILITY_ID = 'ai.workflow' as const;

@Injectable()
@CapabilityOwnershipProvider({
  capabilityId: AI_WORKFLOW_CAPABILITY_ID,
  kind: 'technical',
  semanticScope: 'AI workflow context, admission, execution state, and housekeeping lifecycle.',
  owns: ['AI workflow context, admission, execution state and housekeeping lifecycle.'],
  nonGoals: ['Generic AI queue ownership.', 'Provider-call observation ownership.'],
  physicalScopes: [
    { path: 'src/modules/ai-workflow-context', role: 'primary' },
    { path: 'src/usecases/ai-workflow', role: 'primary' },
    {
      path: 'src/usecases/ai-worker',
      role: 'transitional',
      reason: 'Worker usecases still combine workflow execution with generic AI job execution.',
    },
  ],
  publicSurfaces: [
    {
      status: 'present',
      path: 'src/modules/ai-workflow-context/ai-workflow-context.types.ts',
    },
  ],
  allowedDependencies: ['ai.queue', 'platform.async-task-audit', 'ai.provider-call-observation'],
  foundationClassification: 'domain-owned',
  validationEntrypoints: ['test/08-qm-worker/ai-worker-consume-workflow.e2e-spec.ts'],
})
export class AiWorkflowCapabilityOwnership {}
