import type {
  CapabilityError,
  CapabilityEvent,
  CapabilityResult,
} from '@app-types/common/capability.types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CAPABILITY_RUNTIME_STATE_READER,
  type CapabilityRuntimeStateReader,
} from '@src/usecases/common/ports/capability-runtime-state-reader.contract';
import type { CapabilityEventPublisher } from '@src/usecases/common/ports/capability-bus.contract';
import {
  CAPABILITY_REQUEST_CONTEXT_STORE,
  type CapabilityRequestContextStore,
} from '@src/usecases/common/ports/capability-request-context-store.contract';
import { CapabilityRegistry } from './capability.registry';
import { mapThrownErrorToCapabilityError } from './capability-error.mapper';

@Injectable()
export class InProcessCapabilityEventPublisher implements CapabilityEventPublisher {
  private readonly logger = new Logger(InProcessCapabilityEventPublisher.name);

  constructor(
    private readonly capabilityRegistry: CapabilityRegistry,
    @Inject(CAPABILITY_RUNTIME_STATE_READER)
    private readonly runtimeStateReader: CapabilityRuntimeStateReader,
    @Inject(CAPABILITY_REQUEST_CONTEXT_STORE)
    private readonly requestContextStore: CapabilityRequestContextStore,
  ) {}

  publish<TPayload>(event: CapabilityEvent<TPayload>): Promise<CapabilityResult<void>> {
    const state = this.runtimeStateReader.getCapabilityState(event.capability);
    if (!state.enabled) {
      return Promise.resolve({
        ok: false,
        error: disabledError({
          capabilityId: event.capability,
          operation: event.operation,
          reason: state.reason,
        }),
      });
    }
    const subscribers = this.capabilityRegistry.getEventSubscribers({
      capabilityId: event.capability,
      event: event.operation,
    });
    queueMicrotask(() => {
      for (const subscriber of subscribers) {
        void this.requestContextStore.run(event.context, async () => {
          try {
            await subscriber.handle(event);
          } catch (error) {
            const capabilityError = mapThrownErrorToCapabilityError({
              error,
              capabilityId: event.capability,
              operation: event.operation,
            });
            this.logger.warn(
              JSON.stringify({
                event: 'capability_event_subscriber_failed',
                capabilityId: event.capability,
                operation: event.operation,
                subscriber: subscriber.constructor.name,
                code: capabilityError.code,
                message: capabilityError.message,
              }),
            );
          }
        });
      }
    });
    return Promise.resolve({ ok: true, value: undefined });
  }
}

function disabledError(input: {
  readonly capabilityId: string;
  readonly operation: string;
  readonly reason?: string;
}): CapabilityError {
  return {
    code: 'CAPABILITY_DISABLED',
    message: 'capability_disabled',
    capabilityId: input.capabilityId,
    operation: input.operation,
    details: input.reason ? { reason: input.reason } : undefined,
  };
}
