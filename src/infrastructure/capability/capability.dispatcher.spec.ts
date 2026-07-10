import type {
  CapabilityCommand,
  CapabilityProcess,
  CapabilityQuery,
  CapabilityRequestContext,
  CapabilityResult,
} from '@app-types/common/capability.types';
import { DomainError } from '@core/common/errors/domain-error';
import { Injectable, type Provider } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { BULLMQ_JOBS, BULLMQ_QUEUES } from '@src/infrastructure/bullmq/bullmq.constants';
import { BullMqProducerGateway } from '@src/infrastructure/bullmq/producer.gateway';
import {
  CAPABILITY_COMMAND_BUS,
  CAPABILITY_EVENT_PUBLISHER,
  CAPABILITY_PERMISSION_CHECKER,
  CAPABILITY_QUEUE_CONSUMER,
  CAPABILITY_QUERY_BUS,
  type CapabilityCommandBus,
  type CapabilityEventPublisher,
  type CapabilityEventSubscriber,
  type CapabilityOperationHandler,
  type CapabilityPermissionChecker,
  type CapabilityQueueConsumer,
  type CapabilityQueryBus,
} from '@src/usecases/common/ports/capability-bus.contract';
import {
  CAPABILITY_REQUEST_CONTEXT_STORE,
  type CapabilityRequestContextStore,
} from '@src/usecases/common/ports/capability-request-context-store.contract';
import { CapabilityBootstrapCheck } from './capability-bootstrap-check';
import {
  CAPABILITY_ANCHOR_METADATA_KEY,
  CAPABILITY_RUNTIME_CONTRIBUTION_METADATA_KEY,
  CapabilityAnchorProvider,
  CapabilityEventSubscriberProvider,
  CapabilityRuntimeContributionProvider,
  CapabilityOperationHandlerProvider,
  CapabilityQueueBindingProvider,
} from './capability.decorators';
import { CapabilityModule } from './capability.module';

describe('CapabilityDispatcher', () => {
  it('dispatches command and query handlers with inherited request context', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.dispatch',
      operations: {
        commands: [
          {
            kind: 'command',
            name: 'publish',
            version: '1.2.3',
            sideEffects: 'internal',
          },
        ],
        queries: [
          {
            kind: 'query',
            name: 'view',
          },
        ],
      },
    })
    class DispatchCapability {}

    @Injectable()
    @CapabilityOperationHandlerProvider({
      capabilityId: 'test.dispatch',
      operation: 'publish',
      operationKind: 'command',
    })
    class PublishHandler implements CapabilityOperationHandler<
      { readonly title: string },
      { readonly slug: string }
    > {
      readonly capability = 'test.dispatch';
      readonly operation = 'publish';
      readonly operationKind = 'command' as const;
      lastEnvelope: CapabilityCommand<{ readonly title: string }> | null = null;

      handle(
        envelope:
          | CapabilityCommand<{ readonly title: string }>
          | CapabilityQuery<{ readonly title: string }>,
      ): Promise<CapabilityResult<{ readonly slug: string }>> {
        if (envelope.operationKind === 'command') {
          this.lastEnvelope = envelope;
        }
        return Promise.resolve({ ok: true, value: { slug: envelope.payload.title } });
      }
    }

    @Injectable()
    @CapabilityOperationHandlerProvider({
      capabilityId: 'test.dispatch',
      operation: 'view',
      operationKind: 'query',
    })
    class ViewHandler implements CapabilityOperationHandler<
      { readonly id: string },
      { readonly title: string }
    > {
      readonly capability = 'test.dispatch';
      readonly operation = 'view';
      readonly operationKind = 'query' as const;
      lastEnvelope: CapabilityQuery<{ readonly id: string }> | null = null;

      handle(
        envelope:
          CapabilityCommand<{ readonly id: string }> | CapabilityQuery<{ readonly id: string }>,
      ): Promise<CapabilityResult<{ readonly title: string }>> {
        if (envelope.operationKind === 'query') {
          this.lastEnvelope = envelope;
        }
        return Promise.resolve({ ok: true, value: { title: envelope.payload.id } });
      }
    }

    const module = await buildModule([DispatchCapability, PublishHandler, ViewHandler]);
    const commandBus = module.get<CapabilityCommandBus>(CAPABILITY_COMMAND_BUS);
    const queryBus = module.get<CapabilityQueryBus>(CAPABILITY_QUERY_BUS);
    const store = module.get<CapabilityRequestContextStore>(CAPABILITY_REQUEST_CONTEXT_STORE);
    const publishHandler = module.get(PublishHandler);
    const viewHandler = module.get(ViewHandler);
    const context = createContext();

    await store.run(context, async () => {
      await expect(
        commandBus.execute<{ readonly title: string }, { readonly slug: string }>({
          capability: 'test.dispatch',
          operation: 'publish',
          payload: { title: 'hello' },
        }),
      ).resolves.toEqual({ ok: true, value: { slug: 'hello' } });

      await expect(
        queryBus.ask<{ readonly id: string }, { readonly title: string }>({
          capability: 'test.dispatch',
          operation: 'view',
          payload: { id: 'item-1' },
        }),
      ).resolves.toEqual({ ok: true, value: { title: 'item-1' } });
    });

    expect(publishHandler.lastEnvelope?.context).toBe(context);
    expect(publishHandler.lastEnvelope?.operationVersion).toBe('1.2.3');
    expect(viewHandler.lastEnvelope?.context).toBe(context);
    await module.close();
  });

  it('returns operation not found when the operation is not declared', async () => {
    const module = await buildModule([]);
    const commandBus = module.get<CapabilityCommandBus>(CAPABILITY_COMMAND_BUS);
    const store = module.get<CapabilityRequestContextStore>(CAPABILITY_REQUEST_CONTEXT_STORE);

    await store.run(createContext(), async () => {
      await expect(
        commandBus.execute({
          capability: 'test.missing',
          operation: 'publish',
          payload: {},
        }),
      ).resolves.toMatchObject({
        ok: false,
        error: { code: 'CAPABILITY_OPERATION_NOT_FOUND' },
      });
    });
    await module.close();
  });

  it('returns permission denied before invoking the handler', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.permission',
      operations: {
        commands: [
          {
            kind: 'command',
            name: 'publish',
            sideEffects: 'internal',
            requiredPermissions: ['content.publish'],
          },
        ],
      },
    })
    class PermissionCapability {}

    @Injectable()
    @CapabilityOperationHandlerProvider({
      capabilityId: 'test.permission',
      operation: 'publish',
      operationKind: 'command',
    })
    class PermissionHandler implements CapabilityOperationHandler {
      readonly capability = 'test.permission';
      readonly operation = 'publish';
      readonly operationKind = 'command' as const;
      called = false;

      handle(): Promise<CapabilityResult<string>> {
        this.called = true;
        return Promise.resolve({ ok: true, value: 'published' });
      }
    }

    const permissionChecker: CapabilityPermissionChecker = {
      canAccess: () => Promise.resolve(false),
    };
    const module = await buildModule([PermissionCapability, PermissionHandler], permissionChecker);
    const commandBus = module.get<CapabilityCommandBus>(CAPABILITY_COMMAND_BUS);
    const store = module.get<CapabilityRequestContextStore>(CAPABILITY_REQUEST_CONTEXT_STORE);
    const handler = module.get(PermissionHandler);

    await store.run(createContext(), async () => {
      await expect(
        commandBus.execute({
          capability: 'test.permission',
          operation: 'publish',
          payload: {},
        }),
      ).resolves.toMatchObject({
        ok: false,
        error: { code: 'CAPABILITY_PERMISSION_DENIED' },
      });
    });

    expect(handler.called).toBe(false);
    await module.close();
  });

  it('folds thrown DomainError into CapabilityError', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.domain-error',
      operations: {
        commands: [
          {
            kind: 'command',
            name: 'publish',
            sideEffects: 'internal',
          },
        ],
      },
    })
    class DomainErrorCapability {}

    @Injectable()
    @CapabilityOperationHandlerProvider({
      capabilityId: 'test.domain-error',
      operation: 'publish',
      operationKind: 'command',
    })
    class DomainErrorHandler implements CapabilityOperationHandler {
      readonly capability = 'test.domain-error';
      readonly operation = 'publish';
      readonly operationKind = 'command' as const;

      handle(): Promise<CapabilityResult<string>> {
        throw new DomainError('TEST_DOMAIN_ERROR', 'domain failed');
      }
    }

    const module = await buildModule([DomainErrorCapability, DomainErrorHandler]);
    const commandBus = module.get<CapabilityCommandBus>(CAPABILITY_COMMAND_BUS);
    const store = module.get<CapabilityRequestContextStore>(CAPABILITY_REQUEST_CONTEXT_STORE);

    await store.run(createContext(), async () => {
      await expect(
        commandBus.execute({
          capability: 'test.domain-error',
          operation: 'publish',
          payload: {},
        }),
      ).resolves.toMatchObject({
        ok: false,
        error: {
          code: 'CAPABILITY_VALIDATION_FAILED',
          details: { causeCode: 'TEST_DOMAIN_ERROR' },
        },
      });
    });
    await module.close();
  });

  it('enqueues queue transport commands through BullMQ producer', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.queue-dispatch',
      operations: {
        commands: [
          {
            kind: 'command',
            name: 'dispatch',
            sideEffects: 'external',
            transport: 'queue',
          },
        ],
      },
      contributions: {
        queues: [
          {
            operation: 'dispatch',
            operationKind: 'command',
            queueName: BULLMQ_QUEUES.CAPABILITY,
            jobName: BULLMQ_JOBS.CAPABILITY.DISPATCH,
            dedupKeyMapping: 'jobId',
          },
        ],
      },
    })
    class QueueDispatchCapability {}

    @Injectable()
    @CapabilityQueueBindingProvider({
      capabilityId: 'test.queue-dispatch',
      operation: 'dispatch',
      operationKind: 'command',
      queueName: BULLMQ_QUEUES.CAPABILITY,
      jobName: BULLMQ_JOBS.CAPABILITY.DISPATCH,
      dedupKeyMapping: 'jobId',
    })
    class QueueDispatchBinding {}

    const enqueue = jest.fn().mockResolvedValue({
      queueName: BULLMQ_QUEUES.CAPABILITY,
      jobName: BULLMQ_JOBS.CAPABILITY.DISPATCH,
      jobId: 'dedup-1',
      traceId: 'trace-1',
    });
    const module = await buildModule([
      QueueDispatchCapability,
      QueueDispatchBinding,
      { provide: BullMqProducerGateway, useValue: { enqueue } },
    ]);
    const commandBus = module.get<CapabilityCommandBus>(CAPABILITY_COMMAND_BUS);
    const store = module.get<CapabilityRequestContextStore>(CAPABILITY_REQUEST_CONTEXT_STORE);

    await store.run(createContext(), async () => {
      await expect(
        commandBus.execute({
          capability: 'test.queue-dispatch',
          operation: 'dispatch',
          payload: { id: 'item-1' },
          dedupKey: 'dedup-1',
        }),
      ).resolves.toEqual({
        ok: true,
        value: {
          queueName: BULLMQ_QUEUES.CAPABILITY,
          jobName: BULLMQ_JOBS.CAPABILITY.DISPATCH,
          jobId: 'dedup-1',
          traceId: 'trace-1',
        },
      });
    });
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        queueName: BULLMQ_QUEUES.CAPABILITY,
        jobName: BULLMQ_JOBS.CAPABILITY.DISPATCH,
        dedupKey: 'dedup-1',
        traceId: 'trace-1',
      }),
    );
    await module.close();
  });

  it('consumes queued commands by invoking the worker-local handler', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.queue-consume',
      operations: {
        commands: [
          {
            kind: 'command',
            name: 'dispatch',
            sideEffects: 'internal',
            transport: 'queue',
          },
        ],
      },
      contributions: {
        queues: [
          {
            operation: 'dispatch',
            operationKind: 'command',
            queueName: BULLMQ_QUEUES.CAPABILITY,
            jobName: BULLMQ_JOBS.CAPABILITY.DISPATCH,
          },
        ],
      },
    })
    class QueueConsumeCapability {}

    @Injectable()
    @CapabilityQueueBindingProvider({
      capabilityId: 'test.queue-consume',
      operation: 'dispatch',
      operationKind: 'command',
      queueName: BULLMQ_QUEUES.CAPABILITY,
      jobName: BULLMQ_JOBS.CAPABILITY.DISPATCH,
    })
    class QueueConsumeBinding {}

    @Injectable()
    @CapabilityOperationHandlerProvider({
      capabilityId: 'test.queue-consume',
      operation: 'dispatch',
      operationKind: 'command',
    })
    class QueueConsumeHandler implements CapabilityOperationHandler<
      { readonly id: string },
      { readonly processedId: string }
    > {
      readonly capability = 'test.queue-consume';
      readonly operation = 'dispatch';
      readonly operationKind = 'command' as const;

      handle(
        envelope:
          CapabilityCommand<{ readonly id: string }> | CapabilityQuery<{ readonly id: string }>,
      ): Promise<CapabilityResult<{ readonly processedId: string }>> {
        return Promise.resolve({
          ok: true,
          value: { processedId: envelope.payload.id },
        });
      }
    }

    const module = await buildModule(
      [QueueConsumeCapability, QueueConsumeBinding, QueueConsumeHandler],
      undefined,
      'worker',
    );
    const queueConsumer = module.get<CapabilityQueueConsumer>(CAPABILITY_QUEUE_CONSUMER);

    await expect(
      queueConsumer.consume({
        capability: 'test.queue-consume',
        operation: 'dispatch',
        operationKind: 'command',
        context: createContext(),
        payload: { id: 'item-1' },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).resolves.toEqual({
      ok: true,
      value: { processedId: 'item-1' },
    });
    await module.close();
  });

  it('publishes in-process events without bubbling subscriber failures', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.event-runtime',
      operations: {
        events: [{ kind: 'event', name: 'published', eventType: 'fact' }],
      },
    })
    class EventRuntimeCapability {}

    @Injectable()
    @CapabilityEventSubscriberProvider({
      capabilityId: 'test.event-runtime',
      event: 'published',
    })
    class FailingSubscriber implements CapabilityEventSubscriber<{ readonly id: string }> {
      readonly capability = 'test.event-runtime';
      readonly event = 'published';
      called = false;

      handle(): Promise<{ readonly ok: true; readonly value: void }> {
        this.called = true;
        throw new Error('subscriber failed');
      }
    }

    const module = await buildModule([EventRuntimeCapability, FailingSubscriber]);
    const publisher = module.get<CapabilityEventPublisher>(CAPABILITY_EVENT_PUBLISHER);
    const subscriber = module.get(FailingSubscriber);
    const context = createContext();

    await expect(
      publisher.publish({
        capability: 'test.event-runtime',
        operation: 'published',
        operationKind: 'event',
        context,
        payload: { id: 'item-1' },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        eventId: 'event-1',
        occurredAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).resolves.toEqual({ ok: true, value: undefined });
    await Promise.resolve();
    expect(subscriber.called).toBe(true);
    await module.close();
  });

  it('returns disabled result when publishing event for disabled capability', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.event-disabled',
      runtime: { defaultState: 'disabled' },
      operations: {
        events: [{ kind: 'event', name: 'published', eventType: 'fact' }],
      },
    })
    class EventDisabledCapability {}

    const module = await buildModule([EventDisabledCapability]);
    const publisher = module.get<CapabilityEventPublisher>(CAPABILITY_EVENT_PUBLISHER);

    await expect(
      publisher.publish({
        capability: 'test.event-disabled',
        operation: 'published',
        operationKind: 'event',
        context: createContext(),
        payload: { id: 'item-1' },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        eventId: 'event-1',
        occurredAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).resolves.toEqual({
      ok: false,
      error: expect.objectContaining({
        code: 'CAPABILITY_DISABLED',
        capabilityId: 'test.event-disabled',
        operation: 'published',
      }),
    });
    await module.close();
  });
});

function createContext(): CapabilityRequestContext {
  return {
    traceId: 'trace-1',
    requestId: 'request-1',
    entryPoint: 'graphql-api',
    actor: {
      accountId: 1,
      activeRole: 'STAFF',
      accessGroup: ['STAFF'],
      source: 'account',
    },
  };
}

async function buildModule(
  providers: readonly Provider[],
  permissionChecker?: CapabilityPermissionChecker,
  process: CapabilityProcess = 'api',
): Promise<TestingModule> {
  const builder = Test.createTestingModule({
    imports: [CapabilityModule.forRoot({ process })],
    providers: [...providers, ...buildTestAnchorProviders(providers)],
  })
    .overrideProvider(CapabilityBootstrapCheck)
    .useValue({ onApplicationBootstrap: jest.fn() });

  if (permissionChecker) {
    builder.overrideProvider(CAPABILITY_PERMISSION_CHECKER).useValue(permissionChecker);
  }

  return await builder.compile();
}

function buildTestAnchorProviders(providers: readonly Provider[]): readonly (new () => object)[] {
  const providerTypes = providers.filter(
    (provider): provider is new (...args: never[]) => object => typeof provider === 'function',
  );
  const declaredAnchorIds = new Set(
    providerTypes.flatMap((provider) => {
      const anchor = Reflect.getMetadata(CAPABILITY_ANCHOR_METADATA_KEY, provider) as
        { readonly capabilityId: string } | undefined;
      return anchor ? [anchor.capabilityId] : [];
    }),
  );
  const runtimeIds = new Set(
    providerTypes.flatMap((provider) => {
      const contribution = Reflect.getMetadata(
        CAPABILITY_RUNTIME_CONTRIBUTION_METADATA_KEY,
        provider,
      ) as { readonly capabilityId: string } | undefined;
      return contribution ? [contribution.capabilityId] : [];
    }),
  );
  return [...runtimeIds]
    .filter((capabilityId) => !declaredAnchorIds.has(capabilityId))
    .map((capabilityId) => createTestAnchorProvider(capabilityId));
}

function createTestAnchorProvider(capabilityId: string): new () => object {
  @Injectable()
  @CapabilityAnchorProvider({
    capabilityId,
    mode: 'switchable',
    decisionRef: 'docs/capabilities/current.md',
  })
  class TestCapabilityAnchor {}

  return TestCapabilityAnchor;
}
