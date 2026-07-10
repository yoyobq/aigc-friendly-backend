import { collectCapabilityView } from '../../../scripts/capability-list';

describe('capability:list projection', () => {
  it('derives runtime processes from the actual API and Worker module graphs', async () => {
    const entries = await collectCapabilityView();
    const byId = new Map(entries.map((entry) => [entry.ownership.capabilityId, entry] as const));

    expect(byId.get('ai.openai')?.runtimeProcesses).toEqual(['worker']);
    expect(byId.get('notification.email.sendmail')?.runtimeProcesses).toEqual(['worker']);
    expect(byId.get('third-party-auth.weapp')?.runtimeProcesses).toEqual(['api']);
    expect(byId.get('platform.account')?.runtimeProcesses).toEqual([]);
    expect(byId.get('platform.auth')?.runtimeProcesses).toEqual([]);
  });

  it('keeps registration inside account ownership and excludes reference fixtures', async () => {
    const entries = await collectCapabilityView();
    const byId = new Map(entries.map((entry) => [entry.ownership.capabilityId, entry] as const));

    expect(byId.has('account.registration')).toBe(false);
    expect([...byId.keys()].some((capabilityId) => capabilityId.startsWith('reference.'))).toBe(
      false,
    );
    expect(
      byId
        .get('platform.account')
        ?.ownership.physicalScopes.some((scope) => scope.path === 'src/usecases/registration'),
    ).toBe(true);
  });
});
