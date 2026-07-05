import type { CapabilityRequestContext } from '@app-types/common/capability.types';

export const CAPABILITY_REQUEST_CONTEXT_STORE = Symbol('CAPABILITY_REQUEST_CONTEXT_STORE');

export interface CapabilityRequestContextStore {
  run<T>(context: CapabilityRequestContext, callback: () => Promise<T>): Promise<T>;
  getCurrent(): CapabilityRequestContext | null;
  requireCurrent(): CapabilityRequestContext;
}
