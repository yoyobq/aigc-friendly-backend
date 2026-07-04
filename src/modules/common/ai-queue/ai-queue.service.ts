// src/modules/common/ai-queue/ai-queue.service.ts
import { Injectable } from '@nestjs/common';
import { BULLMQ_JOBS, BULLMQ_QUEUES } from '@src/infrastructure/bullmq/bullmq.constants';
import { BullMqProducerGateway } from '@src/infrastructure/bullmq/producer.gateway';
import { PinoLogger } from 'nestjs-pino';
import type {
  QueueAiEmbedInput,
  QueueAiGenerateInput,
  QueueAiResult,
  QueueAiWorkflowInput,
  QueueAiWorkflowJobExistenceInput,
  QueueAiWorkflowJobExistenceResult,
  QueueAiWorkflowQueueHealthResult,
} from './ai-queue.types';

const BULLMQ_QUEUE_NOT_REGISTERED_ERROR_PREFIX = 'BullMQ queue is not registered:';

@Injectable()
export class AiQueueService {
  constructor(
    private readonly producer: BullMqProducerGateway,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AiQueueService.name);
  }

  async enqueueGenerate(input: QueueAiGenerateInput): Promise<QueueAiResult> {
    const job = await this.producer.enqueue({
      queueName: BULLMQ_QUEUES.AI,
      jobName: BULLMQ_JOBS.AI.GENERATE,
      payload: {
        provider: input.provider,
        model: input.model,
        prompt: input.prompt,
        metadata: input.metadata,
      },
      dedupKey: input.dedupKey,
      traceId: input.traceId,
    });
    this.logger.info(
      {
        model: input.model,
        provider: input.provider,
        jobId: job.jobId,
        traceId: job.traceId,
      },
      'AI generate job accepted',
    );
    return {
      jobId: job.jobId,
      traceId: job.traceId,
    };
  }

  async enqueueEmbed(input: QueueAiEmbedInput): Promise<QueueAiResult> {
    const job = await this.producer.enqueue({
      queueName: BULLMQ_QUEUES.AI,
      jobName: BULLMQ_JOBS.AI.EMBED,
      payload: {
        model: input.model,
        text: input.text,
        metadata: input.metadata,
      },
      dedupKey: input.dedupKey,
      traceId: input.traceId,
    });
    this.logger.info(
      {
        model: input.model,
        jobId: job.jobId,
        traceId: job.traceId,
      },
      'AI embed job accepted',
    );
    return {
      jobId: job.jobId,
      traceId: job.traceId,
    };
  }

  async enqueueWorkflow(input: QueueAiWorkflowInput): Promise<QueueAiResult> {
    const job = await this.producer.enqueue({
      queueName: BULLMQ_QUEUES.AI,
      jobName: BULLMQ_JOBS.AI.WORKFLOW,
      payload: {
        workflowId: input.workflowId,
        traceId: input.traceId,
      },
      explicitJobId: input.jobId,
      traceId: input.traceId,
    });
    this.logger.info(
      {
        workflowId: input.workflowId,
        jobId: job.jobId,
        traceId: job.traceId,
      },
      'AI workflow job accepted',
    );
    return {
      jobId: job.jobId,
      traceId: job.traceId,
    };
  }

  async hasWorkflowJob(
    input: QueueAiWorkflowJobExistenceInput,
  ): Promise<QueueAiWorkflowJobExistenceResult> {
    const result = await this.producer.hasJob({
      queueName: BULLMQ_QUEUES.AI,
      jobId: input.jobId,
    });
    return {
      jobId: result.jobId,
      exists: result.exists,
    };
  }

  async checkWorkflowQueueAvailable(): Promise<QueueAiWorkflowQueueHealthResult> {
    try {
      await this.producer.checkQueueAvailable({
        queueName: BULLMQ_QUEUES.AI,
      });
      return { available: true };
    } catch (error: unknown) {
      if (isBullMqQueueRegistrationError(error)) {
        throw error;
      }
      return {
        available: false,
        reason: 'QUEUE_UNAVAILABLE',
      };
    }
  }
}

function isBullMqQueueRegistrationError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.startsWith(BULLMQ_QUEUE_NOT_REGISTERED_ERROR_PREFIX)
  );
}
