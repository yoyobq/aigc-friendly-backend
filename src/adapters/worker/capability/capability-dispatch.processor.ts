import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { CapabilityDispatchHandler } from './capability-dispatch.handler';
import {
  CAPABILITY_QUEUE_NAME,
  type CapabilityDispatchResult,
  type CapabilityJob,
  isCapabilityDispatchJob,
} from './capability-dispatch.mapper';

@Injectable()
@Processor(CAPABILITY_QUEUE_NAME)
export class CapabilityDispatchProcessor extends WorkerHost {
  constructor(private readonly handler: CapabilityDispatchHandler) {
    super();
  }

  async process(job: CapabilityJob): Promise<CapabilityDispatchResult> {
    if (!isCapabilityDispatchJob(job)) {
      throw new Error(`Unsupported capability job: ${job.name}`);
    }
    return await this.handler.process({ job });
  }
}
