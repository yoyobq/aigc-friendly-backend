// src/modules/common/ai-capability/ai-capability.providers.ts
import { Injectable } from '@nestjs/common';
import { BULLMQ_JOBS, BULLMQ_QUEUES } from '@src/infrastructure/bullmq/bullmq.constants';
import {
  CapabilityAnchorProvider,
  CapabilityQueueBindingProvider,
  CapabilityRuntimeContributionProvider,
} from '@src/infrastructure/capability/capability.decorators';
import { AI_QUEUE_CAPABILITY_ID } from './ai-capability.constants';

@Injectable()
@CapabilityAnchorProvider({
  capabilityId: AI_QUEUE_CAPABILITY_ID,
  mode: 'switchable',
  decisionRef: 'docs/capabilities/current.md',
})
@CapabilityRuntimeContributionProvider({
  capabilityId: AI_QUEUE_CAPABILITY_ID,
  contributions: {
    queues: [
      {
        operation: 'generate',
        operationKind: 'command',
        queueName: BULLMQ_QUEUES.AI,
        jobName: BULLMQ_JOBS.AI.GENERATE,
        dedupKeyMapping: 'jobId',
      },
      {
        operation: 'embed',
        operationKind: 'command',
        queueName: BULLMQ_QUEUES.AI,
        jobName: BULLMQ_JOBS.AI.EMBED,
        dedupKeyMapping: 'jobId',
      },
      {
        operation: 'workflow',
        operationKind: 'command',
        queueName: BULLMQ_QUEUES.AI,
        jobName: BULLMQ_JOBS.AI.WORKFLOW,
        dedupKeyMapping: 'jobId',
      },
    ],
  },
})
export class AiQueueCapabilityAnchor {}

@Injectable()
@CapabilityQueueBindingProvider({
  capabilityId: AI_QUEUE_CAPABILITY_ID,
  operation: 'generate',
  operationKind: 'command',
  queueName: BULLMQ_QUEUES.AI,
  jobName: BULLMQ_JOBS.AI.GENERATE,
  dedupKeyMapping: 'jobId',
})
export class AiQueueGenerateBindingDeclaration {}

@Injectable()
@CapabilityQueueBindingProvider({
  capabilityId: AI_QUEUE_CAPABILITY_ID,
  operation: 'embed',
  operationKind: 'command',
  queueName: BULLMQ_QUEUES.AI,
  jobName: BULLMQ_JOBS.AI.EMBED,
  dedupKeyMapping: 'jobId',
})
export class AiQueueEmbedBindingDeclaration {}

@Injectable()
@CapabilityQueueBindingProvider({
  capabilityId: AI_QUEUE_CAPABILITY_ID,
  operation: 'workflow',
  operationKind: 'command',
  queueName: BULLMQ_QUEUES.AI,
  jobName: BULLMQ_JOBS.AI.WORKFLOW,
  dedupKeyMapping: 'jobId',
})
export class AiQueueWorkflowBindingDeclaration {}
