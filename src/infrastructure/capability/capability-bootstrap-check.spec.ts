import { Logger } from '@nestjs/common';
import { CapabilityBootstrapCheck } from './capability-bootstrap-check';
import { CapabilityRegistry } from './capability.registry';
import { ConfigCapabilityRuntimeStateReader } from './config-capability-runtime-state.reader';

describe('CapabilityBootstrapCheck', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs non-blocking topology and runtime configuration warnings at bootstrap', () => {
    const registry = {
      validateBootstrap: jest.fn().mockReturnValue({
        process: 'api',
        issues: [
          {
            code: 'CAPABILITY_OPERATION_HANDLER_NOT_DECLARED',
            capabilityId: 'test.warning',
            severity: 'warning',
            message: 'capability_operation_handler_not_declared:test.warning',
          },
        ],
      }),
    } as unknown as CapabilityRegistry;
    const runtimeStateReader = {
      getConfigurationWarnings: jest.fn().mockReturnValue([
        {
          capabilityId: 'test.always-on',
          source: 'disabled_ids',
          message: 'capability_config_ignored_always_on:api:disabled_ids:test.always-on',
        },
      ]),
    } as unknown as ConfigCapabilityRuntimeStateReader;
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    new CapabilityBootstrapCheck(registry, runtimeStateReader).onApplicationBootstrap();

    expect(warn).toHaveBeenCalledWith('capability_operation_handler_not_declared:test.warning');
    expect(warn).toHaveBeenCalledWith(
      'capability_config_ignored_always_on:api:disabled_ids:test.always-on',
    );
  });
});
