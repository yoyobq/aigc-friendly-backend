import type {
  CapabilityActorContext,
  CapabilityCommand,
  CapabilityEvent,
  CapabilityId,
  CapabilityOperationKind,
  CapabilityQuery,
  CapabilityRequestContext,
} from '@app-types/common/capability.types';
import { BULLMQ_JOBS } from '../bullmq.constants';

export interface SerializedCapabilityRequestContext extends Omit<
  CapabilityRequestContext,
  'actor'
> {
  readonly actor: CapabilityActorContext;
}

export interface SerializedCapabilityEnvelope {
  readonly capability: CapabilityId;
  readonly operation: string;
  readonly operationKind: CapabilityOperationKind;
  readonly operationVersion?: string;
  readonly context: SerializedCapabilityRequestContext;
  readonly idempotencyKey?: string;
  readonly dedupKey?: string;
  readonly payload: unknown;
  readonly createdAt: string;
  readonly eventId?: string;
  readonly occurredAt?: string;
}

export interface CapabilityDispatchJobPayload {
  readonly envelope: SerializedCapabilityEnvelope;
  readonly traceId: string;
  readonly requestId: string;
}

export const CAPABILITY_JOB_CONTRACT = {
  [BULLMQ_JOBS.CAPABILITY.DISPATCH]: {
    payload: {} as CapabilityDispatchJobPayload,
    result: {} as { readonly ok: boolean },
    payloadValidator: isCapabilityDispatchJobPayload,
  },
} as const;

function isCapabilityDispatchJobPayload(value: unknown): value is CapabilityDispatchJobPayload {
  if (!isObjectRecord(value)) {
    return false;
  }
  return (
    isSerializedCapabilityEnvelope(value.envelope) &&
    typeof value.traceId === 'string' &&
    value.traceId.trim().length > 0 &&
    typeof value.requestId === 'string' &&
    value.requestId.trim().length > 0
  );
}

function isSerializedCapabilityEnvelope(value: unknown): value is SerializedCapabilityEnvelope {
  if (!isObjectRecord(value)) {
    return false;
  }
  return (
    typeof value.capability === 'string' &&
    typeof value.operation === 'string' &&
    isCapabilityOperationKind(value.operationKind) &&
    isSerializedRequestContext(value.context) &&
    typeof value.createdAt === 'string' &&
    !Number.isNaN(Date.parse(value.createdAt))
  );
}

function isSerializedRequestContext(value: unknown): value is SerializedCapabilityRequestContext {
  if (!isObjectRecord(value)) {
    return false;
  }
  return (
    typeof value.traceId === 'string' &&
    value.traceId.trim().length > 0 &&
    typeof value.requestId === 'string' &&
    value.requestId.trim().length > 0 &&
    isObjectRecord(value.actor) &&
    typeof value.actor.source === 'string'
  );
}

function isCapabilityOperationKind(value: unknown): value is CapabilityOperationKind {
  return value === 'command' || value === 'query' || value === 'event';
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function restoreCapabilityEnvelope(
  payload: CapabilityDispatchJobPayload,
): CapabilityCommand<unknown> | CapabilityQuery<unknown> | CapabilityEvent<unknown> {
  const base = {
    capability: payload.envelope.capability,
    operation: payload.envelope.operation,
    operationKind: payload.envelope.operationKind,
    ...(payload.envelope.operationVersion === undefined
      ? {}
      : { operationVersion: payload.envelope.operationVersion }),
    context: payload.envelope.context,
    ...(payload.envelope.idempotencyKey === undefined
      ? {}
      : { idempotencyKey: payload.envelope.idempotencyKey }),
    ...(payload.envelope.dedupKey === undefined ? {} : { dedupKey: payload.envelope.dedupKey }),
    payload: payload.envelope.payload,
    createdAt: new Date(payload.envelope.createdAt),
  };
  if (payload.envelope.operationKind === 'event') {
    return {
      ...base,
      operationKind: 'event',
      eventId: payload.envelope.eventId ?? payload.envelope.context.requestId,
      occurredAt: new Date(payload.envelope.occurredAt ?? payload.envelope.createdAt),
    };
  }
  return payload.envelope.operationKind === 'command'
    ? { ...base, operationKind: 'command' }
    : { ...base, operationKind: 'query' };
}
