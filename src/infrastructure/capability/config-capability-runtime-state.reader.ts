import type {
  CapabilityId,
  CapabilityOperationKind,
  CapabilityProcess,
} from '@app-types/common/capability.types';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type CapabilityOperationRuntimeState,
  type CapabilityRuntimeState,
  type CapabilityRuntimeStateReader,
} from '@src/usecases/common/ports/capability-runtime-state-reader.contract';
import { CAPABILITY_PROCESS, CapabilityRegistry } from './capability.registry';

@Injectable()
export class ConfigCapabilityRuntimeStateReader implements CapabilityRuntimeStateReader {
  constructor(
    @Inject(CAPABILITY_PROCESS)
    private readonly currentProcess: CapabilityProcess,
    private readonly capabilityRegistry: CapabilityRegistry,
    @Optional()
    private readonly configService?: ConfigService,
  ) {}

  getCapabilityState(capabilityId: CapabilityId): CapabilityRuntimeState {
    const manifest = this.capabilityRegistry
      .getActiveManifests()
      .find((item) => normalizeCapabilityId(item.id) === normalizeCapabilityId(capabilityId));
    if (!manifest) {
      return {
        capabilityId,
        enabled: false,
        process: this.currentProcess,
        reason: 'not_installed',
      };
    }
    if (manifest.kind === 'platform') {
      return {
        capabilityId: manifest.id,
        enabled: true,
        process: this.currentProcess,
      };
    }
    if (
      this.readCapabilityIdSet('capabilityRuntime.killSwitchIds').has(
        normalizeCapabilityId(manifest.id),
      )
    ) {
      return {
        capabilityId: manifest.id,
        enabled: false,
        process: this.currentProcess,
        reason: 'kill_switch',
      };
    }
    if (
      this.readCapabilityIdSet('capabilityRuntime.disabledIds').has(
        normalizeCapabilityId(manifest.id),
      )
    ) {
      return {
        capabilityId: manifest.id,
        enabled: false,
        process: this.currentProcess,
        reason: 'runtime_disabled',
      };
    }
    if (manifest.runtime?.defaultState === 'disabled') {
      return {
        capabilityId: manifest.id,
        enabled: false,
        process: this.currentProcess,
        reason: 'manifest_default_disabled',
      };
    }
    return {
      capabilityId: manifest.id,
      enabled: true,
      process: this.currentProcess,
    };
  }

  getOperationState(input: {
    readonly capabilityId: CapabilityId;
    readonly operation: string;
    readonly operationKind: Exclude<CapabilityOperationKind, 'event'>;
  }): CapabilityOperationRuntimeState {
    const capabilityState = this.getCapabilityState(input.capabilityId);
    if (!capabilityState.enabled) {
      return {
        ...capabilityState,
        operation: input.operation,
        operationKind: input.operationKind,
      };
    }
    const operationKey = buildOperationRuntimeKey(input);
    if (this.readOperationKeySet('capabilityRuntime.operationDisabledKeys').has(operationKey)) {
      return {
        capabilityId: capabilityState.capabilityId,
        enabled: false,
        process: this.currentProcess,
        operation: input.operation,
        operationKind: input.operationKind,
        reason: 'operation_disabled',
      };
    }
    const descriptor = this.capabilityRegistry.getOperationDescriptor(input);
    if (!descriptor?.enabled) {
      return {
        capabilityId: capabilityState.capabilityId,
        enabled: false,
        process: this.currentProcess,
        operation: input.operation,
        operationKind: input.operationKind,
        reason: descriptor ? 'manifest_default_disabled' : 'not_installed',
      };
    }
    return {
      capabilityId: capabilityState.capabilityId,
      enabled: true,
      process: this.currentProcess,
      operation: input.operation,
      operationKind: input.operationKind,
    };
  }

  private readCapabilityIdSet(configKey: string): ReadonlySet<string> {
    return new Set(this.readStringList(configKey).map(normalizeCapabilityId));
  }

  private readOperationKeySet(configKey: string): ReadonlySet<string> {
    return new Set(this.readStringList(configKey).map(normalizeOperationRuntimeKey));
  }

  private readStringList(configKey: string): readonly string[] {
    const raw = this.configService?.get<unknown>(configKey);
    if (Array.isArray(raw)) {
      return raw
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
    if (typeof raw === 'string') {
      return raw
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
    return [];
  }
}

function buildOperationRuntimeKey(input: {
  readonly capabilityId: CapabilityId;
  readonly operation: string;
  readonly operationKind: Exclude<CapabilityOperationKind, 'event'>;
}): string {
  return normalizeOperationRuntimeKey(
    `${input.capabilityId}:${input.operationKind}:${input.operation}`,
  );
}

function normalizeCapabilityId(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeOperationRuntimeKey(value: string): string {
  const [capabilityId, operationKind, operation] = value.split(':');
  return [
    normalizeCapabilityId(capabilityId ?? ''),
    (operationKind ?? '').trim().toLowerCase(),
    (operation ?? '').trim().toLowerCase(),
  ].join(':');
}
