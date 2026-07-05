import { BULLMQ_JOBS, BULLMQ_QUEUES } from '@src/infrastructure/bullmq/bullmq.constants';
import type { CapabilityDispatchJobPayload } from '@src/infrastructure/bullmq/contracts/capability-queue.runtime';
import type { Job } from 'bullmq';

export const CAPABILITY_QUEUE_NAME = BULLMQ_QUEUES.CAPABILITY;
export const CAPABILITY_DISPATCH_JOB_NAME = BULLMQ_JOBS.CAPABILITY.DISPATCH;

export interface CapabilityDispatchResult {
  readonly ok: true;
}

export type CapabilityDispatchJob = Job<
  CapabilityDispatchJobPayload,
  CapabilityDispatchResult,
  typeof CAPABILITY_DISPATCH_JOB_NAME
>;

export type CapabilityJob = Job<CapabilityDispatchJobPayload, CapabilityDispatchResult, string>;

export function isCapabilityDispatchJob(job: CapabilityJob): job is CapabilityDispatchJob {
  return job.name === CAPABILITY_DISPATCH_JOB_NAME;
}
