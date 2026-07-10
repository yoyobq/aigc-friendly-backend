import type { CapabilityRequestContext } from '@app-types/common/capability.types';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  BuildReferenceReportUsecase,
  REFERENCE_PROFILE_FIXTURE_PROVIDERS,
} from '../../../test/support/capability/reference-profile.fixture';
import {
  CAPABILITY_REQUEST_CONTEXT_STORE,
  type CapabilityRequestContextStore,
} from '../../usecases/common/ports/capability-request-context-store.contract';
import { CapabilityBootstrapCheck } from './capability-bootstrap-check';
import {
  CAPABILITY_ANCHOR_METADATA_KEY,
  CAPABILITY_RUNTIME_CONTRIBUTION_METADATA_KEY,
} from './capability.decorators';
import { CapabilityModule } from './capability.module';
import { CapabilityRegistry } from './capability.registry';

describe('Capability boundary reference', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CapabilityModule.forRoot({ process: 'api' })],
      providers: [...REFERENCE_PROFILE_FIXTURE_PROVIDERS],
    })
      .overrideProvider(CapabilityBootstrapCheck)
      .useValue({ onApplicationBootstrap: jest.fn() })
      .compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('keeps a typed-client composition usecase outside capability ownership', async () => {
    expect(Reflect.getMetadata(CAPABILITY_ANCHOR_METADATA_KEY, BuildReferenceReportUsecase)).toBe(
      undefined,
    );
    expect(
      Reflect.getMetadata(
        CAPABILITY_RUNTIME_CONTRIBUTION_METADATA_KEY,
        BuildReferenceReportUsecase,
      ),
    ).toBe(undefined);

    const registry = module.get(CapabilityRegistry);
    expect(registry.validateBootstrap().issues).toEqual([]);

    const store = module.get<CapabilityRequestContextStore>(CAPABILITY_REQUEST_CONTEXT_STORE);
    const usecase = module.get(BuildReferenceReportUsecase);
    await store.run(createContext(), async () => {
      await expect(usecase.execute({ groupKeys: ['alpha', 'beta'] })).resolves.toEqual({
        ok: true,
        value: {
          groupCount: 2,
          totalProfiles: 3,
          items: [
            { groupKey: 'alpha', profileCount: 2, profileNames: ['Alpha One', 'Alpha Two'] },
            { groupKey: 'beta', profileCount: 1, profileNames: ['Beta One'] },
          ],
        },
      });
    });
  });
});

function createContext(): CapabilityRequestContext {
  return {
    traceId: 'reference-trace-1',
    requestId: 'reference-request-1',
    entryPoint: 'graphql-api',
    actor: {
      accountId: 1,
      activeRole: 'REFERENCE_USER',
      accessGroup: ['REFERENCE_USER'],
      source: 'account',
    },
  };
}
