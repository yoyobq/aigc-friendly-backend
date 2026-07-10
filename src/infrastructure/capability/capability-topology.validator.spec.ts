import type {
  CapabilityOwnershipManifest,
  CapabilityRuntimeManifest,
} from '@app-types/common/capability.types';
import {
  validateCapabilityProcessTopology,
  type CapabilityProcessTopology,
} from './capability-topology.validator';

describe('validateCapabilityProcessTopology', () => {
  it('allows an ownership-only capability', () => {
    expect(
      validateCapabilityProcessTopology(buildTopology({ ownerships: [owner('test.owner')] })),
    ).toEqual([]);
  });

  it('reports runtime ownership, provider binding, and health gaps together', () => {
    const runtime: CapabilityRuntimeManifest = {
      capabilityId: 'test.provider',
      version: '0.1.0',
      runtime: { healthCheck: true },
      contributions: {
        providers: [{ providerKind: 'test.provider', providerName: 'missing' }],
      },
    };

    expect(
      validateCapabilityProcessTopology(buildTopology({ runtimeManifests: [runtime] })),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CAPABILITY_RUNTIME_OWNERSHIP_MISSING' }),
        expect.objectContaining({ code: 'CAPABILITY_PROVIDER_BINDING_MISSING' }),
        expect.objectContaining({ code: 'CAPABILITY_HEALTH_CHECK_MISSING' }),
      ]),
    );
  });

  it('accepts a provider runtime installed with its owner, binding, and health check', () => {
    const runtime: CapabilityRuntimeManifest = {
      capabilityId: 'test.provider',
      version: '0.1.0',
      runtime: { healthCheck: true },
      contributions: {
        providers: [{ providerKind: 'test.provider', providerName: 'ready' }],
      },
    };

    expect(
      validateCapabilityProcessTopology(
        buildTopology({
          ownerships: [owner('test.provider')],
          runtimeManifests: [runtime],
          providerBindings: [
            {
              capabilityId: 'test.provider',
              providerKind: 'test.provider',
              providerName: 'ready',
            },
          ],
          healthChecks: [{ capabilityId: 'test.provider', name: 'provider-config' }],
        }),
      ),
    ).toEqual([]);
  });

  it('reports required runtime dependency cycles', () => {
    const runtimeManifests: readonly CapabilityRuntimeManifest[] = [
      {
        capabilityId: 'test.a',
        version: '0.1.0',
        runtimeDependencies: [{ capabilityId: 'test.b', mode: 'required' }],
      },
      {
        capabilityId: 'test.b',
        version: '0.1.0',
        runtimeDependencies: [{ capabilityId: 'test.a', mode: 'required' }],
      },
    ];

    expect(
      validateCapabilityProcessTopology(
        buildTopology({
          ownerships: [owner('test.a'), owner('test.b')],
          runtimeManifests,
        }),
      ),
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'CAPABILITY_DEPENDENCY_CYCLE' })]),
    );
  });
});

function buildTopology(overrides: Partial<CapabilityProcessTopology>): CapabilityProcessTopology {
  return {
    process: 'worker',
    ownerships: [],
    runtimeManifests: [],
    providerBindings: [],
    queueBindings: [],
    healthChecks: [],
    operationHandlers: [],
    sessionIdentityResolvers: [],
    sessionAuthoritySummaryResolvers: [],
    sessionAuthorityScopeAuthorizers: [],
    ...overrides,
  };
}

function owner(capabilityId: string): CapabilityOwnershipManifest {
  return {
    capabilityId,
    kind: 'technical',
    semanticScope: `Test scope for ${capabilityId}.`,
    owns: [`Test facts for ${capabilityId}.`],
    nonGoals: ['Production ownership.'],
    physicalScopes: [
      {
        path: 'src/infrastructure/capability/capability-topology.validator.spec.ts',
        role: 'primary',
      },
    ],
    publicSurfaces: [{ status: 'not-required', reason: 'Test fixture.' }],
    allowedDependencies: [],
    foundationClassification: 'domain-owned',
    validationEntrypoints: ['src/infrastructure/capability/capability-topology.validator.spec.ts'],
  };
}
