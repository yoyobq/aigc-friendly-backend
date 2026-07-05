import type { CapabilityError } from '@app-types/common/capability.types';
import { Inject, Injectable } from '@nestjs/common';
import { restoreCapabilityEnvelope } from '@src/infrastructure/bullmq/contracts/capability-queue.runtime';
import {
  CAPABILITY_QUEUE_CONSUMER,
  type CapabilityQueueConsumer,
} from '@src/usecases/common/ports/capability-bus.contract';
import {
  CAPABILITY_REQUEST_CONTEXT_STORE,
  type CapabilityRequestContextStore,
} from '@src/usecases/common/ports/capability-request-context-store.contract';
import type { CapabilityDispatchJob, CapabilityDispatchResult } from './capability-dispatch.mapper';

@Injectable()
export class CapabilityDispatchHandler {
  constructor(
    @Inject(CAPABILITY_QUEUE_CONSUMER)
    private readonly queueConsumer: CapabilityQueueConsumer,
    @Inject(CAPABILITY_REQUEST_CONTEXT_STORE)
    private readonly requestContextStore: CapabilityRequestContextStore,
  ) {}

  async process(input: { readonly job: CapabilityDispatchJob }): Promise<CapabilityDispatchResult> {
    const envelope = restoreCapabilityEnvelope(input.job.data);
    if (envelope.operationKind !== 'command') {
      throw new Error(
        `Unsupported capability queue operation kind in P4 queue command transport: ${envelope.operationKind}`,
      );
    }
    return await this.requestContextStore.run(envelope.context, async () => {
      const result = await this.queueConsumer.consume(envelope);
      if (!result.ok) {
        throw capabilityErrorToWorkerError(result.error);
      }
      return { ok: true };
    });
  }
}

function capabilityErrorToWorkerError(error: CapabilityError): Error {
  const serializedDetails = serializeCapabilityErrorDetails(error.details);
  const workerError = new Error(
    serializedDetails
      ? `${error.code}:${error.message}:${serializedDetails}`
      : `${error.code}:${error.message}`,
    { cause: error },
  );
  workerError.name = 'CapabilityDispatchError';
  return workerError;
}

function serializeCapabilityErrorDetails(details: unknown): string | null {
  if (details === undefined) {
    return null;
  }
  try {
    return JSON.stringify(details);
  } catch {
    if (
      typeof details === 'string' ||
      typeof details === 'number' ||
      typeof details === 'boolean' ||
      typeof details === 'bigint'
    ) {
      return String(details);
    }
    if (typeof details === 'symbol') {
      return details.description ?? 'symbol';
    }
    return '[unserializable]';
  }
}
