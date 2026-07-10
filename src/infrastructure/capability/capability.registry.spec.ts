// src/infrastructure/capability/capability.registry.spec.ts
import { Injectable } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { BULLMQ_JOBS, BULLMQ_QUEUES } from '@src/infrastructure/bullmq/bullmq.constants';
import type { CapabilityHealthCheck } from '@app-types/common/capability.types';
import type {
  CapabilityEventSubscriber,
  CapabilityOperationHandler,
} from '@src/usecases/common/ports/capability-bus.contract';
import {
  SESSION_REFERENCE_CAPABILITY_ID,
  SESSION_REFERENCE_CAPABILITY_PROVIDERS,
} from '../../../test/support/capability/session-reference.fixture';
import { CapabilityBootstrapCheck } from './capability-bootstrap-check';
import {
  CapabilityEventSubscriberProvider,
  CapabilityHealthCheckProvider,
  CapabilityAnchorProvider,
  CapabilityRuntimeContributionProvider,
  CapabilityOperationHandlerProvider,
  CapabilityProviderBindingProvider,
  CapabilityQueueBindingProvider,
  CapabilitySessionAuthorityScopeAuthorizerProvider,
  CapabilitySessionAuthoritySummaryResolverProvider,
  CapabilitySessionIdentityResolverProvider,
  CAPABILITY_ANCHOR_METADATA_KEY,
  CAPABILITY_RUNTIME_CONTRIBUTION_METADATA_KEY,
} from './capability.decorators';
import { CapabilityModule } from './capability.module';
import { CapabilityBootstrapError, CapabilityRegistry } from './capability.registry';

describe('CapabilityRegistry', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('collects active runtimeContributions, provider bindings and queue bindings through Discovery', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.provider',
      runtime: { healthCheck: true },
      contributions: {
        providers: [{ providerKind: 'test.provider', providerName: 'mock' }],
      },
    })
    class TestProviderCapability {}

    @Injectable()
    @CapabilityProviderBindingProvider({
      capabilityId: 'test.provider',
      providerKind: 'test.provider',
      providerName: 'mock',
    })
    @CapabilityHealthCheckProvider({
      capabilityId: 'test.provider',
      name: 'provider-config',
    })
    class TestProvider implements CapabilityHealthCheck {
      readonly name = 'mock';

      check() {
        return Promise.resolve({
          status: 'healthy' as const,
          checkedAt: new Date('2026-01-01T00:00:00.000Z'),
          message: 'test_provider_ready',
        });
      }
    }

    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.queue',
      contributions: {
        queues: [
          {
            operation: 'generate',
            operationKind: 'command',
            queueName: BULLMQ_QUEUES.AI,
            jobName: BULLMQ_JOBS.AI.GENERATE,
            dedupKeyMapping: 'jobId',
          },
        ],
      },
    })
    class TestQueueCapability {}

    @Injectable()
    @CapabilityQueueBindingProvider({
      capabilityId: 'test.queue',
      operation: 'generate',
      operationKind: 'command',
      queueName: BULLMQ_QUEUES.AI,
      jobName: BULLMQ_JOBS.AI.GENERATE,
      dedupKeyMapping: 'jobId',
    })
    class TestQueueBinding {}

    const module = await buildModule([
      TestProviderCapability,
      TestProvider,
      TestQueueCapability,
      TestQueueBinding,
    ]);
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual([]);
    expect(
      registry
        .getActiveRuntimeContributions()
        .map((runtimeContribution) => runtimeContribution.capabilityId),
    ).toEqual(expect.arrayContaining(['test.provider', 'test.queue']));
    expect(
      registry.getProviderClient<{ readonly name: string }>({
        providerKind: 'test.provider',
        providerName: 'mock',
      }),
    ).toBeInstanceOf(TestProvider);
    await expect(registry.checkHealth()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capabilityId: 'test.provider',
          name: 'provider-config',
          status: 'healthy',
          message: 'test_provider_ready',
        }),
      ]),
    );
    await module.close();
  });

  it('discovers stacked provider metadata once when the provider has a useExisting alias', async () => {
    const providerAlias = Symbol('STACKED_PROVIDER_ALIAS');

    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.stacked-provider',
      runtime: { healthCheck: true },
      contributions: {
        providers: [{ providerKind: 'test.provider', providerName: 'stacked' }],
      },
    })
    @CapabilityProviderBindingProvider({
      capabilityId: 'test.stacked-provider',
      providerKind: 'test.provider',
      providerName: 'stacked',
    })
    @CapabilityHealthCheckProvider({
      capabilityId: 'test.stacked-provider',
      name: 'provider-config',
    })
    class StackedProvider implements CapabilityHealthCheck {
      check() {
        return Promise.resolve({
          status: 'healthy' as const,
          checkedAt: new Date('2026-01-01T00:00:00.000Z'),
          message: 'stacked_provider_ready',
        });
      }
    }

    const module = await Test.createTestingModule({
      imports: [CapabilityModule.forRoot({ process: 'api' })],
      providers: [
        StackedProvider,
        { provide: providerAlias, useExisting: StackedProvider },
        createTestAnchorProvider('test.stacked-provider'),
      ],
    })
      .overrideProvider(CapabilityBootstrapCheck)
      .useValue({ onApplicationBootstrap: jest.fn() })
      .compile();
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual([]);
    expect(
      registry
        .getActiveRuntimeContributions()
        .filter(
          (runtimeContribution) => runtimeContribution.capabilityId === 'test.stacked-provider',
        ),
    ).toHaveLength(1);
    expect(
      registry.getProviderClient({
        providerKind: 'test.provider',
        providerName: 'stacked',
      }),
    ).toBe(module.get(StackedProvider));
    await expect(registry.checkHealth()).resolves.toEqual([
      expect.objectContaining({
        capabilityId: 'test.stacked-provider',
        name: 'provider-config',
        status: 'healthy',
      }),
    ]);
    await module.close();
  });

  it('discovers runtime contributions installed in the current Nest container', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.worker-only',
    })
    class WorkerOnlyCapability {}

    const module = await buildModule([WorkerOnlyCapability], 'api');
    const registry = module.get(CapabilityRegistry);

    expect(
      registry
        .getActiveRuntimeContributions()
        .map((runtimeContribution) => runtimeContribution.capabilityId),
    ).toContain('test.worker-only');
    expect(registry.validateBootstrap().issues).toEqual([]);
    await module.close();
  });

  it('fails validation when a declared provider binding is missing', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.missing-provider',
      contributions: {
        providers: [{ providerKind: 'test.provider', providerName: 'missing' }],
      },
    })
    class MissingProviderCapability {}

    const module = await buildModule([MissingProviderCapability]);
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CAPABILITY_PROVIDER_BINDING_MISSING' }),
      ]),
    );
    expect(() => registry.assertBootstrapValid()).toThrow(CapabilityBootstrapError);
    await module.close();
  });

  it('fails validation when required capability dependencies form a cycle', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.cycle-a',
      runtimeDependencies: [{ capabilityId: 'test.cycle-b', mode: 'required' }],
    })
    class CycleACapability {}

    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.cycle-b',
      runtimeDependencies: [{ capabilityId: 'test.cycle-a', mode: 'required' }],
    })
    class CycleBCapability {}

    const module = await buildModule([CycleACapability, CycleBCapability]);
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'CAPABILITY_DEPENDENCY_CYCLE' })]),
    );
    await module.close();
  });

  it('allows linear required capability dependencies', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.linear-a',
      runtimeDependencies: [{ capabilityId: 'test.linear-b', mode: 'required' }],
    })
    class LinearACapability {}

    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.linear-b',
    })
    class LinearBCapability {}

    const module = await buildModule([LinearACapability, LinearBCapability]);
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual([]);
    await module.close();
  });

  it('collects GraphQL API surface from runtime contributions', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.surface-owner',
      contributions: {
        api: {
          graphqlOperations: [
            {
              operationName: 'testSurface',
              operationKind: 'query',
              requiredPermissions: ['test.surface.read'],
            },
          ],
        },
      },
    })
    class SurfaceOwnerCapability {}

    const module = await buildModule([SurfaceOwnerCapability], 'api');
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual([]);
    expect(registry.getGraphqlOperationContributions()).toEqual(
      expect.arrayContaining([
        {
          capabilityId: 'test.surface-owner',
          operationName: 'testSurface',
          operationKind: 'query',
          requiredPermissions: ['test.surface.read'],
        },
      ]),
    );
    await module.close();
  });

  it('reports invalid GraphQL API contributions as bootstrap issues', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.invalid-surface',
      contributions: {
        api: {
          graphqlOperations: [{ operationName: ' ', operationKind: 'query' }],
        },
      },
    })
    class InvalidSurfaceCapability {}

    const module = await buildModule([InvalidSurfaceCapability], 'api');
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CAPABILITY_GRAPHQL_OPERATION_INVALID' }),
      ]),
    );
    await module.close();
  });

  it('fails validation when a declared queue job is not registered', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.invalid-queue',
      contributions: {
        queues: [
          {
            operation: 'unknown',
            operationKind: 'command',
            queueName: BULLMQ_QUEUES.AI,
            jobName: 'unknown',
          },
        ],
      },
    })
    class InvalidQueueCapability {}

    @Injectable()
    @CapabilityQueueBindingProvider({
      capabilityId: 'test.invalid-queue',
      operation: 'unknown',
      operationKind: 'command',
      queueName: BULLMQ_QUEUES.AI,
      jobName: 'unknown',
    })
    class InvalidQueueBinding {}

    const module = await buildModule([InvalidQueueCapability, InvalidQueueBinding]);
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'CAPABILITY_JOB_NOT_REGISTERED' })]),
    );
    await module.close();
  });

  it('fails validation when a declared health check is missing', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.missing-health',
      runtime: { healthCheck: true },
    })
    class MissingHealthCapability {}

    const module = await buildModule([MissingHealthCapability]);
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CAPABILITY_HEALTH_CHECK_MISSING' }),
      ]),
    );
    expect(() => registry.assertBootstrapValid()).toThrow(CapabilityBootstrapError);
    await module.close();
  });

  it('fails validation when a declared in-process operation lacks a handler', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.operation-missing-handler',
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
    class MissingOperationHandlerCapability {}

    const module = await buildModule([MissingOperationHandlerCapability], 'api');
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CAPABILITY_OPERATION_HANDLER_MISSING' }),
      ]),
    );
    await module.close();
  });

  it('fails validation when operation handlers are duplicated', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.operation-duplicate-handler',
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
    class DuplicateHandlerCapability {}

    @Injectable()
    @CapabilityOperationHandlerProvider({
      capabilityId: 'test.operation-duplicate-handler',
      operation: 'publish',
      operationKind: 'command',
    })
    class FirstPublishHandler implements CapabilityOperationHandler {
      readonly capability = 'test.operation-duplicate-handler';
      readonly operation = 'publish';
      readonly operationKind = 'command' as const;

      handle(): Promise<{ readonly ok: true; readonly value: string }> {
        return Promise.resolve({ ok: true, value: 'first' });
      }
    }

    @Injectable()
    @CapabilityOperationHandlerProvider({
      capabilityId: 'test.operation-duplicate-handler',
      operation: 'publish',
      operationKind: 'command',
    })
    class SecondPublishHandler implements CapabilityOperationHandler {
      readonly capability = 'test.operation-duplicate-handler';
      readonly operation = 'publish';
      readonly operationKind = 'command' as const;

      handle(): Promise<{ readonly ok: true; readonly value: string }> {
        return Promise.resolve({ ok: true, value: 'second' });
      }
    }

    const module = await buildModule(
      [DuplicateHandlerCapability, FirstPublishHandler, SecondPublishHandler],
      'api',
    );
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CAPABILITY_OPERATION_HANDLER_DUPLICATE' }),
      ]),
    );
    await module.close();
  });

  it('reports process mismatch for operation handlers registered in the wrong process', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.operation-process-mismatch',
      operations: {
        queries: [
          {
            kind: 'query',
            name: 'view',
          },
        ],
      },
    })
    class ProcessMismatchCapability {}

    @Injectable()
    @CapabilityOperationHandlerProvider({
      capabilityId: 'test.operation-process-mismatch',
      operation: 'view',
      operationKind: 'query',
      processes: ['worker'],
    })
    class ViewHandler implements CapabilityOperationHandler {
      readonly capability = 'test.operation-process-mismatch';
      readonly operation = 'view';
      readonly operationKind = 'query' as const;

      handle(): Promise<{ readonly ok: true; readonly value: string }> {
        return Promise.resolve({ ok: true, value: 'view' });
      }
    }

    const module = await buildModule([ProcessMismatchCapability, ViewHandler], 'api');
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CAPABILITY_OPERATION_HANDLER_PROCESS_MISMATCH' }),
      ]),
    );
    await module.close();
  });

  it('reports undeclared operation handlers as non-blocking warnings', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.operation-warning',
    })
    class WarningCapability {}

    @Injectable()
    @CapabilityOperationHandlerProvider({
      capabilityId: 'test.operation-warning',
      operation: 'undeclared',
      operationKind: 'command',
    })
    class UndeclaredHandler implements CapabilityOperationHandler {
      readonly capability = 'test.operation-warning';
      readonly operation = 'undeclared';
      readonly operationKind = 'command' as const;

      handle(): Promise<{ readonly ok: true; readonly value: string }> {
        return Promise.resolve({ ok: true, value: 'ok' });
      }
    }

    const module = await buildModule([WarningCapability, UndeclaredHandler], 'api');
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CAPABILITY_OPERATION_HANDLER_NOT_DECLARED',
          severity: 'warning',
        }),
      ]),
    );
    expect(() => registry.assertBootstrapValid()).not.toThrow();
    await module.close();
  });

  it('resolves queue transport descriptors without enqueueing BullMQ jobs', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.operation-queue',
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
            dedupKeyMapping: 'jobId',
          },
        ],
      },
    })
    class QueueOperationCapability {}

    @Injectable()
    @CapabilityQueueBindingProvider({
      capabilityId: 'test.operation-queue',
      operation: 'generate',
      operationKind: 'command',
      queueName: BULLMQ_QUEUES.AI,
      jobName: BULLMQ_JOBS.AI.GENERATE,
      dedupKeyMapping: 'jobId',
    })
    class QueueOperationBinding {}

    const module = await buildModule([QueueOperationCapability, QueueOperationBinding], 'api');
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual([]);
    expect(
      registry.getQueueTransportDescriptor({
        capabilityId: 'test.operation-queue',
        operation: 'generate',
        operationKind: 'command',
      }),
    ).toEqual({
      capabilityId: 'test.operation-queue',
      operation: 'generate',
      operationKind: 'command',
      queueName: BULLMQ_QUEUES.AI,
      jobName: BULLMQ_JOBS.AI.GENERATE,
      dedupKeyMapping: 'jobId',
    });
    await module.close();
  });

  it('discovers event subscriber fixtures without dispatching events', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.operation-event',
      operations: {
        events: [
          {
            kind: 'event',
            name: 'published',
            eventType: 'fact',
          },
        ],
      },
    })
    class EventCapability {}

    @Injectable()
    @CapabilityEventSubscriberProvider({
      capabilityId: 'test.operation-event',
      event: 'published',
    })
    class PublishedSubscriber implements CapabilityEventSubscriber {
      readonly capability = 'test.operation-event';
      readonly event = 'published';

      handle(): Promise<{ readonly ok: true; readonly value: void }> {
        return Promise.resolve({ ok: true, value: undefined });
      }
    }

    const module = await buildModule([EventCapability, PublishedSubscriber], 'api');
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual([]);
    expect(
      registry.getEventSubscribers({
        capabilityId: 'test.operation-event',
        event: 'published',
      }),
    ).toHaveLength(1);
    await module.close();
  });

  it('collects the reference session capability fixture through Discovery', async () => {
    const module = await buildModule([...SESSION_REFERENCE_CAPABILITY_PROVIDERS], 'api');
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual([]);
    expect(
      registry
        .getActiveRuntimeContributions()
        .map((runtimeContribution) => runtimeContribution.capabilityId),
    ).toContain(SESSION_REFERENCE_CAPABILITY_ID);
    await module.close();
  });

  it('does not load the reference session fixture in default capability module wiring', async () => {
    const module = await buildModule([], 'api');
    const registry = module.get(CapabilityRegistry);

    expect(
      registry
        .getActiveRuntimeContributions()
        .map((runtimeContribution) => runtimeContribution.capabilityId),
    ).not.toContain(SESSION_REFERENCE_CAPABILITY_ID);
    await module.close();
  });

  it('fails validation when a declared session principal lacks identity resolver binding', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.session-missing-identity',
      contributions: {
        session: {
          principals: [
            {
              principalCode: 'CLIENT',
              identityResolver: 'missingIdentityResolver',
            },
          ],
        },
      },
    })
    class MissingIdentityResolverCapability {}

    const module = await buildModule([MissingIdentityResolverCapability], 'api');
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CAPABILITY_SESSION_IDENTITY_RESOLVER_MISSING' }),
      ]),
    );
    await module.close();
  });

  it('fails validation when a decorated session identity resolver is not callable', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.session-invalid-identity',
      contributions: {
        session: {
          principals: [
            {
              principalCode: 'CLIENT',
              identityResolver: 'clientIdentityResolver',
            },
          ],
        },
      },
    })
    class InvalidIdentityResolverCapability {}

    @Injectable()
    @CapabilitySessionIdentityResolverProvider({
      capabilityId: 'test.session-invalid-identity',
      resolverName: 'clientIdentityResolver',
    })
    class InvalidIdentityResolver {}

    const module = await buildModule(
      [InvalidIdentityResolverCapability, InvalidIdentityResolver],
      'api',
    );
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CAPABILITY_SESSION_IDENTITY_RESOLVER_MISSING' }),
      ]),
    );
    await module.close();
  });

  it('reports structured issues for blank session contribution fields', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.session-blank-fields',
      contributions: {
        session: {
          principals: [
            {
              principalCode: '   ',
              identityResolver: '   ',
            },
          ],
          authorityClaims: [
            {
              claimCode: '   ',
              subjectPrincipalCode: '   ',
              summaryResolver: '   ',
              scopeAuthorizer: '   ',
            },
          ],
        },
      },
    })
    class BlankSessionFieldsCapability {}

    const module = await buildModule([BlankSessionFieldsCapability], 'api');
    const registry = module.get(CapabilityRegistry);

    expect(() => registry.validateBootstrap()).not.toThrow();
    expect(registry.validateBootstrap().issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CAPABILITY_SESSION_PRINCIPAL_CODE_INVALID' }),
        expect.objectContaining({ code: 'CAPABILITY_SESSION_IDENTITY_RESOLVER_MISSING' }),
        expect.objectContaining({ code: 'CAPABILITY_SESSION_AUTHORITY_CLAIM_CODE_INVALID' }),
        expect.objectContaining({
          code: 'CAPABILITY_SESSION_AUTHORITY_SUMMARY_RESOLVER_MISSING',
        }),
        expect.objectContaining({
          code: 'CAPABILITY_SESSION_AUTHORITY_SCOPE_AUTHORIZER_MISSING',
        }),
      ]),
    );
    await module.close();
  });

  it('fails validation when a declared authority claim lacks summary resolver or scope authorizer', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.session-missing-authority',
      contributions: {
        session: {
          principals: [
            {
              principalCode: 'CLIENT',
              identityResolver: 'clientIdentityResolver',
            },
          ],
          authorityClaims: [
            {
              claimCode: 'RESOURCE_MANAGER',
              subjectPrincipalCode: 'CLIENT',
              summaryResolver: 'missingSummaryResolver',
            },
          ],
        },
      },
    })
    class MissingAuthorityCapability {}

    @Injectable()
    @CapabilitySessionIdentityResolverProvider({
      capabilityId: 'test.session-missing-authority',
      resolverName: 'clientIdentityResolver',
    })
    class ClientIdentityResolver {
      resolveIdentity(): Promise<{ readonly principalCode: 'CLIENT' }> {
        return Promise.resolve({ principalCode: 'CLIENT' });
      }
    }

    const module = await buildModule([MissingAuthorityCapability, ClientIdentityResolver], 'api');
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CAPABILITY_SESSION_AUTHORITY_SUMMARY_RESOLVER_MISSING',
        }),
        expect.objectContaining({
          code: 'CAPABILITY_SESSION_AUTHORITY_SCOPE_AUTHORIZER_MISSING',
        }),
      ]),
    );
    await module.close();
  });

  it('fails validation when decorated authority resolver or authorizer is not callable', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.session-invalid-authority',
      contributions: {
        session: {
          principals: [
            {
              principalCode: 'CLIENT',
              identityResolver: 'clientIdentityResolver',
            },
          ],
          authorityClaims: [
            {
              claimCode: 'RESOURCE_MANAGER',
              subjectPrincipalCode: 'CLIENT',
              summaryResolver: 'resourceManagerSummaryResolver',
              scopeAuthorizer: 'resourceManagerScopeAuthorizer',
            },
          ],
        },
      },
    })
    class InvalidAuthorityCapability {}

    @Injectable()
    @CapabilitySessionIdentityResolverProvider({
      capabilityId: 'test.session-invalid-authority',
      resolverName: 'clientIdentityResolver',
    })
    class ClientIdentityResolver {
      resolveIdentity(): Promise<{ readonly principalCode: 'CLIENT' }> {
        return Promise.resolve({ principalCode: 'CLIENT' });
      }
    }

    @Injectable()
    @CapabilitySessionAuthoritySummaryResolverProvider({
      capabilityId: 'test.session-invalid-authority',
      resolverName: 'resourceManagerSummaryResolver',
    })
    class InvalidSummaryResolver {}

    @Injectable()
    @CapabilitySessionAuthorityScopeAuthorizerProvider({
      capabilityId: 'test.session-invalid-authority',
      authorizerName: 'resourceManagerScopeAuthorizer',
    })
    class InvalidScopeAuthorizer {}

    const module = await buildModule(
      [
        InvalidAuthorityCapability,
        ClientIdentityResolver,
        InvalidSummaryResolver,
        InvalidScopeAuthorizer,
      ],
      'api',
    );
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CAPABILITY_SESSION_AUTHORITY_SUMMARY_RESOLVER_MISSING',
        }),
        expect.objectContaining({
          code: 'CAPABILITY_SESSION_AUTHORITY_SCOPE_AUTHORIZER_MISSING',
        }),
      ]),
    );
    await module.close();
  });

  it('fails validation when an authority claim references an unknown subject principal', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.session-missing-subject',
      contributions: {
        session: {
          authorityClaims: [
            {
              claimCode: 'RESOURCE_MANAGER',
              subjectPrincipalCode: 'CLIENT',
              summaryResolver: 'resourceManagerSummaryResolver',
              scopeAuthorizer: 'resourceManagerScopeAuthorizer',
            },
          ],
        },
      },
    })
    class MissingSubjectCapability {}

    @Injectable()
    @CapabilitySessionAuthoritySummaryResolverProvider({
      capabilityId: 'test.session-missing-subject',
      resolverName: 'resourceManagerSummaryResolver',
    })
    class ResourceManagerSummaryResolver {
      resolveSummary(): Promise<{ readonly claimCode: 'RESOURCE_MANAGER' }> {
        return Promise.resolve({ claimCode: 'RESOURCE_MANAGER' });
      }
    }

    @Injectable()
    @CapabilitySessionAuthorityScopeAuthorizerProvider({
      capabilityId: 'test.session-missing-subject',
      authorizerName: 'resourceManagerScopeAuthorizer',
    })
    class ResourceManagerScopeAuthorizer {
      canAccessScope(): Promise<{ readonly allowed: boolean }> {
        return Promise.resolve({ allowed: true });
      }
    }

    const module = await buildModule(
      [MissingSubjectCapability, ResourceManagerSummaryResolver, ResourceManagerScopeAuthorizer],
      'api',
    );
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CAPABILITY_SESSION_SUBJECT_PRINCIPAL_MISSING' }),
      ]),
    );
    await module.close();
  });

  it('fails validation when an authority claim references another capability principal without a runtime dependency', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.session-principal-owner',
      contributions: {
        session: {
          principals: [
            {
              principalCode: 'CLIENT',
              identityResolver: 'clientIdentityResolver',
            },
          ],
        },
      },
    })
    class PrincipalOwnerCapability {}

    @Injectable()
    @CapabilitySessionIdentityResolverProvider({
      capabilityId: 'test.session-principal-owner',
      resolverName: 'clientIdentityResolver',
    })
    class ClientIdentityResolver {
      resolveIdentity(): Promise<{ readonly principalCode: 'CLIENT' }> {
        return Promise.resolve({ principalCode: 'CLIENT' });
      }
    }

    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.session-claim-owner',
      contributions: {
        session: {
          authorityClaims: [
            {
              claimCode: 'RESOURCE_MANAGER',
              subjectPrincipalCode: 'CLIENT',
              summaryResolver: 'resourceManagerSummaryResolver',
              scopeAuthorizer: 'resourceManagerScopeAuthorizer',
            },
          ],
        },
      },
    })
    class ClaimOwnerCapability {}

    @Injectable()
    @CapabilitySessionAuthoritySummaryResolverProvider({
      capabilityId: 'test.session-claim-owner',
      resolverName: 'resourceManagerSummaryResolver',
    })
    class ResourceManagerSummaryResolver {
      resolveSummary(): Promise<{ readonly claimCode: 'RESOURCE_MANAGER' }> {
        return Promise.resolve({ claimCode: 'RESOURCE_MANAGER' });
      }
    }

    @Injectable()
    @CapabilitySessionAuthorityScopeAuthorizerProvider({
      capabilityId: 'test.session-claim-owner',
      authorizerName: 'resourceManagerScopeAuthorizer',
    })
    class ResourceManagerScopeAuthorizer {
      canAccessScope(): Promise<{ readonly allowed: boolean }> {
        return Promise.resolve({ allowed: true });
      }
    }

    const module = await buildModule(
      [
        PrincipalOwnerCapability,
        ClientIdentityResolver,
        ClaimOwnerCapability,
        ResourceManagerSummaryResolver,
        ResourceManagerScopeAuthorizer,
      ],
      'api',
    );
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CAPABILITY_SESSION_SUBJECT_PRINCIPAL_DEPENDENCY_MISSING',
        }),
      ]),
    );
    await module.close();
  });

  it('allows an authority claim to reference another capability principal when a runtime dependency is declared', async () => {
    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.session-principal-dependency-owner',
      contributions: {
        session: {
          principals: [
            {
              principalCode: 'CLIENT',
              identityResolver: 'clientIdentityResolver',
            },
          ],
        },
      },
    })
    class PrincipalOwnerCapability {}

    @Injectable()
    @CapabilitySessionIdentityResolverProvider({
      capabilityId: 'test.session-principal-dependency-owner',
      resolverName: 'clientIdentityResolver',
    })
    class ClientIdentityResolver {
      resolveIdentity(): Promise<{ readonly principalCode: 'CLIENT' }> {
        return Promise.resolve({ principalCode: 'CLIENT' });
      }
    }

    @Injectable()
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.session-claim-dependency-owner',
      runtimeDependencies: [
        { capabilityId: 'test.session-principal-dependency-owner', mode: 'required' },
      ],
      contributions: {
        session: {
          authorityClaims: [
            {
              claimCode: 'RESOURCE_MANAGER',
              subjectPrincipalCode: 'CLIENT',
              summaryResolver: 'resourceManagerSummaryResolver',
              scopeAuthorizer: 'resourceManagerScopeAuthorizer',
            },
          ],
        },
      },
    })
    class ClaimOwnerCapability {}

    @Injectable()
    @CapabilitySessionAuthoritySummaryResolverProvider({
      capabilityId: 'test.session-claim-dependency-owner',
      resolverName: 'resourceManagerSummaryResolver',
    })
    class ResourceManagerSummaryResolver {
      resolveSummary(): Promise<{ readonly claimCode: 'RESOURCE_MANAGER' }> {
        return Promise.resolve({ claimCode: 'RESOURCE_MANAGER' });
      }
    }

    @Injectable()
    @CapabilitySessionAuthorityScopeAuthorizerProvider({
      capabilityId: 'test.session-claim-dependency-owner',
      authorizerName: 'resourceManagerScopeAuthorizer',
    })
    class ResourceManagerScopeAuthorizer {
      canAccessScope(): Promise<{ readonly allowed: boolean }> {
        return Promise.resolve({ allowed: true });
      }
    }

    const module = await buildModule(
      [
        PrincipalOwnerCapability,
        ClientIdentityResolver,
        ClaimOwnerCapability,
        ResourceManagerSummaryResolver,
        ResourceManagerScopeAuthorizer,
      ],
      'api',
    );
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual([]);
    expect(
      registry.getSessionIdentityResolver({
        capabilityId: 'test.session-principal-dependency-owner',
        resolverName: 'clientIdentityResolver',
      }),
    ).toBeInstanceOf(ClientIdentityResolver);
    expect(
      registry.getSessionAuthoritySummaryResolver({
        capabilityId: 'test.session-claim-dependency-owner',
        resolverName: 'resourceManagerSummaryResolver',
      }),
    ).toBeInstanceOf(ResourceManagerSummaryResolver);
    expect(
      registry.getSessionAuthorityScopeAuthorizer({
        capabilityId: 'test.session-claim-dependency-owner',
        authorizerName: 'resourceManagerScopeAuthorizer',
      }),
    ).toBeInstanceOf(ResourceManagerScopeAuthorizer);
    await module.close();
  });
});

async function buildModule(
  providers: readonly (new (...args: never[]) => object)[],
  process: 'api' | 'worker' = 'worker',
): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [CapabilityModule.forRoot({ process })],
    providers: [...providers, ...buildTestAnchorProviders(providers)],
  })
    .overrideProvider(CapabilityBootstrapCheck)
    .useValue({ onApplicationBootstrap: jest.fn() })
    .compile();
}

function buildTestAnchorProviders(
  providers: readonly (new (...args: never[]) => object)[],
): readonly (new () => object)[] {
  const declaredAnchorIds = new Set(
    providers.flatMap((provider) => {
      const anchor = Reflect.getMetadata(CAPABILITY_ANCHOR_METADATA_KEY, provider) as
        { readonly capabilityId: string } | undefined;
      return anchor ? [anchor.capabilityId] : [];
    }),
  );
  const runtimeIds = new Set(
    providers.flatMap((provider) => {
      const runtime = Reflect.getMetadata(
        CAPABILITY_RUNTIME_CONTRIBUTION_METADATA_KEY,
        provider,
      ) as { readonly capabilityId: string } | undefined;
      return runtime ? [runtime.capabilityId] : [];
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
