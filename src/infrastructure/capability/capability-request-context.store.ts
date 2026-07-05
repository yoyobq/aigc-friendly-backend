import type { CapabilityRequestContext } from '@app-types/common/capability.types';
import { Injectable } from '@nestjs/common';
import type { CapabilityRequestContextStore } from '@src/usecases/common/ports/capability-request-context-store.contract';
import { AsyncLocalStorage } from 'node:async_hooks';

@Injectable()
export class AsyncLocalStorageCapabilityRequestContextStore implements CapabilityRequestContextStore {
  private readonly storage = new AsyncLocalStorage<CapabilityRequestContext>();

  async run<T>(context: CapabilityRequestContext, callback: () => Promise<T>): Promise<T> {
    return await this.storage.run(context, callback);
  }

  getCurrent(): CapabilityRequestContext | null {
    return this.storage.getStore() ?? null;
  }

  requireCurrent(): CapabilityRequestContext {
    const context = this.getCurrent();
    if (!context) {
      throw new Error('capability_request_context_missing');
    }
    return context;
  }
}
