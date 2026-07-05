// src/modules/common/ai-capability/ai-capability.providers.ts
import { Injectable } from '@nestjs/common';
import { BULLMQ_JOBS, BULLMQ_QUEUES } from '@src/infrastructure/bullmq/bullmq.constants';
import {
  CapabilityManifestProvider,
  CapabilityQueueBindingProvider,
} from '@src/infrastructure/capability/capability.decorators';
import { AI_PROVIDER_KIND, AI_QUEUE_CAPABILITY_ID } from './ai-capability.constants';

@Injectable()
@CapabilityManifestProvider({
  id: AI_QUEUE_CAPABILITY_ID,
  kind: 'technical',
  version: '0.1.0',
  processes: ['api', 'worker'],
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
export class AiQueueCapabilityDeclaration {}

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

@Injectable()
@CapabilityManifestProvider({
  id: 'ai.local-mock',
  kind: 'technical',
  version: '0.1.0',
  processes: ['worker'],
  contributions: {
    providers: [{ providerKind: AI_PROVIDER_KIND, providerName: 'mock' }],
  },
})
export class AiLocalMockCapabilityDeclaration {}

@Injectable()
@CapabilityManifestProvider({
  id: 'ai.openai',
  kind: 'technical',
  version: '0.1.0',
  processes: ['worker'],
  contributions: {
    providers: [{ providerKind: AI_PROVIDER_KIND, providerName: 'openai' }],
  },
})
export class AiOpenAiCapabilityDeclaration {}

@Injectable()
@CapabilityManifestProvider({
  id: 'ai.qwen',
  kind: 'technical',
  version: '0.1.0',
  processes: ['worker'],
  contributions: {
    providers: [{ providerKind: AI_PROVIDER_KIND, providerName: 'qwen' }],
  },
})
export class AiQwenCapabilityDeclaration {}
