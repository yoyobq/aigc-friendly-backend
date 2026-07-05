import type {
  CapabilityCommand,
  CapabilityEvent,
  CapabilityId,
  CapabilityOperationDescriptor,
  CapabilityOperationKind,
  CapabilityQuery,
  CapabilityRequestContext,
  CapabilityResult,
} from '@app-types/common/capability.types';

export const CAPABILITY_COMMAND_BUS = Symbol('CAPABILITY_COMMAND_BUS');
export const CAPABILITY_QUERY_BUS = Symbol('CAPABILITY_QUERY_BUS');
export const CAPABILITY_PERMISSION_CHECKER = Symbol('CAPABILITY_PERMISSION_CHECKER');

export interface CapabilityDispatchInput<TPayload> {
  readonly capability: CapabilityId;
  readonly operation: string;
  readonly operationVersion?: string;
  readonly context?: CapabilityRequestContext;
  readonly idempotencyKey?: string;
  readonly dedupKey?: string;
  readonly payload: TPayload;
  readonly createdAt?: Date;
}

export type CapabilityCommandInput<TPayload> = CapabilityDispatchInput<TPayload>;

export type CapabilityQueryInput<TPayload> = CapabilityDispatchInput<TPayload>;

export interface CapabilityCommandBus {
  execute<TPayload, TResult>(
    command: CapabilityCommandInput<TPayload>,
  ): Promise<CapabilityResult<TResult>>;
}

export interface CapabilityQueryBus {
  ask<TPayload, TResult>(query: CapabilityQueryInput<TPayload>): Promise<CapabilityResult<TResult>>;
}

export interface CapabilityPermissionCheckInput<TPayload = unknown> {
  readonly descriptor: CapabilityOperationDescriptor;
  readonly envelope: CapabilityCommand<TPayload> | CapabilityQuery<TPayload>;
}

export interface CapabilityPermissionChecker {
  canAccess(input: CapabilityPermissionCheckInput): Promise<boolean>;
}

export interface CapabilityOperationHandler<TPayload = unknown, TResult = unknown> {
  readonly capability: CapabilityId;
  readonly operation: string;
  readonly operationKind: Exclude<CapabilityOperationKind, 'event'>;
  handle(
    envelope: CapabilityCommand<TPayload> | CapabilityQuery<TPayload>,
    signal?: AbortSignal,
  ): Promise<CapabilityResult<TResult>>;
}

export interface CapabilityQueueTransportDescriptor {
  readonly capabilityId: CapabilityId;
  readonly operation: string;
  readonly operationKind: CapabilityOperationKind;
  readonly queueName: string;
  readonly jobName: string;
  readonly dedupKeyMapping?: 'jobId' | 'bullmq-dedup-option' | 'none';
}

export interface CapabilityEventPublisher {
  publish<TPayload>(event: CapabilityEvent<TPayload>): Promise<CapabilityResult<void>>;
}

export interface CapabilityEventSubscriber<TPayload = unknown> {
  readonly capability: CapabilityId;
  readonly event: string;
  handle(event: CapabilityEvent<TPayload>): Promise<CapabilityResult<void>>;
}
