import { DomainError } from '@core/common/errors/domain-error';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CapabilityRuntimeStateReader } from '@src/usecases/common/ports/capability-runtime-state-reader.contract';
import { CapabilityRuntimeGuard } from './capability-runtime.guard';

describe('CapabilityRuntimeGuard', () => {
  it('allows requests without capability metadata', () => {
    const guard = new CapabilityRuntimeGuard(
      reflectorWithPolicy(undefined),
      enabledRuntimeStateReader(),
    );

    expect(guard.canActivate(executionContext())).toBe(true);
  });

  it('throws capability disabled DomainError before resolver execution', () => {
    const guard = new CapabilityRuntimeGuard(
      reflectorWithPolicy({
        capabilityId: 'test.disabled',
        operation: 'view',
        operationKind: 'query',
      }),
      {
        getCapabilityState: () => ({
          capabilityId: 'test.disabled',
          enabled: false,
          process: 'api',
          reason: 'runtime_disabled',
        }),
        getOperationState: () => ({
          capabilityId: 'test.disabled',
          enabled: false,
          process: 'api',
          operation: 'view',
          operationKind: 'query',
          reason: 'runtime_disabled',
        }),
      },
    );

    expect(() => guard.canActivate(executionContext())).toThrow(DomainError);
    try {
      guard.canActivate(executionContext());
    } catch (error) {
      expect(error).toMatchObject({
        code: 'CAPABILITY_DISABLED',
        message: 'capability_disabled',
      });
    }
  });

  it('applies class-level capability metadata to resolver methods', () => {
    class TestResolver {}
    function handler() {}
    const guard = new CapabilityRuntimeGuard(
      reflectorWithClassPolicy({
        resolver: TestResolver,
        policy: {
          capabilityId: 'test.class',
          operation: 'view',
          operationKind: 'query',
        },
      }),
      enabledRuntimeStateReader(),
    );

    expect(guard.canActivate(executionContext({ handler, resolver: TestResolver }))).toBe(true);
  });
});

function reflectorWithPolicy(policy: unknown): Reflector {
  return {
    getAllAndOverride: () => policy,
  } as unknown as Reflector;
}

function enabledRuntimeStateReader(): CapabilityRuntimeStateReader {
  return {
    getCapabilityState: () => ({
      capabilityId: 'test.enabled',
      enabled: true,
      process: 'api',
    }),
    getOperationState: () => ({
      capabilityId: 'test.enabled',
      enabled: true,
      process: 'api',
      operation: 'view',
      operationKind: 'query',
    }),
  };
}

function executionContext(): ExecutionContext;
function executionContext(input: {
  readonly handler: () => void;
  readonly resolver: new () => object;
}): ExecutionContext;
function executionContext(input?: {
  readonly handler: () => void;
  readonly resolver: new () => object;
}): ExecutionContext {
  const contextInput = input ?? {
    handler: function handler() {},
    resolver: class TestResolver {},
  };
  return {
    getHandler: () => contextInput.handler,
    getClass: () => contextInput.resolver,
  } as unknown as ExecutionContext;
}

function reflectorWithClassPolicy(input: {
  readonly resolver: new () => object;
  readonly policy: unknown;
}): Reflector {
  return {
    getAllAndOverride: (_key: string, targets: readonly unknown[]) =>
      targets.includes(input.resolver) ? input.policy : undefined,
  } as unknown as Reflector;
}
