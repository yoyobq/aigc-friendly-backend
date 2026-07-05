import type {
  CapabilityCommand,
  CapabilityError,
  CapabilityOperationDescriptor,
  CapabilityQuery,
  CapabilityRequestContext,
  CapabilityResult,
} from '@app-types/common/capability.types';
import { Inject, Injectable } from '@nestjs/common';
import {
  CAPABILITY_REQUEST_CONTEXT_STORE,
  type CapabilityRequestContextStore,
} from '@src/usecases/common/ports/capability-request-context-store.contract';
import {
  CAPABILITY_PERMISSION_CHECKER,
  type CapabilityCommandBus,
  type CapabilityCommandInput,
  type CapabilityPermissionChecker,
  type CapabilityQueryBus,
  type CapabilityQueryInput,
} from '@src/usecases/common/ports/capability-bus.contract';
import { mapThrownErrorToCapabilityError } from './capability-error.mapper';
import { CapabilityRegistry } from './capability.registry';

type CapabilityDispatchKind = 'command' | 'query';

@Injectable()
export class CapabilityDispatcher implements CapabilityCommandBus, CapabilityQueryBus {
  constructor(
    private readonly capabilityRegistry: CapabilityRegistry,
    @Inject(CAPABILITY_REQUEST_CONTEXT_STORE)
    private readonly requestContextStore: CapabilityRequestContextStore,
    @Inject(CAPABILITY_PERMISSION_CHECKER)
    private readonly permissionChecker: CapabilityPermissionChecker,
  ) {}

  async execute<TPayload, TResult>(
    command: CapabilityCommandInput<TPayload>,
  ): Promise<CapabilityResult<TResult>> {
    return await this.dispatch<TPayload, TResult>({
      input: command,
      operationKind: 'command',
    });
  }

  async ask<TPayload, TResult>(
    query: CapabilityQueryInput<TPayload>,
  ): Promise<CapabilityResult<TResult>> {
    return await this.dispatch<TPayload, TResult>({
      input: query,
      operationKind: 'query',
    });
  }

  private async dispatch<TPayload, TResult>(input: {
    readonly input: CapabilityCommandInput<TPayload> | CapabilityQueryInput<TPayload>;
    readonly operationKind: CapabilityDispatchKind;
  }): Promise<CapabilityResult<TResult>> {
    const descriptor = this.capabilityRegistry.getOperationDescriptor({
      capabilityId: input.input.capability,
      operation: input.input.operation,
      operationKind: input.operationKind,
    });
    if (!descriptor) {
      return failure({
        code: 'CAPABILITY_OPERATION_NOT_FOUND',
        message: 'capability_operation_not_found',
        capabilityId: input.input.capability,
        operation: input.input.operation,
      });
    }
    if (!descriptor.enabled) {
      return failure({
        code: 'CAPABILITY_OPERATION_DISABLED',
        message: 'capability_operation_disabled',
        capabilityId: input.input.capability,
        operation: input.input.operation,
      });
    }
    if (descriptor.transport !== 'in-process') {
      return failure({
        code: 'CAPABILITY_TRANSPORT_UNAVAILABLE',
        message: 'capability_transport_unavailable',
        capabilityId: input.input.capability,
        operation: input.input.operation,
      });
    }

    const context = this.resolveContext(input.input.context);
    if (!context) {
      return failure({
        code: 'CAPABILITY_INTERNAL_ERROR',
        message: 'capability_request_context_missing',
        capabilityId: input.input.capability,
        operation: input.input.operation,
      });
    }

    const envelope = buildEnvelope({
      input: input.input,
      operationKind: input.operationKind,
      context,
      descriptor,
    });
    const canAccess = await this.permissionChecker.canAccess({ descriptor, envelope });
    if (!canAccess) {
      return failure({
        code: 'CAPABILITY_PERMISSION_DENIED',
        message: 'capability_permission_denied',
        capabilityId: input.input.capability,
        operation: input.input.operation,
      });
    }

    const handler = this.capabilityRegistry.getOperationHandler({
      capabilityId: input.input.capability,
      operation: input.input.operation,
      operationKind: input.operationKind,
    });
    if (!handler) {
      return failure({
        code: 'CAPABILITY_OPERATION_NOT_FOUND',
        message: 'capability_operation_handler_not_found',
        capabilityId: input.input.capability,
        operation: input.input.operation,
      });
    }

    try {
      const result = await this.invokeHandler({ handler, envelope, descriptor });
      return result as CapabilityResult<TResult>;
    } catch (error) {
      return failure(
        mapThrownErrorToCapabilityError({
          error,
          capabilityId: input.input.capability,
          operation: input.input.operation,
        }),
      );
    }
  }

  private resolveContext(context?: CapabilityRequestContext): CapabilityRequestContext | null {
    return context ?? this.requestContextStore.getCurrent();
  }

  private async invokeHandler(input: {
    readonly handler: {
      handle(
        envelope: CapabilityCommand<unknown> | CapabilityQuery<unknown>,
        signal?: AbortSignal,
      ): Promise<CapabilityResult<unknown>>;
    };
    readonly envelope: CapabilityCommand<unknown> | CapabilityQuery<unknown>;
    readonly descriptor: CapabilityOperationDescriptor;
  }): Promise<CapabilityResult<unknown>> {
    if (!input.descriptor.timeoutMs) {
      return await input.handler.handle(input.envelope);
    }
    return await withTimeout({
      timeoutMs: input.descriptor.timeoutMs,
      run: () => input.handler.handle(input.envelope),
      timeoutError: {
        code: 'CAPABILITY_TIMEOUT',
        message: 'capability_timeout',
        capabilityId: input.envelope.capability,
        operation: input.envelope.operation,
      },
    });
  }
}

function buildEnvelope<TPayload>(input: {
  readonly input: CapabilityCommandInput<TPayload> | CapabilityQueryInput<TPayload>;
  readonly operationKind: CapabilityDispatchKind;
  readonly context: CapabilityRequestContext;
  readonly descriptor: CapabilityOperationDescriptor;
}): CapabilityCommand<unknown> | CapabilityQuery<unknown> {
  const envelope = {
    capability: input.input.capability,
    operation: input.input.operation,
    operationKind: input.operationKind,
    ...(input.input.operationVersion === undefined
      ? input.descriptor.operationVersion === undefined
        ? {}
        : { operationVersion: input.descriptor.operationVersion }
      : { operationVersion: input.input.operationVersion }),
    context: input.context,
    ...(input.input.idempotencyKey === undefined
      ? {}
      : { idempotencyKey: input.input.idempotencyKey }),
    ...(input.input.dedupKey === undefined ? {} : { dedupKey: input.input.dedupKey }),
    payload: input.input.payload,
    createdAt: input.input.createdAt ?? new Date(),
  };
  return input.operationKind === 'command'
    ? ({ ...envelope, operationKind: 'command' } satisfies CapabilityCommand<unknown>)
    : ({ ...envelope, operationKind: 'query' } satisfies CapabilityQuery<unknown>);
}

function failure<TResult>(error: CapabilityError): CapabilityResult<TResult> {
  return { ok: false, error };
}

function withTimeout(input: {
  readonly timeoutMs: number;
  readonly run: () => Promise<CapabilityResult<unknown>>;
  readonly timeoutError: CapabilityError;
}): Promise<CapabilityResult<unknown>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(failure(input.timeoutError));
    }, input.timeoutMs);
    input
      .run()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        resolve(failure(mapThrownErrorToCapabilityError({ error })));
      });
  });
}
