import type { CapabilityRequestContext } from '@app-types/common/capability.types';
import { Test, type TestingModule } from '@nestjs/testing';
import { CapabilityBootstrapCheck } from '@src/infrastructure/capability/capability-bootstrap-check';
import { CapabilityModule } from '@src/infrastructure/capability/capability.module';
import { ReferenceProfileClientModule } from '@src/infrastructure/capability/reference-profile-client.module';
import { CapabilityRegistry } from '@src/infrastructure/capability/capability.registry';
import {
  CAPABILITY_REQUEST_CONTEXT_STORE,
  type CapabilityRequestContextStore,
} from '@src/usecases/common/ports/capability-request-context-store.contract';
import { BuildReferenceReportUsecase } from './build-reference-report.usecase';
import { ReferenceCapabilityModule } from './reference-capability.module';

describe('Reference typed capability client', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        CapabilityModule.forRoot({ process: 'api' }),
        ReferenceProfileClientModule,
        ReferenceCapabilityModule,
      ],
      providers: [BuildReferenceReportUsecase],
    })
      .overrideProvider(CapabilityBootstrapCheck)
      .useValue({ onApplicationBootstrap: jest.fn() })
      .compile();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  it('lets a consumer usecase call the owner capability through a typed client', async () => {
    const usecase = module.get(BuildReferenceReportUsecase);
    const store = module.get<CapabilityRequestContextStore>(CAPABILITY_REQUEST_CONTEXT_STORE);

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

  it('keeps dependency validation in manifest and registry, not in the typed client', () => {
    const registry = module.get(CapabilityRegistry);

    expect(registry.validateBootstrap().issues).toEqual([]);
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
