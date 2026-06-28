import { describe, expect, it } from 'vitest';
import { PlayerSessionStore } from './player-session-store.js';

describe('PlayerSessionStore', () => {
  it('verifies a secret issued for the same room and player', () => {
    const store = new PlayerSessionStore();
    const secret = store.issue('ROOM1', 'p1');

    expect(store.verify('ROOM1', 'p1', secret)).toBe(true);
  });

  it('rejects a secret for the wrong player or room', () => {
    const store = new PlayerSessionStore();
    const secret = store.issue('ROOM1', 'p1');

    expect(store.verify('ROOM1', 'p2', secret)).toBe(false);
    expect(store.verify('ROOM2', 'p1', secret)).toBe(false);
  });

  it('rejects a missing or undefined secret', () => {
    const store = new PlayerSessionStore();
    store.issue('ROOM1', 'p1');

    expect(store.verify('ROOM1', 'p1', undefined)).toBe(false);
    expect(store.verify('ROOM1', 'p1', 'guessed-secret')).toBe(false);
  });

  it('invalidates the previous secret once a player re-joins (rejoin issues a fresh one)', () => {
    const store = new PlayerSessionStore();
    const first = store.issue('ROOM1', 'p1');
    const second = store.issue('ROOM1', 'p1');

    expect(store.verify('ROOM1', 'p1', first)).toBe(false);
    expect(store.verify('ROOM1', 'p1', second)).toBe(true);
  });

  it('clears every secret for a room', () => {
    const store = new PlayerSessionStore();
    const secret = store.issue('ROOM1', 'p1');
    store.clear('ROOM1');

    expect(store.verify('ROOM1', 'p1', secret)).toBe(false);
  });
});
