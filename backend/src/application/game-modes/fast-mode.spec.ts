import { describe, expect, it, vi } from 'vitest';
import { FastMode } from './fast-mode.js';
import { Word } from '../../domain/entities/word.js';
import type { WordRepository } from '../../domain/repositories/word-repository.js';
import { GameAlreadyFinishedError } from '../../domain/errors/game-already-finished-error.js';

class FixedWordRepository implements WordRepository {
  private index = 0;

  constructor(private readonly words: string[]) {}

  getRandomWord(): Word {
    const value = this.words[this.index % this.words.length]!;
    this.index += 1;
    return Word.create(value);
  }

  isValidGuess(): boolean {
    return true;
  }
}

function createFastMode(words: string[], wordCount = 2) {
  const repository = new FixedWordRepository(words);
  return new FastMode('room-1', repository, { wordCount, timeLimitMs: 60_000 });
}

describe('FastMode', () => {
  it('emits race:started on start()', () => {
    const gameMode = createFastMode(['TERMO', 'PONTE']);
    const onStarted = vi.fn();
    gameMode.on('race:started', onStarted);

    gameMode.start();

    expect(onStarted).toHaveBeenCalledWith(expect.objectContaining({ wordCount: 2, wordLength: 5 }));
  });

  it('lets two players progress through words independently', () => {
    const gameMode = createFastMode(['TERMO', 'PONTE']);
    gameMode.start();
    gameMode.joinPlayer('p1', 'Ana');
    gameMode.joinPlayer('p2', 'Bia');

    gameMode.submitGuess('p1', 'Ana', 'TERMO');

    expect(gameMode.getGame().wordIndexFor('p1')).toBe(1);
    expect(gameMode.getGame().wordIndexFor('p2')).toBe(0);
  });

  it('declares the first player to solve every word the winner', () => {
    const gameMode = createFastMode(['TERMO', 'PONTE']);
    gameMode.start();
    gameMode.joinPlayer('p1', 'Ana');
    gameMode.joinPlayer('p2', 'Bia');

    const onFinished = vi.fn();
    gameMode.on('race:finished', onFinished);

    gameMode.submitGuess('p1', 'Ana', 'TERMO');
    gameMode.submitGuess('p1', 'Ana', 'PONTE');

    expect(onFinished).toHaveBeenCalledWith({ roomId: 'room-1', winnerId: 'p1' });
    expect(gameMode.isResolved()).toBe(true);
    expect(gameMode.getWinner()).toBe('p1');
  });

  it('once a winner is decided, further guesses from other players are rejected', () => {
    const gameMode = createFastMode(['TERMO', 'PONTE'], 1);
    gameMode.start();
    gameMode.joinPlayer('p1', 'Ana');
    gameMode.joinPlayer('p2', 'Bia');

    gameMode.submitGuess('p1', 'Ana', 'TERMO');
    expect(gameMode.isResolved()).toBe(true);

    expect(() => gameMode.submitGuess('p2', 'Bia', 'PONTE')).toThrow(GameAlreadyFinishedError);
  });

  it('reveals the word and force-advances a player whose personal timer expires', () => {
    vi.useFakeTimers();
    try {
      const gameMode = createFastMode(['TERMO', 'PONTE']);
      gameMode.start();
      gameMode.joinPlayer('p1', 'Ana');

      const onResolved = vi.fn();
      const onWordStarted = vi.fn();
      gameMode.on('player:word-resolved', onResolved);
      gameMode.on('player:word-started', onWordStarted);

      vi.advanceTimersByTime(60_000);

      expect(onResolved).toHaveBeenCalledWith(
        expect.objectContaining({ playerId: 'p1', reason: 'timeout', revealedWord: 'TERMO', hasNextWord: true }),
      );
      expect(onWordStarted).toHaveBeenCalledWith(expect.objectContaining({ playerId: 'p1', wordIndex: 1 }));
      expect(gameMode.getGame().wordIndexFor('p1')).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('disqualifies a player from winning once a timeout occurs, even after finishing all words', () => {
    vi.useFakeTimers();
    try {
      const gameMode = createFastMode(['TERMO', 'PONTE']);
      gameMode.start();
      gameMode.joinPlayer('p1', 'Ana');

      vi.advanceTimersByTime(60_000);
      expect(gameMode.getGame().wordIndexFor('p1')).toBe(1);

      gameMode.submitGuess('p1', 'Ana', 'PONTE');

      expect(gameMode.isResolved()).toBe(true);
      expect(gameMode.getWinner()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('finishes the race with no winner once every player times out on every word', () => {
    vi.useFakeTimers();
    try {
      const gameMode = createFastMode(['TERMO', 'PONTE']);
      gameMode.start();
      gameMode.joinPlayer('p1', 'Ana');
      gameMode.joinPlayer('p2', 'Bia');

      const onFinished = vi.fn();
      gameMode.on('race:finished', onFinished);

      vi.advanceTimersByTime(60_000);
      vi.advanceTimersByTime(60_000);

      expect(onFinished).toHaveBeenCalledWith({ roomId: 'room-1', winnerId: null });
      expect(gameMode.isResolved()).toBe(true);
      expect(gameMode.getWinner()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears a player timeout once they solve the word, so it never fires afterwards', () => {
    vi.useFakeTimers();
    try {
      const gameMode = createFastMode(['TERMO', 'PONTE'], 1);
      gameMode.start();
      gameMode.joinPlayer('p1', 'Ana');

      const onResolved = vi.fn();
      gameMode.on('player:word-resolved', onResolved);

      gameMode.submitGuess('p1', 'Ana', 'TERMO');
      expect(onResolved).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(60_000);

      expect(onResolved).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
