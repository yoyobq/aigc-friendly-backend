import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  CAPABILITY_RUNTIME_STATE_READER,
  type CapabilityRuntimeStateReader,
} from '@src/usecases/common/ports/capability-runtime-state-reader.contract';
import { CapabilityBootstrapCheck } from './capability-bootstrap-check';
import { CapabilityManifestProvider } from './capability.decorators';
import { CapabilityModule } from './capability.module';

describe('ConfigCapabilityRuntimeStateReader', () => {
  it('keeps platform capabilities enabled even when runtime config disables them', async () => {
    const module = await Test.createTestingModule({
      imports: [CapabilityModule.forRoot({ process: 'api' })],
      providers: [],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string) =>
          key === 'capabilityRuntime.disabledIds' ? ['platform.account'] : undefined,
      })
      .overrideProvider(CapabilityBootstrapCheck)
      .useValue({ onApplicationBootstrap: jest.fn() })
      .compile();

    const reader = module.get<CapabilityRuntimeStateReader>(CAPABILITY_RUNTIME_STATE_READER);

    expect(reader.getCapabilityState('platform.account')).toMatchObject({
      capabilityId: 'platform.account',
      enabled: true,
    });
    await module.close();
  });

  it('applies kill switch before runtime disabled and operation disabled', async () => {
    @Injectable()
    @CapabilityManifestProvider({
      id: 'test.runtime',
      kind: 'business',
      displayName: 'Test Runtime',
      version: '0.1.0',
      processes: ['api'],
      operations: {
        commands: [{ kind: 'command', name: 'publish', sideEffects: 'internal' }],
      },
    })
    class RuntimeCapability {}

    const module = await Test.createTestingModule({
      imports: [CapabilityModule.forRoot({ process: 'api' })],
      providers: [RuntimeCapability],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string) => {
          if (key === 'capabilityRuntime.killSwitchIds') return ['test.runtime'];
          if (key === 'capabilityRuntime.disabledIds') return ['test.runtime'];
          if (key === 'capabilityRuntime.operationDisabledKeys') {
            return ['test.runtime:command:publish'];
          }
          return undefined;
        },
      })
      .overrideProvider(CapabilityBootstrapCheck)
      .useValue({ onApplicationBootstrap: jest.fn() })
      .compile();

    const reader = module.get<CapabilityRuntimeStateReader>(CAPABILITY_RUNTIME_STATE_READER);

    expect(
      reader.getOperationState({
        capabilityId: 'test.runtime',
        operation: 'publish',
        operationKind: 'command',
      }),
    ).toMatchObject({
      enabled: false,
      reason: 'kill_switch',
    });
    await module.close();
  });

  it('uses operation disabled keys after capability state is enabled', async () => {
    @Injectable()
    @CapabilityManifestProvider({
      id: 'test.operation-state',
      kind: 'business',
      displayName: 'Test Operation State',
      version: '0.1.0',
      processes: ['api'],
      operations: {
        commands: [{ kind: 'command', name: 'publish', sideEffects: 'internal' }],
      },
    })
    class OperationStateCapability {}

    const module = await Test.createTestingModule({
      imports: [CapabilityModule.forRoot({ process: 'api' })],
      providers: [OperationStateCapability],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string) =>
          key === 'capabilityRuntime.operationDisabledKeys'
            ? ['test.operation-state:command:publish']
            : undefined,
      })
      .overrideProvider(CapabilityBootstrapCheck)
      .useValue({ onApplicationBootstrap: jest.fn() })
      .compile();

    const reader = module.get<CapabilityRuntimeStateReader>(CAPABILITY_RUNTIME_STATE_READER);

    expect(
      reader.getOperationState({
        capabilityId: 'test.operation-state',
        operation: 'publish',
        operationKind: 'command',
      }),
    ).toMatchObject({
      enabled: false,
      reason: 'operation_disabled',
    });
    await module.close();
  });
});
