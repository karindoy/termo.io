import { describe, expect, it, vi } from 'vitest';
import { GameModeRegistry } from './game-mode-registry.js';
import type { GameMode } from '../../application/game-modes/game-mode.js';

function fakeGameMode(): GameMode {
  return {
    start: () => {},
    submitGuess: () => {
      throw new Error('not used in this test');
    },
    isResolved: () => false,
    getWinner: () => null,
  };
}

describe('GameModeRegistry', () => {
  it('returns undefined for a code that was never registered', () => {
    const registry = new GameModeRegistry<GameMode>();
    expect(registry.get('ABCDEFGH')).toBeUndefined();
  });

  it('returns the registered instance for its code', () => {
    const registry = new GameModeRegistry<GameMode>();
    const instance = fakeGameMode();
    registry.register('ABCDEFGH', instance);
    expect(registry.get('ABCDEFGH')).toBe(instance);
  });

  it('forgets an instance once removed', () => {
    const registry = new GameModeRegistry<GameMode>();
    registry.register('ABCDEFGH', fakeGameMode());
    registry.remove('ABCDEFGH');
    expect(registry.get('ABCDEFGH')).toBeUndefined();
  });

  it('emits "register" with the code and instance when one is registered', () => {
    const registry = new GameModeRegistry<GameMode>();
    const instance = fakeGameMode();
    const onRegister = vi.fn();
    registry.on('register', onRegister);

    registry.register('ABCDEFGH', instance);

    expect(onRegister).toHaveBeenCalledWith('ABCDEFGH', instance);
  });
});
