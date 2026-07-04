/// <reference types="jest" />
// src/modules/common/ai-queue/ai-queue.service.spec.ts
import { BULLMQ_JOBS, BULLMQ_QUEUES } from '@src/infrastructure/bullmq/bullmq.constants';
import {
  BullMqProducerGateway,
  type EnqueueJobInput,
  type EnqueueJobResult,
} from '@src/infrastructure/bullmq/producer.gateway';
import type { PinoLogger } from 'nestjs-pino';
import { AiQueueService } from './ai-queue.service';

type AiJobName = (typeof BULLMQ_JOBS.AI)[keyof typeof BULLMQ_JOBS.AI];
type AiProducerEnqueueInput = EnqueueJobInput<typeof BULLMQ_QUEUES.AI, AiJobName>;
type AiProducerEnqueueResult = EnqueueJobResult<typeof BULLMQ_QUEUES.AI, AiJobName>;

interface ProducerMock {
  readonly enqueue: jest.Mock<Promise<AiProducerEnqueueResult>, [AiProducerEnqueueInput]>;
  readonly hasJob: jest.Mock<
    Promise<{
      readonly queueName: typeof BULLMQ_QUEUES.AI;
      readonly jobId: string;
      readonly exists: boolean;
    }>,
    [{ readonly queueName: typeof BULLMQ_QUEUES.AI; readonly jobId: string }]
  >;
  readonly checkQueueAvailable: jest.Mock<
    Promise<{ readonly queueName: typeof BULLMQ_QUEUES.AI; readonly available: true }>,
    [{ readonly queueName: typeof BULLMQ_QUEUES.AI }]
  >;
}

describe('AiQueueService', () => {
  const createHarness = () => {
    const producer: ProducerMock = {
      enqueue: jest.fn().mockResolvedValue({
        queueName: BULLMQ_QUEUES.AI,
        jobName: BULLMQ_JOBS.AI.WORKFLOW,
        jobId: 'workflow-job-1',
        traceId: 'trace-1',
      }),
      hasJob: jest.fn().mockResolvedValue({
        queueName: BULLMQ_QUEUES.AI,
        jobId: 'workflow-job-1',
        exists: true,
      }),
      checkQueueAvailable: jest.fn().mockResolvedValue({
        queueName: BULLMQ_QUEUES.AI,
        available: true,
      }),
    };
    const logger = {
      setContext: jest.fn(),
      info: jest.fn(),
    };
    const service = new AiQueueService(
      producer as unknown as BullMqProducerGateway,
      logger as unknown as PinoLogger,
    );
    return { logger, producer, service };
  };

  it('enqueues workflow job with explicit jobId and without dedupKey', async () => {
    const { producer, service } = createHarness();

    await expect(
      service.enqueueWorkflow({
        workflowId: 'workflow-1',
        traceId: 'trace-1',
        jobId: 'workflow-job-1',
      }),
    ).resolves.toEqual({
      jobId: 'workflow-job-1',
      traceId: 'trace-1',
    });

    expect(producer.enqueue).toHaveBeenCalledWith({
      queueName: BULLMQ_QUEUES.AI,
      jobName: BULLMQ_JOBS.AI.WORKFLOW,
      payload: {
        workflowId: 'workflow-1',
        traceId: 'trace-1',
      },
      explicitJobId: 'workflow-job-1',
      traceId: 'trace-1',
    });
    expect(producer.enqueue.mock.calls[0]?.[0]).not.toHaveProperty('dedupKey');
  });

  it('checks workflow job existence with plain result', async () => {
    const { producer, service } = createHarness();

    await expect(service.hasWorkflowJob({ jobId: 'workflow-job-1' })).resolves.toEqual({
      jobId: 'workflow-job-1',
      exists: true,
    });
    expect(producer.hasJob).toHaveBeenCalledWith({
      queueName: BULLMQ_QUEUES.AI,
      jobId: 'workflow-job-1',
    });
  });

  it('checks workflow queue health with plain result', async () => {
    const { producer, service } = createHarness();

    await expect(service.checkWorkflowQueueAvailable()).resolves.toEqual({
      available: true,
    });
    expect(producer.checkQueueAvailable).toHaveBeenCalledWith({
      queueName: BULLMQ_QUEUES.AI,
    });
  });

  it('maps workflow queue health failures to unavailable result', async () => {
    const { producer, service } = createHarness();
    producer.checkQueueAvailable.mockRejectedValueOnce(new Error('redis unavailable'));

    await expect(service.checkWorkflowQueueAvailable()).resolves.toEqual({
      available: false,
      reason: 'QUEUE_UNAVAILABLE',
    });
  });

  it('rethrows local workflow queue registration failures', async () => {
    const { producer, service } = createHarness();
    const error = new Error(`BullMQ queue is not registered: ${BULLMQ_QUEUES.AI}`);
    producer.checkQueueAvailable.mockRejectedValueOnce(error);

    await expect(service.checkWorkflowQueueAvailable()).rejects.toBe(error);
  });

  it('keeps generate and embed enqueue paths unchanged', async () => {
    const { producer, service } = createHarness();

    await service.enqueueGenerate({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      prompt: 'hello',
      metadata: { scope: 'unit' },
      dedupKey: 'dedup-1',
      traceId: 'trace-generate',
    });
    await service.enqueueEmbed({
      model: 'text-embedding-3-small',
      text: 'hello',
      metadata: { scope: 'unit' },
      dedupKey: 'dedup-2',
      traceId: 'trace-embed',
    });

    expect(producer.enqueue).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        jobName: BULLMQ_JOBS.AI.GENERATE,
        dedupKey: 'dedup-1',
      }),
    );
    expect(producer.enqueue).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        jobName: BULLMQ_JOBS.AI.EMBED,
        dedupKey: 'dedup-2',
      }),
    );
  });
});
