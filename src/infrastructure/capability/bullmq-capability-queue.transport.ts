import type {
  CapabilityCommand,
  CapabilityEvent,
  CapabilityResult,
} from '@app-types/common/capability.types';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { BullMqQueueName } from '@src/infrastructure/bullmq/bullmq.constants';
import type {
  BullMqJobName,
  BullMqJobPayload,
} from '@src/infrastructure/bullmq/contracts/job-contract.registry';
import { BullMqProducerGateway } from '@src/infrastructure/bullmq/producer.gateway';
import type {
  CapabilityQueueTransport,
  CapabilityQueueTransportDescriptor,
  CapabilityQueueTransportResult,
} from '@src/usecases/common/ports/capability-bus.contract';
import { mapThrownErrorToCapabilityError } from './capability-error.mapper';
import { serializeCapabilityEnvelope } from './capability-envelope.codec';

@Injectable()
export class BullMqCapabilityQueueTransport implements CapabilityQueueTransport {
  constructor(private readonly moduleRef: ModuleRef) {}

  async enqueue<TPayload>(
    envelope: CapabilityCommand<TPayload> | CapabilityEvent<TPayload>,
    descriptor: CapabilityQueueTransportDescriptor,
  ): Promise<CapabilityResult<CapabilityQueueTransportResult>> {
    const producer = this.resolveProducer();
    if (!producer) {
      return {
        ok: false,
        error: {
          code: 'CAPABILITY_TRANSPORT_UNAVAILABLE',
          message: 'capability_queue_producer_unavailable',
          capabilityId: envelope.capability,
          operation: envelope.operation,
        },
      };
    }

    try {
      const queueName = descriptor.queueName as BullMqQueueName;
      const jobName = descriptor.jobName as BullMqJobName<typeof queueName>;
      const payload = serializeCapabilityEnvelope(envelope) as BullMqJobPayload<
        typeof queueName,
        typeof jobName
      >;
      const result = await producer.enqueue({
        queueName,
        jobName,
        payload,
        traceId: envelope.context.traceId,
        dedupKey: resolveDedupKey({ envelope, descriptor }),
      });
      return {
        ok: true,
        value: {
          queueName: result.queueName,
          jobName: result.jobName,
          jobId: result.jobId,
          traceId: result.traceId,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: mapThrownErrorToCapabilityError({
          error,
          capabilityId: envelope.capability,
          operation: envelope.operation,
          defaultDomainErrorCode: 'CAPABILITY_TRANSPORT_UNAVAILABLE',
        }),
      };
    }
  }

  private resolveProducer(): BullMqProducerGateway | null {
    try {
      return this.moduleRef.get(BullMqProducerGateway, { strict: false });
    } catch {
      return null;
    }
  }
}

function resolveDedupKey(input: {
  readonly envelope: CapabilityCommand<unknown> | CapabilityEvent<unknown>;
  readonly descriptor: CapabilityQueueTransportDescriptor;
}): string | undefined {
  if (input.descriptor.dedupKeyMapping === 'jobId') {
    return input.envelope.dedupKey;
  }
  return undefined;
}
