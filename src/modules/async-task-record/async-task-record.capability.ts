import { Injectable } from '@nestjs/common';
import { CapabilityOwnershipProvider } from '@src/infrastructure/capability/capability.decorators';

export const PLATFORM_ASYNC_TASK_AUDIT_CAPABILITY_ID = 'platform.async-task-audit' as const;

@Injectable()
@CapabilityOwnershipProvider({
  capabilityId: PLATFORM_ASYNC_TASK_AUDIT_CAPABILITY_ID,
  kind: 'platform',
  semanticScope: 'Cross-runtime asynchronous task state, trace, attempts, and audit history.',
  owns: ['Cross-runtime async task lifecycle, trace, attempt and audit facts.'],
  nonGoals: ['AI provider-call payload observation.', 'AI workflow state.'],
  physicalScopes: [
    { path: 'src/modules/async-task-record', role: 'primary' },
    { path: 'src/usecases/async-task-record', role: 'primary' },
  ],
  publicSurfaces: [
    { status: 'present', path: 'src/modules/async-task-record/async-task-record.types.ts' },
  ],
  allowedDependencies: [],
  foundationClassification: 'platform-foundation',
  validationEntrypoints: ['test/08-qm-worker/ai-graphql-queue.e2e-spec.ts'],
})
export class AsyncTaskAuditCapabilityOwnership {}
