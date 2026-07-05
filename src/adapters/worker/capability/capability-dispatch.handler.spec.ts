import type {
  CapabilityCommand,
  CapabilityRequestContext,
  CapabilityResult,
} from '@app-types/common/capability.types';
import { serializeCapabilityEnvelope } from '@src/infrastructure/capability/capability-envelope.codec';
import type { CapabilityQueueConsumer } from '@src/usecases/common/ports/capability-bus.contract';
import type { CapabilityRequestContextStore } from '@src/usecases/common/ports/capability-request-context-store.contract';
import { CapabilityDispatchHandler } from './capability-dispatch.handler';
import {
  CAPABILITY_DISPATCH_JOB_NAME,
  type CapabilityDispatchJob,
} from './capability-dispatch.mapper';

class QueueConsumerStub implements CapabilityQueueConsumer {
  readonly consumeMock: jest.Mock<
    Promise<CapabilityResult<unknown>>,
    [CapabilityCommand<unknown>]
  > = jest.fn();

  consume<TPayload, TResult>(
    envelope: CapabilityCommand<TPayload>,
  ): Promise<CapabilityResult<TResult>> {
    return this.consumeMock(envelope) as Promise<CapabilityResult<TResult>>;
  }
}

class RequestContextStoreStub implements CapabilityRequestContextStore {
  private current: CapabilityRequestContext | null = null;
  readonly runMock: jest.Mock<void, [CapabilityRequestContext]> = jest.fn();

  getCurrent(): CapabilityRequestContext | null {
    return this.current;
  }

  requireCurrent(): CapabilityRequestContext {
    if (!this.current) {
      throw new Error('capability_request_context_missing');
    }
    return this.current;
  }

  async run<TResult>(
    context: CapabilityRequestContext,
    callback: () => Promise<TResult> | TResult,
  ): Promise<TResult> {
    this.runMock(context);
    this.current = context;
    try {
      return await callback();
    } finally {
      this.current = null;
    }
  }
}

describe('CapabilityDispatchHandler', () => {
  it('restores queue envelope context before consuming command', async () => {
    const consumer = new QueueConsumerStub();
    const store = new RequestContextStoreStub();
    const handler = new CapabilityDispatchHandler(consumer, store);
    consumer.consumeMock.mockResolvedValue({ ok: true, value: { done: true } });
    const envelope = commandEnvelope();

    await expect(handler.process({ job: buildJob(envelope) })).resolves.toEqual({ ok: true });

    expect(store.runMock).toHaveBeenCalledWith(envelope.context);
    expect(consumer.consumeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: 'test.worker',
        operation: 'run',
        operationKind: 'command',
        payload: { id: 'item-1' },
      }),
    );
  });

  it('throws worker error when capability consumer returns failure', async () => {
    const consumer = new QueueConsumerStub();
    const store = new RequestContextStoreStub();
    const handler = new CapabilityDispatchHandler(consumer, store);
    consumer.consumeMock.mockResolvedValue({
      ok: false,
      error: {
        code: 'CAPABILITY_DISABLED',
        message: 'capability_disabled',
        capabilityId: 'test.worker',
        operation: 'run',
        details: { reason: 'kill_switch' },
      },
    });

    await expect(handler.process({ job: buildJob(commandEnvelope()) })).rejects.toThrow(
      'CAPABILITY_DISABLED:capability_disabled:{"reason":"kill_switch"}',
    );
  });

  it('rejects non-command envelopes', async () => {
    const consumer = new QueueConsumerStub();
    const store = new RequestContextStoreStub();
    const handler = new CapabilityDispatchHandler(consumer, store);
    const queryEnvelope = {
      ...commandEnvelope(),
      operationKind: 'query' as const,
    };

    await expect(handler.process({ job: buildJob(queryEnvelope) })).rejects.toThrow(
      'Unsupported capability queue operation kind in P4 queue command transport: query',
    );
    expect(consumer.consumeMock).not.toHaveBeenCalled();
  });
});

function commandEnvelope(): CapabilityCommand<{ readonly id: string }> {
  return {
    capability: 'test.worker',
    operation: 'run',
    operationKind: 'command',
    context: {
      traceId: 'trace-1',
      requestId: 'request-1',
      actor: {
        source: 'account',
        accountId: 1,
        accessGroup: ['STAFF'],
      },
      entryPoint: 'worker',
    },
    payload: { id: 'item-1' },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function buildJob(
  envelope:
    | CapabilityCommand<{ readonly id: string }>
    | (Omit<CapabilityCommand<{ readonly id: string }>, 'operationKind'> & {
        readonly operationKind: 'query';
      }),
): CapabilityDispatchJob {
  return {
    id: 'job-1',
    name: CAPABILITY_DISPATCH_JOB_NAME,
    data: serializeCapabilityEnvelope(envelope),
  } as CapabilityDispatchJob;
}
