import {
  AI_QUEUE_NAME,
  AI_GENERATE_JOB_NAME,
  AI_EMBED_JOB_NAME,
  AI_WORKFLOW_QUEUE_NAME,
  AI_WORKFLOW_JOB_NAME,
} from '@app-types/common/ai-queue.types';
// src/infrastructure/bullmq/bullmq.constants.ts
export const BULLMQ_QUEUES = {
  EMAIL: 'email',
  AI: AI_QUEUE_NAME,
  AI_WORKFLOW: AI_WORKFLOW_QUEUE_NAME,
} as const;

export type BullMqQueueName = (typeof BULLMQ_QUEUES)[keyof typeof BULLMQ_QUEUES];

export const BULLMQ_JOBS = {
  EMAIL: {
    SEND: 'send',
  },
  AI: {
    GENERATE: AI_GENERATE_JOB_NAME,
    EMBED: AI_EMBED_JOB_NAME,
    WORKFLOW: AI_WORKFLOW_JOB_NAME,
  },
} as const;

export type BullMqEmailJobName = (typeof BULLMQ_JOBS.EMAIL)[keyof typeof BULLMQ_JOBS.EMAIL];
export type BullMqAiJobName = (typeof BULLMQ_JOBS.AI)[keyof typeof BULLMQ_JOBS.AI];
export const BULLMQ_QUEUE_JOBS: Readonly<Record<BullMqQueueName, ReadonlyArray<string>>> = {
  [BULLMQ_QUEUES.EMAIL]: Object.values(BULLMQ_JOBS.EMAIL),
  [BULLMQ_QUEUES.AI]: [BULLMQ_JOBS.AI.GENERATE, BULLMQ_JOBS.AI.EMBED],
  [BULLMQ_QUEUES.AI_WORKFLOW]: [BULLMQ_JOBS.AI.WORKFLOW],
};
