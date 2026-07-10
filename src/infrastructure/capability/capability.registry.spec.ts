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
  CapabilityOwnershipProvider,
  CapabilityRuntimeManifestProvider,
  CapabilityOperationHandlerProvider,
  CapabilityProviderBindingProvider,
  CapabilityQueueBindingProvider,
  CapabilitySessionAuthorityScopeAuthorizerProvider,
  CapabilitySessionAuthoritySummaryResolverProvider,
  CapabilitySessionIdentityResolverProvider,
  CAPABILITY_OWNERSHIP_METADATA_KEY,
  CAPABILITY_RUNTIME_MANIFEST_METADATA_KEY,
} from './capability.decorators';
import { CapabilityModule } from './capability.module';
import { CapabilityBootstrapError, CapabilityRegistry } from './capability.registry';

describe('CapabilityRegistry', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('collects active manifests, provider bindings and queue bindings through Discovery', async () => {
    @Injectable()
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.provider',
      version: '0.1.0',
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
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.queue',
      version: '0.1.0',
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
    expect(registry.getActiveRuntimeManifests().map((manifest) => manifest.capabilityId)).toEqual(
      expect.arrayContaining(['test.provider', 'test.queue']),
    );
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
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.stacked-provider',
      version: '0.1.0',
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
        createTestOwnershipProvider('test.stacked-provider'),
      ],
    })
      .overrideProvider(CapabilityBootstrapCheck)
      .useValue({ onApplicationBootstrap: jest.fn() })
      .compile();
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual([]);
    expect(
      registry
        .getActiveRuntimeManifests()
        .filter((manifest) => manifest.capabilityId === 'test.stacked-provider'),
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

  it('discovers runtime manifests installed in the current Nest container', async () => {
    @Injectable()
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.worker-only',
      version: '0.1.0',
    })
    class WorkerOnlyCapability {}

    const module = await buildModule([WorkerOnlyCapability], 'api');
    const registry = module.get(CapabilityRegistry);

    expect(registry.getActiveRuntimeManifests().map((manifest) => manifest.capabilityId)).toContain(
      'test.worker-only',
    );
    expect(registry.validateBootstrap().issues).toEqual([]);
    await module.close();
  });

  it('fails validation when a declared provider binding is missing', async () => {
    @Injectable()
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.missing-provider',
      version: '0.1.0',
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
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.cycle-a',
      version: '0.1.0',
      runtimeDependencies: [{ capabilityId: 'test.cycle-b', mode: 'required' }],
    })
    class CycleACapability {}

    @Injectable()
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.cycle-b',
      version: '0.1.0',
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
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.linear-a',
      version: '0.1.0',
      runtimeDependencies: [{ capabilityId: 'test.linear-b', mode: 'required' }],
    })
    class LinearACapability {}

    @Injectable()
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.linear-b',
      version: '0.1.0',
    })
    class LinearBCapability {}

    const module = await buildModule([LinearACapability, LinearBCapability]);
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual([]);
    await module.close();
  });

  it('collects GraphQL API surface from runtime contributions', async () => {
    @Injectable()
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.surface-owner',
      version: '0.1.0',
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
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.invalid-surface',
      version: '0.1.0',
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
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.invalid-queue',
      version: '0.1.0',
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
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.missing-health',
      version: '0.1.0',
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
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.operation-missing-handler',
      version: '0.1.0',
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
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.operation-duplicate-handler',
      version: '0.1.0',
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
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.operation-process-mismatch',
      version: '0.1.0',
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
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.operation-warning',
      version: '0.1.0',
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
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.operation-queue',
      version: '0.1.0',
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
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.operation-event',
      version: '0.1.0',
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
    expect(registry.getActiveRuntimeManifests().map((manifest) => manifest.capabilityId)).toContain(
      SESSION_REFERENCE_CAPABILITY_ID,
    );
    await module.close();
  });

  it('does not load the reference session fixture in default capability module wiring', async () => {
    const module = await buildModule([], 'api');
    const registry = module.get(CapabilityRegistry);

    expect(
      registry.getActiveRuntimeManifests().map((manifest) => manifest.capabilityId),
    ).not.toContain(SESSION_REFERENCE_CAPABILITY_ID);
    await module.close();
  });

  it('fails validation when a declared session principal lacks identity resolver binding', async () => {
    @Injectable()
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.session-missing-identity',
      version: '0.1.0',
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
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.session-invalid-identity',
      version: '0.1.0',
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
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.session-blank-fields',
      version: '0.1.0',
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
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.session-missing-authority',
      version: '0.1.0',
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
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.session-invalid-authority',
      version: '0.1.0',
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
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.session-missing-subject',
      version: '0.1.0',
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
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.session-principal-owner',
      version: '0.1.0',
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
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.session-claim-owner',
      version: '0.1.0',
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
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.session-principal-dependency-owner',
      version: '0.1.0',
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
    @CapabilityRuntimeManifestProvider({
      capabilityId: 'test.session-claim-dependency-owner',
      version: '0.1.0',
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
    providers: [...providers, ...buildTestOwnershipProviders(providers)],
  })
    .overrideProvider(CapabilityBootstrapCheck)
    .useValue({ onApplicationBootstrap: jest.fn() })
    .compile();
}

function buildTestOwnershipProviders(
  providers: readonly (new (...args: never[]) => object)[],
): readonly (new () => object)[] {
  const declaredOwnershipIds = new Set(
    providers.flatMap((provider) => {
      const ownership = Reflect.getMetadata(CAPABILITY_OWNERSHIP_METADATA_KEY, provider) as
        { readonly capabilityId: string } | undefined;
      return ownership ? [ownership.capabilityId] : [];
    }),
  );
  const runtimeIds = new Set(
    providers.flatMap((provider) => {
      const runtime = Reflect.getMetadata(CAPABILITY_RUNTIME_MANIFEST_METADATA_KEY, provider) as
        { readonly capabilityId: string } | undefined;
      return runtime ? [runtime.capabilityId] : [];
    }),
  );
  return [...runtimeIds]
    .filter((capabilityId) => !declaredOwnershipIds.has(capabilityId))
    .map((capabilityId) => createTestOwnershipProvider(capabilityId));
}

function createTestOwnershipProvider(capabilityId: string): new () => object {
  @Injectable()
  @CapabilityOwnershipProvider({
    capabilityId,
    kind: 'technical',
    semanticScope: `Test ownership for ${capabilityId}.`,
    owns: [`Test runtime facts for ${capabilityId}.`],
    nonGoals: ['Production capability ownership.'],
    physicalScopes: [
      { path: 'src/infrastructure/capability/capability.registry.spec.ts', role: 'primary' },
    ],
    publicSurfaces: [{ status: 'not-required', reason: 'Registry test fixture.' }],
    allowedDependencies: [],
    foundationClassification: 'domain-owned',
    validationEntrypoints: ['src/infrastructure/capability/capability.registry.spec.ts'],
  })
  class TestCapabilityOwnership {}

  return TestCapabilityOwnership;
}
