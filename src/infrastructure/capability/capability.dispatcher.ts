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
  CAPABILITY_QUEUE_TRANSPORT,
  type CapabilityCommandBus,
  type CapabilityCommandInput,
  type CapabilityPermissionChecker,
  type CapabilityQueueConsumer,
  type CapabilityQueueTransport,
  type CapabilityQueryBus,
  type CapabilityQueryInput,
} from '@src/usecases/common/ports/capability-bus.contract';
import {
  CAPABILITY_RUNTIME_STATE_READER,
  type CapabilityOperationRuntimeState,
  type CapabilityRuntimeStateReader,
} from '@src/usecases/common/ports/capability-runtime-state-reader.contract';
import { mapThrownErrorToCapabilityError } from './capability-error.mapper';
import { CapabilityRegistry } from './capability.registry';

type CapabilityDispatchKind = 'command' | 'query';
type CapabilityDispatchRequest<TPayload> =
  CapabilityCommandInput<TPayload> | CapabilityQueryInput<TPayload>;
type CapabilityDispatchEnvelope = CapabilityCommand<unknown> | CapabilityQuery<unknown>;

@Injectable()
export class CapabilityDispatcher
  implements CapabilityCommandBus, CapabilityQueryBus, CapabilityQueueConsumer
{
  constructor(
    private readonly capabilityRegistry: CapabilityRegistry,
    @Inject(CAPABILITY_REQUEST_CONTEXT_STORE)
    private readonly requestContextStore: CapabilityRequestContextStore,
    @Inject(CAPABILITY_PERMISSION_CHECKER)
    private readonly permissionChecker: CapabilityPermissionChecker,
    @Inject(CAPABILITY_RUNTIME_STATE_READER)
    private readonly runtimeStateReader: CapabilityRuntimeStateReader,
    @Inject(CAPABILITY_QUEUE_TRANSPORT)
    private readonly queueTransport: CapabilityQueueTransport,
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

  async consume<TPayload, TResult>(
    envelope: CapabilityCommand<TPayload>,
  ): Promise<CapabilityResult<TResult>> {
    const descriptor = this.capabilityRegistry.getOperationDescriptor({
      capabilityId: envelope.capability,
      operation: envelope.operation,
      operationKind: 'command',
    });
    if (!descriptor) {
      return failure({
        code: 'CAPABILITY_OPERATION_NOT_FOUND',
        message: 'capability_operation_not_found',
        capabilityId: envelope.capability,
        operation: envelope.operation,
      });
    }
    const runtimeState = this.runtimeStateReader.getOperationState({
      capabilityId: envelope.capability,
      operation: envelope.operation,
      operationKind: 'command',
    });
    if (!runtimeState.enabled) {
      return failure(buildDisabledError(runtimeState));
    }
    const canAccess = await this.permissionChecker.canAccess({ descriptor, envelope });
    if (!canAccess) {
      return failure({
        code: 'CAPABILITY_PERMISSION_DENIED',
        message: 'capability_permission_denied',
        capabilityId: envelope.capability,
        operation: envelope.operation,
      });
    }
    return await this.invokeLocalHandler<TResult>({
      capabilityId: envelope.capability,
      operation: envelope.operation,
      operationKind: 'command',
      envelope,
      descriptor,
    });
  }

  private async dispatch<TPayload, TResult>(input: {
    readonly input: CapabilityDispatchRequest<TPayload>;
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
    const runtimeState = this.runtimeStateReader.getOperationState({
      capabilityId: input.input.capability,
      operation: input.input.operation,
      operationKind: input.operationKind,
    });
    if (!runtimeState.enabled) {
      return failure(buildDisabledError(runtimeState));
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

    if (descriptor.transport === 'queue') {
      return await this.dispatchQueue<TResult>({
        request: input.input,
        operationKind: input.operationKind,
        envelope,
      });
    }
    return await this.dispatchInProcess<TResult>({
      request: input.input,
      operationKind: input.operationKind,
      envelope,
      descriptor,
    });
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

  private async dispatchQueue<TResult>(input: {
    readonly request: CapabilityDispatchRequest<unknown>;
    readonly operationKind: CapabilityDispatchKind;
    readonly envelope: CapabilityDispatchEnvelope;
  }): Promise<CapabilityResult<TResult>> {
    if (input.operationKind !== 'command') {
      return failure({
        code: 'CAPABILITY_TRANSPORT_UNAVAILABLE',
        message: 'capability_queue_query_transport_unavailable',
        capabilityId: input.request.capability,
        operation: input.request.operation,
      });
    }
    const queueDescriptor = this.capabilityRegistry.getQueueTransportDescriptor({
      capabilityId: input.request.capability,
      operation: input.request.operation,
      operationKind: 'command',
    });
    if (!queueDescriptor) {
      return failure({
        code: 'CAPABILITY_TRANSPORT_UNAVAILABLE',
        message: 'capability_queue_transport_descriptor_missing',
        capabilityId: input.request.capability,
        operation: input.request.operation,
      });
    }
    const result = await this.queueTransport.enqueue(
      input.envelope as CapabilityCommand<unknown>,
      queueDescriptor,
    );
    return result as CapabilityResult<TResult>;
  }

  private async dispatchInProcess<TResult>(input: {
    readonly request: CapabilityDispatchRequest<unknown>;
    readonly operationKind: CapabilityDispatchKind;
    readonly envelope: CapabilityDispatchEnvelope;
    readonly descriptor: CapabilityOperationDescriptor;
  }): Promise<CapabilityResult<TResult>> {
    if (input.descriptor.transport !== 'in-process') {
      return failure({
        code: 'CAPABILITY_TRANSPORT_UNAVAILABLE',
        message: 'capability_transport_unavailable',
        capabilityId: input.request.capability,
        operation: input.request.operation,
      });
    }
    return await this.invokeLocalHandler<TResult>({
      capabilityId: input.request.capability,
      operation: input.request.operation,
      operationKind: input.operationKind,
      envelope: input.envelope,
      descriptor: input.descriptor,
    });
  }

  private async invokeLocalHandler<TResult>(input: {
    readonly capabilityId: string;
    readonly operation: string;
    readonly operationKind: CapabilityDispatchKind;
    readonly envelope: CapabilityDispatchEnvelope;
    readonly descriptor: CapabilityOperationDescriptor;
  }): Promise<CapabilityResult<TResult>> {
    const handler = this.capabilityRegistry.getOperationHandler({
      capabilityId: input.capabilityId,
      operation: input.operation,
      operationKind: input.operationKind,
    });
    if (!handler) {
      return failure({
        code: 'CAPABILITY_OPERATION_NOT_FOUND',
        message: 'capability_operation_handler_not_found',
        capabilityId: input.capabilityId,
        operation: input.operation,
      });
    }
    try {
      const result = await this.invokeHandler({
        handler,
        envelope: input.envelope,
        descriptor: input.descriptor,
      });
      return result as CapabilityResult<TResult>;
    } catch (error) {
      return failure(
        mapThrownErrorToCapabilityError({
          error,
          capabilityId: input.capabilityId,
          operation: input.operation,
        }),
      );
    }
  }
}

function buildEnvelope<TPayload>(input: {
  readonly input: CapabilityDispatchRequest<TPayload>;
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

function buildDisabledError(state: CapabilityOperationRuntimeState): CapabilityError {
  const code =
    state.reason === 'operation_disabled' || state.reason === 'contribution_default_disabled'
      ? 'CAPABILITY_OPERATION_DISABLED'
      : 'CAPABILITY_DISABLED';
  return {
    code,
    message:
      code === 'CAPABILITY_OPERATION_DISABLED'
        ? 'capability_operation_disabled'
        : 'capability_disabled',
    capabilityId: state.capabilityId,
    operation: state.operation,
    details: state.reason ? { reason: state.reason } : undefined,
  };
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
