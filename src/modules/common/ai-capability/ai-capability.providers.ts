// src/modules/common/ai-capability/ai-capability.providers.ts
import { Injectable } from '@nestjs/common';
import { BULLMQ_JOBS, BULLMQ_QUEUES } from '@src/infrastructure/bullmq/bullmq.constants';
import {
  CapabilityOwnershipProvider,
  CapabilityQueueBindingProvider,
  CapabilityRuntimeManifestProvider,
} from '@src/infrastructure/capability/capability.decorators';
import {
  AI_LOCAL_MOCK_CAPABILITY_ID,
  AI_OPENAI_CAPABILITY_ID,
  AI_QUEUE_CAPABILITY_ID,
  AI_QWEN_CAPABILITY_ID,
} from './ai-capability.constants';

@Injectable()
@CapabilityOwnershipProvider({
  capabilityId: AI_QUEUE_CAPABILITY_ID,
  kind: 'technical',
  semanticScope: 'Admission and transport of AI generate, embed, and workflow queue jobs.',
  owns: ['AI generate, embed and workflow queue admission and transport.'],
  nonGoals: ['AI provider execution.', 'AI workflow state.'],
  physicalScopes: [
    { path: 'src/modules/common/ai-queue', role: 'primary' },
    { path: 'src/usecases/ai-queue', role: 'primary' },
    {
      path: 'src/modules/common/ai-capability',
      role: 'shared-implementation',
      reason: 'Shared ownership and runtime declaration assembly for AI queue and providers.',
    },
  ],
  publicSurfaces: [{ status: 'present', path: 'src/modules/common/ai-queue/ai-queue.types.ts' }],
  allowedDependencies: ['platform.async-task-audit'],
  foundationClassification: 'shared-technical-foundation',
  validationEntrypoints: ['test/08-qm-worker/ai-graphql-queue.e2e-spec.ts'],
})
export class AiQueueCapabilityOwnership {}

@Injectable()
@CapabilityRuntimeManifestProvider({
  capabilityId: AI_QUEUE_CAPABILITY_ID,
  version: '0.1.0',
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
export class AiQueueRuntimeManifest {}

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
@CapabilityOwnershipProvider({
  capabilityId: AI_LOCAL_MOCK_CAPABILITY_ID,
  kind: 'technical',
  semanticScope: 'Deterministic local AI provider implementation for non-live execution.',
  owns: ['Mock AI provider binding and health lifecycle.'],
  nonGoals: ['AI queue ownership.', 'AI workflow ownership.'],
  physicalScopes: [
    { path: 'src/infrastructure/ai/providers/local', role: 'primary' },
    {
      path: 'src/modules/common/ai-capability',
      role: 'shared-implementation',
      reason: 'Shared ownership declaration assembly for AI providers.',
    },
  ],
  publicSurfaces: [
    {
      status: 'not-required',
      reason: 'Consumers select the provider through the AI provider registry.',
    },
  ],
  allowedDependencies: [],
  foundationClassification: 'shared-technical-foundation',
  validationEntrypoints: ['test/08-qm-worker/ai-worker-consume-persistence.e2e-spec.ts'],
})
export class AiLocalMockCapabilityOwnership {}

@Injectable()
@CapabilityOwnershipProvider({
  capabilityId: AI_OPENAI_CAPABILITY_ID,
  kind: 'technical',
  semanticScope: 'OpenAI provider configuration, invocation binding, and health reporting.',
  owns: ['OpenAI provider binding, configuration and health lifecycle.'],
  nonGoals: ['AI queue ownership.', 'AI workflow ownership.'],
  physicalScopes: [
    { path: 'src/infrastructure/ai/providers/openai', role: 'primary' },
    {
      path: 'src/modules/common/ai-capability',
      role: 'shared-implementation',
      reason: 'Shared ownership declaration assembly for AI providers.',
    },
  ],
  publicSurfaces: [
    {
      status: 'not-required',
      reason: 'Consumers select the provider through the AI provider registry.',
    },
  ],
  allowedDependencies: [],
  foundationClassification: 'shared-technical-foundation',
  validationEntrypoints: ['test/99-third-party-live-smoke/ai-qwen-generate-real.e2e-spec.ts'],
})
export class AiOpenAiCapabilityOwnership {}

@Injectable()
@CapabilityOwnershipProvider({
  capabilityId: AI_QWEN_CAPABILITY_ID,
  kind: 'technical',
  semanticScope: 'Qwen provider configuration, invocation binding, and health reporting.',
  owns: ['Qwen provider binding, configuration and health lifecycle.'],
  nonGoals: ['AI queue ownership.', 'AI workflow ownership.'],
  physicalScopes: [
    { path: 'src/infrastructure/ai/providers/qwen', role: 'primary' },
    {
      path: 'src/modules/common/ai-capability',
      role: 'shared-implementation',
      reason: 'Shared ownership declaration assembly for AI providers.',
    },
  ],
  publicSurfaces: [
    {
      status: 'not-required',
      reason: 'Consumers select the provider through the AI provider registry.',
    },
  ],
  allowedDependencies: [],
  foundationClassification: 'shared-technical-foundation',
  validationEntrypoints: ['test/99-third-party-live-smoke/ai-qwen-generate-real.e2e-spec.ts'],
})
export class AiQwenCapabilityOwnership {}
