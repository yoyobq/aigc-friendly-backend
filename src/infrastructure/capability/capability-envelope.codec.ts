import type {
  CapabilityCommand,
  CapabilityEvent,
  CapabilityQuery,
} from '@app-types/common/capability.types';
import type {
  CapabilityDispatchJobPayload,
  SerializedCapabilityEnvelope,
} from '@src/infrastructure/bullmq/contracts/capability-queue.runtime';
export { restoreCapabilityEnvelope } from '@src/infrastructure/bullmq/contracts/capability-queue.runtime';

type RuntimeCapabilityEnvelope<TPayload> =
  CapabilityCommand<TPayload> | CapabilityQuery<TPayload> | CapabilityEvent<TPayload>;

export function serializeCapabilityEnvelope<TPayload>(
  envelope: RuntimeCapabilityEnvelope<TPayload>,
): CapabilityDispatchJobPayload {
  const serialized: SerializedCapabilityEnvelope = {
    capability: envelope.capability,
    operation: envelope.operation,
    operationKind: envelope.operationKind,
    ...(envelope.operationVersion === undefined
      ? {}
      : { operationVersion: envelope.operationVersion }),
    context: envelope.context,
    ...(envelope.idempotencyKey === undefined ? {} : { idempotencyKey: envelope.idempotencyKey }),
    ...(envelope.dedupKey === undefined ? {} : { dedupKey: envelope.dedupKey }),
    payload: envelope.payload,
    createdAt: envelope.createdAt.toISOString(),
    ...(isCapabilityEvent(envelope)
      ? { eventId: envelope.eventId, occurredAt: envelope.occurredAt.toISOString() }
      : {}),
  };
  return {
    envelope: serialized,
    traceId: envelope.context.traceId,
    requestId: envelope.context.requestId,
  };
}

function isCapabilityEvent<TPayload>(
  envelope: RuntimeCapabilityEnvelope<TPayload>,
): envelope is CapabilityEvent<TPayload> {
  return envelope.operationKind === 'event';
}
