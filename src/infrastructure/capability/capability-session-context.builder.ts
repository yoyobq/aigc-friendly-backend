import type {
  CapabilityActorContext,
  CapabilityRequestContext,
} from '@app-types/common/capability.types';
import { Injectable } from '@nestjs/common';
import type {
  BuildCapabilitySessionContextInput,
  CapabilitySessionContextBuilder,
} from '@src/usecases/common/ports/capability-session-context-builder.contract';
import { randomUUID } from 'node:crypto';
import { CapabilityRegistry } from './capability.registry';

@Injectable()
export class RegistryCapabilitySessionContextBuilder implements CapabilitySessionContextBuilder {
  constructor(private readonly capabilityRegistry: CapabilityRegistry) {}

  async build(input: BuildCapabilitySessionContextInput): Promise<CapabilityRequestContext> {
    const accessGroup = normalizeStringList(input.accessGroup ?? []);
    const baseActor: CapabilityActorContext = {
      ...(input.accountId === undefined ? {} : { accountId: input.accountId }),
      activeRole: normalizeOptionalText(input.activeRole),
      accessGroup,
      source: input.source,
    };
    const principalCodes = await this.resolvePrincipalCodes(baseActor);
    const authorityActor: CapabilityActorContext = {
      ...baseActor,
      principalCodes,
    };
    const authorityClaims = await this.resolveAuthorityClaims(authorityActor);
    const actor: CapabilityActorContext = {
      ...authorityActor,
      authorityClaims,
    };

    return {
      traceId: normalizeOptionalText(input.traceId) ?? randomUUID(),
      requestId: normalizeOptionalText(input.requestId) ?? randomUUID(),
      actor,
      entryPoint: input.entryPoint,
      ...(input.tenantId === undefined ? {} : { tenantId: input.tenantId }),
      ...(input.locale === undefined ? {} : { locale: input.locale }),
      ...(input.ip === undefined ? {} : { ip: input.ip }),
      ...(input.userAgent === undefined ? {} : { userAgent: input.userAgent }),
    };
  }

  private async resolvePrincipalCodes(actor: CapabilityActorContext): Promise<readonly string[]> {
    const codes: string[] = [];
    for (const manifest of this.capabilityRegistry.getActiveRuntimeManifests()) {
      for (const principal of manifest.contributions?.session?.principals ?? []) {
        const resolver = this.capabilityRegistry.getSessionIdentityResolver({
          capabilityId: manifest.capabilityId,
          resolverName: principal.identityResolver,
        });
        if (!resolver) {
          continue;
        }
        const resolution = await resolver.resolveIdentity({ actor, principal });
        if (resolution) {
          codes.push(resolution.principalCode);
        }
      }
    }
    return normalizeSessionCodes(codes);
  }

  private async resolveAuthorityClaims(actor: CapabilityActorContext): Promise<readonly string[]> {
    const codes: string[] = [];
    for (const manifest of this.capabilityRegistry.getActiveRuntimeManifests()) {
      for (const claim of manifest.contributions?.session?.authorityClaims ?? []) {
        const resolver = this.capabilityRegistry.getSessionAuthoritySummaryResolver({
          capabilityId: manifest.capabilityId,
          resolverName: claim.summaryResolver,
        });
        if (!resolver) {
          continue;
        }
        const summary = await resolver.resolveSummary({ actor, claim });
        if (summary) {
          codes.push(summary.claimCode);
        }
      }
    }
    return normalizeSessionCodes(codes);
  }
}

function normalizeStringList(values: readonly string[]): readonly string[] {
  const normalized = values
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length > 0);
  return Array.from(new Set(normalized));
}

function normalizeSessionCodes(values: readonly string[]): readonly string[] {
  return normalizeStringList(values);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
