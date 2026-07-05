import { Test, type TestingModule } from '@nestjs/testing';
import {
  CAPABILITY_REQUEST_CONTEXT_STORE,
  type CapabilityRequestContextStore,
} from '@src/usecases/common/ports/capability-request-context-store.contract';
import {
  CAPABILITY_SESSION_CONTEXT_BUILDER,
  type CapabilitySessionContextBuilder,
} from '@src/usecases/common/ports/capability-session-context-builder.contract';
import { SESSION_REFERENCE_CAPABILITY_PROVIDERS } from '../../../test/support/capability/session-reference.fixture';
import { CapabilityBootstrapCheck } from './capability-bootstrap-check';
import { CapabilityModule } from './capability.module';

describe('RegistryCapabilitySessionContextBuilder', () => {
  it('builds capability context from current JWT-compatible session fields', async () => {
    const module = await buildModule([]);
    const builder = module.get<CapabilitySessionContextBuilder>(CAPABILITY_SESSION_CONTEXT_BUILDER);

    const context = await builder.build({
      traceId: 'trace-1',
      requestId: 'request-1',
      accountId: 123,
      activeRole: 'STAFF',
      accessGroup: ['staff', 'STAFF', ''],
      source: 'account',
      entryPoint: 'graphql-api',
    });

    expect(context).toEqual({
      traceId: 'trace-1',
      requestId: 'request-1',
      actor: {
        accountId: 123,
        activeRole: 'STAFF',
        accessGroup: ['STAFF'],
        principalCodes: [],
        authorityClaims: [],
        source: 'account',
      },
      entryPoint: 'graphql-api',
    });
    await module.close();
  });

  it('calls session contribution resolvers to fill principal and authority claim codes', async () => {
    const module = await buildModule([...SESSION_REFERENCE_CAPABILITY_PROVIDERS]);
    const builder = module.get<CapabilitySessionContextBuilder>(CAPABILITY_SESSION_CONTEXT_BUILDER);

    const context = await builder.build({
      traceId: 'trace-2',
      requestId: 'request-2',
      accountId: 456,
      activeRole: null,
      accessGroup: ['client'],
      source: 'account',
      entryPoint: 'graphql-api',
    });

    expect(context.actor).toEqual({
      accountId: 456,
      activeRole: null,
      accessGroup: ['CLIENT'],
      principalCodes: ['CLIENT'],
      authorityClaims: ['RESOURCE_MANAGER'],
      source: 'account',
    });
    await module.close();
  });

  it('stores the built context inside the request context store boundary', async () => {
    const module = await buildModule([...SESSION_REFERENCE_CAPABILITY_PROVIDERS]);
    const builder = module.get<CapabilitySessionContextBuilder>(CAPABILITY_SESSION_CONTEXT_BUILDER);
    const store = module.get<CapabilityRequestContextStore>(CAPABILITY_REQUEST_CONTEXT_STORE);
    const context = await builder.build({
      traceId: 'trace-3',
      requestId: 'request-3',
      accountId: 789,
      accessGroup: ['client'],
      source: 'account',
      entryPoint: 'graphql-api',
    });

    expect(store.getCurrent()).toBeNull();

    await store.run(context, () => {
      expect(store.requireCurrent()).toBe(context);
      return Promise.resolve();
    });

    expect(store.getCurrent()).toBeNull();
    await module.close();
  });
});

async function buildModule(
  providers: readonly (new (...args: never[]) => object)[],
): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [CapabilityModule.forRoot({ process: 'api' })],
    providers: [...providers],
  })
    .overrideProvider(CapabilityBootstrapCheck)
    .useValue({ onApplicationBootstrap: jest.fn() })
    .compile();
}
