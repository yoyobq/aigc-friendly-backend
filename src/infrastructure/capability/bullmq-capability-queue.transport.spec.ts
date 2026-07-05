import type { CapabilityCommand } from '@app-types/common/capability.types';
import { ModuleRef } from '@nestjs/core';
import { BULLMQ_JOBS, BULLMQ_QUEUES } from '@src/infrastructure/bullmq/bullmq.constants';
import type {
  EnqueueJobInput,
  EnqueueJobResult,
} from '@src/infrastructure/bullmq/producer.gateway';
import { BullMqCapabilityQueueTransport } from './bullmq-capability-queue.transport';

type CapabilityDispatchEnqueueInput = EnqueueJobInput<
  typeof BULLMQ_QUEUES.CAPABILITY,
  typeof BULLMQ_JOBS.CAPABILITY.DISPATCH
>;
type CapabilityDispatchEnqueueResult = EnqueueJobResult<
  typeof BULLMQ_QUEUES.CAPABILITY,
  typeof BULLMQ_JOBS.CAPABILITY.DISPATCH
>;

describe('BullMqCapabilityQueueTransport', () => {
  it('maps dedupKey to BullMQ jobId only when binding requests jobId mapping', async () => {
    const enqueue = jest.fn<
      Promise<CapabilityDispatchEnqueueResult>,
      [CapabilityDispatchEnqueueInput]
    >();
    enqueue.mockResolvedValue({
      queueName: BULLMQ_QUEUES.CAPABILITY,
      jobName: BULLMQ_JOBS.CAPABILITY.DISPATCH,
      jobId: 'dedup-1',
      traceId: 'trace-1',
    });
    const transport = new BullMqCapabilityQueueTransport(moduleRefWithProducer({ enqueue }));

    await expect(
      transport.enqueue(commandEnvelope(), {
        capabilityId: 'test.queue',
        operation: 'dispatch',
        operationKind: 'command',
        queueName: BULLMQ_QUEUES.CAPABILITY,
        jobName: BULLMQ_JOBS.CAPABILITY.DISPATCH,
        dedupKeyMapping: 'jobId',
      }),
    ).resolves.toMatchObject({ ok: true });

    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ dedupKey: 'dedup-1' }));
  });

  it('does not pass dedupKey for none or bullmq-dedup-option mapping', async () => {
    const enqueue = jest.fn<
      Promise<CapabilityDispatchEnqueueResult>,
      [CapabilityDispatchEnqueueInput]
    >();
    enqueue.mockResolvedValue({
      queueName: BULLMQ_QUEUES.CAPABILITY,
      jobName: BULLMQ_JOBS.CAPABILITY.DISPATCH,
      jobId: 'generated-job-1',
      traceId: 'trace-1',
    });
    const transport = new BullMqCapabilityQueueTransport(moduleRefWithProducer({ enqueue }));

    for (const dedupKeyMapping of ['none', 'bullmq-dedup-option'] as const) {
      await transport.enqueue(commandEnvelope(), {
        capabilityId: 'test.queue',
        operation: 'dispatch',
        operationKind: 'command',
        queueName: BULLMQ_QUEUES.CAPABILITY,
        jobName: BULLMQ_JOBS.CAPABILITY.DISPATCH,
        dedupKeyMapping,
      });
    }

    expect(enqueue).toHaveBeenNthCalledWith(1, expect.objectContaining({ dedupKey: undefined }));
    expect(enqueue).toHaveBeenNthCalledWith(2, expect.objectContaining({ dedupKey: undefined }));
  });
});

function moduleRefWithProducer(input: {
  readonly enqueue: (
    input: CapabilityDispatchEnqueueInput,
  ) => Promise<CapabilityDispatchEnqueueResult>;
}): ModuleRef {
  return {
    get: () => input,
  } as unknown as ModuleRef;
}

function commandEnvelope(): CapabilityCommand<{ readonly id: string }> {
  return {
    capability: 'test.queue',
    operation: 'dispatch',
    operationKind: 'command',
    context: {
      traceId: 'trace-1',
      requestId: 'request-1',
      actor: { source: 'system' },
    },
    dedupKey: 'dedup-1',
    payload: { id: 'item-1' },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}
