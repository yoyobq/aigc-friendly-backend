import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  CAPABILITY_RUNTIME_STATE_READER,
  type CapabilityRuntimeStateReader,
} from '@src/usecases/common/ports/capability-runtime-state-reader.contract';
import { CapabilityBootstrapCheck } from './capability-bootstrap-check';
import {
  CapabilityAnchorProvider,
  CapabilityRuntimeContributionProvider,
} from './capability.decorators';
import { CapabilityModule } from './capability.module';
import { ConfigCapabilityRuntimeStateReader } from './config-capability-runtime-state.reader';

describe('ConfigCapabilityRuntimeStateReader', () => {
  it('reports capabilities without a current-process anchor as not installed', async () => {
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
      enabled: false,
      reason: 'not_installed',
    });
    expect(module.get(ConfigCapabilityRuntimeStateReader).getConfigurationWarnings()).toEqual([
      expect.objectContaining({
        capabilityId: 'platform.account',
        source: 'disabled_ids',
        message: 'capability_config_not_installed:api:disabled_ids:platform.account',
      }),
    ]);
    await module.close();
  });

  it('applies kill switch before runtime disabled and operation disabled', async () => {
    @Injectable()
    @CapabilityAnchorProvider({
      capabilityId: 'test.runtime',
      mode: 'switchable',
      decisionRef: 'docs/capabilities/current.md',
    })
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.runtime',
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
    @CapabilityAnchorProvider({
      capabilityId: 'test.operation-state',
      mode: 'switchable',
      decisionRef: 'docs/capabilities/current.md',
    })
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.operation-state',
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

  it('keeps always-on capabilities enabled and reports ignored disable configuration', async () => {
    @Injectable()
    @CapabilityAnchorProvider({
      capabilityId: 'test.always-on',
      mode: 'always-on',
      decisionRef: 'docs/capabilities/current.md',
    })
    @CapabilityRuntimeContributionProvider({
      capabilityId: 'test.always-on',
      runtime: { defaultState: 'disabled' },
    })
    class AlwaysOnCapability {}

    const module = await Test.createTestingModule({
      imports: [CapabilityModule.forRoot({ process: 'api' })],
      providers: [AlwaysOnCapability],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string) => {
          if (key === 'capabilityRuntime.disabledIds') return ['test.always-on'];
          if (key === 'capabilityRuntime.killSwitchIds') return ['test.always-on'];
          return undefined;
        },
      })
      .overrideProvider(CapabilityBootstrapCheck)
      .useValue({ onApplicationBootstrap: jest.fn() })
      .compile();

    const reader = module.get(ConfigCapabilityRuntimeStateReader);

    expect(reader.getCapabilityState('test.always-on')).toMatchObject({
      capabilityId: 'test.always-on',
      enabled: true,
    });
    expect(reader.getConfigurationWarnings()).toEqual([
      expect.objectContaining({ source: 'disabled_ids' }),
      expect.objectContaining({ source: 'kill_switch_ids' }),
    ]);
    await module.close();
  });
});
