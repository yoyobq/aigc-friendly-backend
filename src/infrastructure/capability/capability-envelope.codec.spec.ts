import type { CapabilityCommand, CapabilityEvent } from '@app-types/common/capability.types';
import {
  restoreCapabilityEnvelope,
  serializeCapabilityEnvelope,
} from './capability-envelope.codec';

describe('capability envelope codec', () => {
  it('serializes command envelope into queue payload and restores context', () => {
    const envelope: CapabilityCommand<{ readonly id: string }> = {
      capability: 'test.queue',
      operation: 'dispatch',
      operationKind: 'command',
      context: {
        traceId: 'trace-1',
        requestId: 'request-1',
        entryPoint: 'graphql-api',
        actor: {
          source: 'account',
          accountId: 1,
          accessGroup: ['STAFF'],
        },
      },
      dedupKey: 'dedup-1',
      payload: { id: 'item-1' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const payload = serializeCapabilityEnvelope(envelope);
    const restored = restoreCapabilityEnvelope(payload);

    expect(payload.traceId).toBe('trace-1');
    expect(payload.requestId).toBe('request-1');
    expect(restored).toMatchObject({
      capability: 'test.queue',
      operation: 'dispatch',
      operationKind: 'command',
      context: envelope.context,
      dedupKey: 'dedup-1',
      payload: { id: 'item-1' },
    });
    expect(restored.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('restores event id and occurredAt for event envelopes', () => {
    const envelope: CapabilityEvent<{ readonly id: string }> = {
      capability: 'test.event',
      operation: 'published',
      operationKind: 'event',
      context: {
        traceId: 'trace-1',
        requestId: 'request-1',
        actor: { source: 'system' },
      },
      payload: { id: 'item-1' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      eventId: 'event-1',
      occurredAt: new Date('2026-01-01T00:00:01.000Z'),
    };

    const restored = restoreCapabilityEnvelope(serializeCapabilityEnvelope(envelope));

    expect(restored).toMatchObject({
      operationKind: 'event',
      eventId: 'event-1',
    });
    if (restored.operationKind === 'event') {
      expect(restored.occurredAt.toISOString()).toBe('2026-01-01T00:00:01.000Z');
    }
  });
});
