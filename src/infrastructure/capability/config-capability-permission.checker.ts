import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CapabilityPermissionCheckInput,
  CapabilityPermissionChecker,
} from '@src/usecases/common/ports/capability-bus.contract';

@Injectable()
export class ConfigCapabilityPermissionChecker implements CapabilityPermissionChecker {
  constructor(
    @Optional()
    private readonly configService?: ConfigService,
  ) {}

  canAccess(input: CapabilityPermissionCheckInput): Promise<boolean> {
    const requiredPermissions = input.descriptor.requiredPermissions ?? [];
    if (requiredPermissions.length === 0) {
      return Promise.resolve(true);
    }
    const actorPermissionSet = this.buildActorPermissionSet(input);
    const roleGrantMap = this.readRoleGrantMap();
    const actorRoles = new Set(
      [
        ...(input.envelope.context.actor.accessGroup ?? []),
        input.envelope.context.actor.activeRole ?? undefined,
      ]
        .filter((role): role is string => typeof role === 'string' && role.trim().length > 0)
        .map(normalizeToken),
    );

    const allowed = requiredPermissions.every((permission) => {
      const normalizedPermission = normalizeToken(permission);
      if (actorPermissionSet.has(normalizedPermission)) {
        return true;
      }
      const grantedRoles = roleGrantMap.get(normalizedPermission) ?? new Set<string>();
      return [...actorRoles].some((role) => grantedRoles.has(role));
    });
    return Promise.resolve(allowed);
  }

  private buildActorPermissionSet(input: CapabilityPermissionCheckInput): ReadonlySet<string> {
    return new Set(
      [
        ...(input.envelope.context.actor.principalCodes ?? []),
        ...(input.envelope.context.actor.authorityClaims ?? []),
      ].map(normalizeToken),
    );
  }

  private readRoleGrantMap(): ReadonlyMap<string, ReadonlySet<string>> {
    const raw = this.configService?.get<
      Readonly<Record<string, readonly string[]>> | string | undefined
    >('capabilityRuntime.permissionGrants');
    if (!raw) {
      return new Map();
    }
    if (typeof raw === 'string') {
      return parsePermissionGrantString(raw);
    }
    return new Map(
      Object.entries(raw).map(([permission, roles]) => [
        normalizeToken(permission),
        new Set(roles.map(normalizeToken)),
      ]),
    );
  }
}

function parsePermissionGrantString(raw: string): ReadonlyMap<string, ReadonlySet<string>> {
  const result = new Map<string, ReadonlySet<string>>();
  for (const entry of raw.split(';')) {
    const [permission, rolesRaw] = entry.split('=');
    const normalizedPermission = normalizeToken(permission ?? '');
    if (!normalizedPermission || !rolesRaw) {
      continue;
    }
    const roles = rolesRaw
      .split('|')
      .map(normalizeToken)
      .filter((role) => role.length > 0);
    result.set(normalizedPermission, new Set(roles));
  }
  return result;
}

function normalizeToken(value: string): string {
  return value.trim().toUpperCase();
}
