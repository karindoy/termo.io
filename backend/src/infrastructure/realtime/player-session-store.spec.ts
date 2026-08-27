import { describe, expect, it } from 'vitest';
import { InMemoryPlayerSessionStore } from './player-session-store.js';

describe('InMemoryPlayerSessionStore', () => {
  it('verifies a secret issued for the same room and player', async () => {
    const store = new InMemoryPlayerSessionStore();
    const secret = await store.issue('ROOM1', 'p1');

    expect(await store.verify('ROOM1', 'p1', secret)).toBe(true);
  });

  it('rejects a secret for the wrong player or room', async () => {
    const store = new InMemoryPlayerSessionStore();
    const secret = await store.issue('ROOM1', 'p1');

    expect(await store.verify('ROOM1', 'p2', secret)).toBe(false);
    expect(await store.verify('ROOM2', 'p1', secret)).toBe(false);
  });

  it('rejects a missing or undefined secret', async () => {
    const store = new InMemoryPlayerSessionStore();
    await store.issue('ROOM1', 'p1');

    expect(await store.verify('ROOM1', 'p1', undefined)).toBe(false);
    expect(await store.verify('ROOM1', 'p1', 'guessed-secret')).toBe(false);
  });

  it('invalidates the previous secret once a player re-joins (rejoin issues a fresh one)', async () => {
    const store = new InMemoryPlayerSessionStore();
    const first = await store.issue('ROOM1', 'p1');
    const second = await store.issue('ROOM1', 'p1');

    expect(await store.verify('ROOM1', 'p1', first)).toBe(false);
    expect(await store.verify('ROOM1', 'p1', second)).toBe(true);
  });

  it('clears every secret for a room', async () => {
    const store = new InMemoryPlayerSessionStore();
    const secret = await store.issue('ROOM1', 'p1');
    await store.clear('ROOM1');

    expect(await store.verify('ROOM1', 'p1', secret)).toBe(false);
  });
});
