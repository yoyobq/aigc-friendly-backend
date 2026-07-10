import {
  collectCapabilityView,
  validateCapabilityDecisionRef,
} from '../../../scripts/capability-list';

describe('capability:list projection', () => {
  it('derives runtime processes from the actual API and Worker module graphs', async () => {
    const entries = await collectCapabilityView();
    const byId = new Map(entries.map((entry) => [entry.anchor.capabilityId, entry] as const));

    expect(byId.get('ai.openai')?.runtimeProcesses).toEqual(['worker']);
    expect(byId.get('notification.email.sendmail')?.runtimeProcesses).toEqual(['worker']);
    expect(byId.get('third-party-auth.weapp')?.runtimeProcesses).toEqual(['api']);
    expect(byId.get('platform.account')?.runtimeProcesses).toEqual([]);
    expect(byId.get('platform.auth')?.runtimeProcesses).toEqual([]);
    expect(byId.get('ai.queue')?.installedProcesses).toEqual(['api', 'worker']);
  });

  it('keeps the generated projection shallow and excludes reference fixtures', async () => {
    const entries = await collectCapabilityView();
    const byId = new Map(entries.map((entry) => [entry.anchor.capabilityId, entry] as const));

    expect(byId.has('account.registration')).toBe(false);
    expect([...byId.keys()].some((capabilityId) => capabilityId.startsWith('reference.'))).toBe(
      false,
    );
    expect(byId.get('platform.account')).toMatchObject({
      entryModule: 'AccountModule',
      anchor: { decisionRef: 'docs/capabilities/current.md' },
    });
  });

  it('validates stable decision paths and exact capability headings', async () => {
    await expect(
      validateCapabilityDecisionRef({
        capabilityId: 'platform.account',
        decisionRef: 'docs/capabilities/current.md',
      }),
    ).resolves.toEqual([]);
    await expect(
      validateCapabilityDecisionRef({
        capabilityId: 'platform.account',
        decisionRef: 'plans/account-plan.md',
      }),
    ).resolves.toEqual(['capability_decision_ref_invalid:platform.account:plans/account-plan.md']);
    await expect(
      validateCapabilityDecisionRef({
        capabilityId: 'platform.missing',
        decisionRef: 'docs/capabilities/current.md',
      }),
    ).resolves.toEqual([
      'capability_decision_ref_capability_missing:platform.missing:docs/capabilities/current.md',
    ]);
  });
});
