// src/infrastructure/capability/capability.registry.spec.ts
import { Injectable } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { BULLMQ_JOBS, BULLMQ_QUEUES } from '@src/infrastructure/bullmq/bullmq.constants';
import { CapabilityBootstrapCheck } from './capability-bootstrap-check';
import {
  CapabilityManifestProvider,
  CapabilityProviderBindingProvider,
  CapabilityQueueBindingProvider,
} from './capability.decorators';
import { CapabilityModule } from './capability.module';
import { CapabilityBootstrapError, CapabilityRegistry } from './capability.registry';

describe('CapabilityRegistry', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('collects active manifests, provider bindings and queue bindings through Discovery', async () => {
    @Injectable()
    @CapabilityManifestProvider({
      id: 'test.provider',
      kind: 'technical',
      version: '0.1.0',
      processes: ['worker'],
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
    class TestProvider {
      readonly name = 'mock';
    }

    @Injectable()
    @CapabilityManifestProvider({
      id: 'test.queue',
      kind: 'technical',
      version: '0.1.0',
      processes: ['worker'],
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
    expect(registry.getActiveManifests().map((manifest) => manifest.id)).toEqual(
      expect.arrayContaining(['platform.account', 'platform.auth', 'test.provider', 'test.queue']),
    );
    expect(
      registry.getProviderClient<{ readonly name: string }>({
        providerKind: 'test.provider',
        providerName: 'mock',
      }),
    ).toBeInstanceOf(TestProvider);
    await module.close();
  });

  it('ignores manifests for other processes', async () => {
    @Injectable()
    @CapabilityManifestProvider({
      id: 'test.worker-only',
      kind: 'technical',
      version: '0.1.0',
      processes: ['worker'],
    })
    class WorkerOnlyCapability {}

    const module = await buildModule([WorkerOnlyCapability], 'api');
    const registry = module.get(CapabilityRegistry);

    expect(registry.getActiveManifests().map((manifest) => manifest.id)).not.toContain(
      'test.worker-only',
    );
    expect(registry.validateBootstrap().issues).toEqual([]);
    await module.close();
  });

  it('fails validation when a declared provider binding is missing', async () => {
    @Injectable()
    @CapabilityManifestProvider({
      id: 'test.missing-provider',
      kind: 'technical',
      version: '0.1.0',
      processes: ['worker'],
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

  it('fails validation when a declared queue job is not registered', async () => {
    @Injectable()
    @CapabilityManifestProvider({
      id: 'test.invalid-queue',
      kind: 'technical',
      version: '0.1.0',
      processes: ['worker'],
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
});

async function buildModule(
  providers: readonly (new (...args: never[]) => object)[],
  process: 'api' | 'worker' = 'worker',
): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [CapabilityModule.forRoot({ process })],
    providers: [...providers],
  })
    .overrideProvider(CapabilityBootstrapCheck)
    .useValue({ onApplicationBootstrap: jest.fn() })
    .compile();
}
