import type {
  CapabilityAnchor,
  CapabilityRuntimeContribution,
} from '@app-types/common/capability.types';
import {
  validateCapabilityProcessTopology,
  type CapabilityProcessTopology,
} from './capability-topology.validator';

describe('validateCapabilityProcessTopology', () => {
  it('allows an anchor without runtime contributions', () => {
    expect(
      validateCapabilityProcessTopology(buildTopology({ anchors: [anchor('test.owner')] })),
    ).toEqual([]);
  });

  it('reports runtime anchor, provider binding, and health gaps together', () => {
    const runtime: CapabilityRuntimeContribution = {
      capabilityId: 'test.provider',
      runtime: { healthCheck: true },
      contributions: {
        providers: [{ providerKind: 'test.provider', providerName: 'missing' }],
      },
    };

    expect(
      validateCapabilityProcessTopology(buildTopology({ runtimeContributions: [runtime] })),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CAPABILITY_RUNTIME_ANCHOR_MISSING' }),
        expect.objectContaining({ code: 'CAPABILITY_PROVIDER_BINDING_MISSING' }),
        expect.objectContaining({ code: 'CAPABILITY_HEALTH_CHECK_MISSING' }),
      ]),
    );
  });

  it('accepts a provider runtime contribution installed with its anchor, binding, and health check', () => {
    const runtime: CapabilityRuntimeContribution = {
      capabilityId: 'test.provider',
      runtime: { healthCheck: true },
      contributions: {
        providers: [{ providerKind: 'test.provider', providerName: 'ready' }],
      },
    };

    expect(
      validateCapabilityProcessTopology(
        buildTopology({
          anchors: [anchor('test.provider')],
          runtimeContributions: [runtime],
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

  it('allows a multi-process anchor to contribute runtime resources in only one process', () => {
    const sharedAnchor: CapabilityAnchor = {
      capabilityId: 'test.partial-runtime',
      mode: 'switchable',
      decisionRef: 'docs/capabilities/current.md',
    };
    const workerContribution: CapabilityRuntimeContribution = {
      capabilityId: 'test.partial-runtime',
    };

    expect(
      validateCapabilityProcessTopology(buildTopology({ process: 'api', anchors: [sharedAnchor] })),
    ).toEqual([]);
    expect(
      validateCapabilityProcessTopology(
        buildTopology({
          process: 'worker',
          anchors: [sharedAnchor],
          runtimeContributions: [workerContribution],
        }),
      ),
    ).toEqual([]);
  });

  it('reports required runtime dependency cycles', () => {
    const runtimeContributions: readonly CapabilityRuntimeContribution[] = [
      {
        capabilityId: 'test.a',
        runtimeDependencies: [{ capabilityId: 'test.b', mode: 'required' }],
      },
      {
        capabilityId: 'test.b',
        runtimeDependencies: [{ capabilityId: 'test.a', mode: 'required' }],
      },
    ];

    expect(
      validateCapabilityProcessTopology(
        buildTopology({
          anchors: [anchor('test.a'), anchor('test.b')],
          runtimeContributions,
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
    anchors: [],
    runtimeContributions: [],
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

function anchor(capabilityId: string): CapabilityAnchor {
  return {
    capabilityId,
    mode: 'always-on',
    decisionRef: 'docs/capabilities/current.md',
  };
}
