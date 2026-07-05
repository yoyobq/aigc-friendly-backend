import type {
  CapabilityId,
  CapabilityOperationKind,
  CapabilityProcess,
} from '@app-types/common/capability.types';

export const CAPABILITY_RUNTIME_STATE_READER = Symbol('CAPABILITY_RUNTIME_STATE_READER');

export type CapabilityRuntimeDisableReason =
  | 'not_installed'
  | 'kill_switch'
  | 'runtime_disabled'
  | 'operation_disabled'
  | 'manifest_default_disabled';

export interface CapabilityRuntimeState {
  readonly capabilityId: CapabilityId;
  readonly enabled: boolean;
  readonly process: CapabilityProcess;
  readonly reason?: CapabilityRuntimeDisableReason;
}

export interface CapabilityOperationRuntimeState extends CapabilityRuntimeState {
  readonly operation: string;
  readonly operationKind: Exclude<CapabilityOperationKind, 'event'>;
}

export interface CapabilityRuntimeStateReader {
  getCapabilityState(capabilityId: CapabilityId): CapabilityRuntimeState;
  getOperationState(input: {
    readonly capabilityId: CapabilityId;
    readonly operation: string;
    readonly operationKind: Exclude<CapabilityOperationKind, 'event'>;
  }): CapabilityOperationRuntimeState;
}
