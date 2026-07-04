// src/adapters/worker/ai/ai-job.processor.ts
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { isAiWorkflowNonRetryableError } from '@src/usecases/ai-worker/ai-workflow-worker-errors';
import { UnrecoverableError } from 'bullmq';
import { AiJobHandler } from './ai-job.handler';
import {
  AI_EMBED_JOB_NAME,
  type AiFailedJob,
  AI_GENERATE_JOB_NAME,
  AI_QUEUE_NAME,
  AI_WORKFLOW_JOB_NAME,
  type AiJob,
  type AiJobResult,
} from './ai-job.mapper';

@Injectable()
@Processor(AI_QUEUE_NAME)
export class AiJobProcessor extends WorkerHost {
  constructor(private readonly handler: AiJobHandler) {
    super();
  }

  async process(job: AiJob): Promise<AiJobResult> {
    if (job.name === AI_GENERATE_JOB_NAME) {
      return await this.handler.processGenerate({ job });
    }
    if (job.name === AI_EMBED_JOB_NAME) {
      return await this.handler.processEmbed({ job });
    }
    if (job.name === AI_WORKFLOW_JOB_NAME) {
      try {
        return await this.handler.processWorkflow({ job });
      } catch (error: unknown) {
        if (isAiWorkflowNonRetryableError(error)) {
          throw new UnrecoverableError(error.message);
        }
        throw error;
      }
    }
    throw new Error('Unsupported AI job');
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: AiJob): Promise<void> {
    if (job.name === AI_GENERATE_JOB_NAME) {
      await this.handler.onGenerateCompleted({ job });
      return;
    }
    if (job.name === AI_EMBED_JOB_NAME) {
      await this.handler.onEmbedCompleted({ job });
      return;
    }
    if (job.name === AI_WORKFLOW_JOB_NAME) {
      await this.handler.onWorkflowCompleted({ job });
      return;
    }
    throw new Error('Unsupported AI job');
  }

  @OnWorkerEvent('failed')
  async onFailed(job: AiFailedJob | undefined, error: Error): Promise<void> {
    await this.handler.onFailed({ job, error });
  }
}
