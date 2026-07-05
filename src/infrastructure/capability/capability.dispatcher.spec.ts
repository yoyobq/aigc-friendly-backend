import type {
  CapabilityCommand,
  CapabilityQuery,
  CapabilityRequestContext,
  CapabilityResult,
} from '@app-types/common/capability.types';
import { DomainError } from '@core/common/errors/domain-error';
import { Injectable } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { BULLMQ_JOBS, BULLMQ_QUEUES } from '@src/infrastructure/bullmq/bullmq.constants';
import {
  CAPABILITY_COMMAND_BUS,
  CAPABILITY_PERMISSION_CHECKER,
  CAPABILITY_QUERY_BUS,
  type CapabilityCommandBus,
  type CapabilityOperationHandler,
  type CapabilityPermissionChecker,
  type CapabilityQueryBus,
} from '@src/usecases/common/ports/capability-bus.contract';
import {
  CAPABILITY_REQUEST_CONTEXT_STORE,
  type CapabilityRequestContextStore,
} from '@src/usecases/common/ports/capability-request-context-store.contract';
import { CapabilityBootstrapCheck } from './capability-bootstrap-check';
import {
  CapabilityManifestProvider,
  CapabilityOperationHandlerProvider,
  CapabilityQueueBindingProvider,
} from './capability.decorators';
import { CapabilityModule } from './capability.module';

describe('CapabilityDispatcher', () => {
  it('dispatches command and query handlers with inherited request context', async () => {
    @Injectable()
    @CapabilityManifestProvider({
      id: 'test.dispatch',
      kind: 'business',
      displayName: 'Test Dispatch',
      version: '0.1.0',
      processes: ['api'],
      operations: {
        commands: [
          {
            kind: 'command',
            name: 'publish',
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
    @CapabilityManifestProvider({
      id: 'test.permission',
      kind: 'business',
      displayName: 'Test Permission',
      version: '0.1.0',
      processes: ['api'],
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
    @CapabilityManifestProvider({
      id: 'test.domain-error',
      kind: 'business',
      displayName: 'Test Domain Error',
      version: '0.1.0',
      processes: ['api'],
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

  it('does not execute queue transport in P3a', async () => {
    @Injectable()
    @CapabilityManifestProvider({
      id: 'test.queue-dispatch',
      kind: 'technical',
      displayName: 'Test Queue Dispatch',
      version: '0.1.0',
      processes: ['api'],
      operations: {
        commands: [
          {
            kind: 'command',
            name: 'generate',
            sideEffects: 'external',
            transport: 'queue',
          },
        ],
      },
      contributions: {
        queues: [
          {
            operation: 'generate',
            operationKind: 'command',
            queueName: BULLMQ_QUEUES.AI,
            jobName: BULLMQ_JOBS.AI.GENERATE,
          },
        ],
      },
    })
    class QueueDispatchCapability {}

    @Injectable()
    @CapabilityQueueBindingProvider({
      capabilityId: 'test.queue-dispatch',
      operation: 'generate',
      operationKind: 'command',
      queueName: BULLMQ_QUEUES.AI,
      jobName: BULLMQ_JOBS.AI.GENERATE,
    })
    class QueueDispatchBinding {}

    const module = await buildModule([QueueDispatchCapability, QueueDispatchBinding]);
    const commandBus = module.get<CapabilityCommandBus>(CAPABILITY_COMMAND_BUS);
    const store = module.get<CapabilityRequestContextStore>(CAPABILITY_REQUEST_CONTEXT_STORE);

    await store.run(createContext(), async () => {
      await expect(
        commandBus.execute({
          capability: 'test.queue-dispatch',
          operation: 'generate',
          payload: {},
        }),
      ).resolves.toMatchObject({
        ok: false,
        error: { code: 'CAPABILITY_TRANSPORT_UNAVAILABLE' },
      });
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
  providers: readonly (new (...args: never[]) => object)[],
  permissionChecker?: CapabilityPermissionChecker,
): Promise<TestingModule> {
  const builder = Test.createTestingModule({
    imports: [CapabilityModule.forRoot({ process: 'api' })],
    providers: [...providers],
  })
    .overrideProvider(CapabilityBootstrapCheck)
    .useValue({ onApplicationBootstrap: jest.fn() });

  if (permissionChecker) {
    builder.overrideProvider(CAPABILITY_PERMISSION_CHECKER).useValue(permissionChecker);
  }

  return await builder.compile();
}
