import type { CapabilityCommand } from '@app-types/common/capability.types';
import { ConfigService } from '@nestjs/config';
import { ConfigCapabilityPermissionChecker } from './config-capability-permission.checker';

describe('ConfigCapabilityPermissionChecker', () => {
  it('allows operations without required permissions', async () => {
    const checker = new ConfigCapabilityPermissionChecker();

    await expect(
      checker.canAccess({
        descriptor: {
          capabilityId: 'test.permission',
          operation: 'publish',
          operationKind: 'command',
          transport: 'in-process',
          enabled: true,
        },
        envelope: commandEnvelope(),
      }),
    ).resolves.toBe(true);
  });

  it('allows configured role grants and denies missing grants', async () => {
    const checker = new ConfigCapabilityPermissionChecker({
      get: (key: string) =>
        key === 'capabilityRuntime.permissionGrants'
          ? { ['content.publish']: ['STAFF', 'ADMIN'] }
          : undefined,
    } as ConfigService);

    await expect(
      checker.canAccess({
        descriptor: {
          capabilityId: 'test.permission',
          operation: 'publish',
          operationKind: 'command',
          transport: 'in-process',
          enabled: true,
          requiredPermissions: ['content.publish'],
        },
        envelope: commandEnvelope(),
      }),
    ).resolves.toBe(true);
    await expect(
      checker.canAccess({
        descriptor: {
          capabilityId: 'test.permission',
          operation: 'delete',
          operationKind: 'command',
          transport: 'in-process',
          enabled: true,
          requiredPermissions: ['content.delete'],
        },
        envelope: commandEnvelope(),
      }),
    ).resolves.toBe(false);
  });

  it('allows direct principal and authority claim permission codes', async () => {
    const checker = new ConfigCapabilityPermissionChecker();

    await expect(
      checker.canAccess({
        descriptor: {
          capabilityId: 'test.permission',
          operation: 'publish',
          operationKind: 'command',
          transport: 'in-process',
          enabled: true,
          requiredPermissions: ['CLIENT', 'RESOURCE_MANAGER'],
        },
        envelope: commandEnvelope({
          principalCodes: ['CLIENT'],
          authorityClaims: ['RESOURCE_MANAGER'],
        }),
      }),
    ).resolves.toBe(true);
  });
});

function commandEnvelope(input?: {
  readonly principalCodes?: readonly string[];
  readonly authorityClaims?: readonly string[];
}): CapabilityCommand<{ readonly ok: true }> {
  return {
    capability: 'test.permission',
    operation: 'publish',
    operationKind: 'command',
    context: {
      traceId: 'trace-1',
      requestId: 'request-1',
      actor: {
        source: 'account',
        accessGroup: ['STAFF'],
        ...(input?.principalCodes === undefined ? {} : { principalCodes: input.principalCodes }),
        ...(input?.authorityClaims === undefined ? {} : { authorityClaims: input.authorityClaims }),
      },
    },
    payload: { ok: true },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}
