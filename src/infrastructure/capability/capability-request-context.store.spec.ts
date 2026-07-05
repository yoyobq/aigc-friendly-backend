import type { CapabilityRequestContext } from '@app-types/common/capability.types';
import { AsyncLocalStorageCapabilityRequestContextStore } from './capability-request-context.store';

describe('AsyncLocalStorageCapabilityRequestContextStore', () => {
  it('keeps capability request context inside the async boundary only', async () => {
    const store = new AsyncLocalStorageCapabilityRequestContextStore();
    const context: CapabilityRequestContext = {
      traceId: 'trace-1',
      requestId: 'request-1',
      entryPoint: 'graphql-api',
      actor: {
        accountId: 123,
        activeRole: 'STAFF',
        accessGroup: ['STAFF'],
        source: 'account',
      },
    };

    expect(store.getCurrent()).toBeNull();
    expect(() => store.requireCurrent()).toThrow('capability_request_context_missing');

    await store.run(context, async () => {
      expect(store.getCurrent()).toBe(context);
      await Promise.resolve();
      expect(store.requireCurrent()).toBe(context);
    });

    expect(store.getCurrent()).toBeNull();
  });
});
