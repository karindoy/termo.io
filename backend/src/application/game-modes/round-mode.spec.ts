import { describe, expect, it, vi } from 'vitest';
import { RoundMode } from './round-mode.js';
import { Word } from '../../domain/entities/word.js';
import type { WordRepository } from '../../domain/repositories/word-repository.js';
import { RoundAlreadyResolvedError } from '../../domain/errors/round-already-resolved-error.js';

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

function createRoundMode(words: string[], wordCount = 2) {
  const repository = new FixedWordRepository(words);
  const gameMode = new RoundMode('room-1', repository, {
    wordCount,
    maxAttempts: 6,
    timeLimitMs: 60_000,
    tieBreakMaxAttempts: 3,
    tieBreakTimeLimitMs: 60_000,
  });
  return gameMode;
}

describe('RoundMode', () => {
  it('emits round:started on start()', () => {
    const gameMode = createRoundMode(['TERMO', 'PONTE']);
    const onRoundStarted = vi.fn();
    gameMode.on('round:started', onRoundStarted);

    gameMode.start();

    expect(onRoundStarted).toHaveBeenCalledWith(expect.objectContaining({ wordIndex: 0, phase: 'playing' }));
  });

  it('emits word:resolved then round:started when a guess solves the current word', () => {
    const gameMode = createRoundMode(['TERMO', 'PONTE']);
    gameMode.start();
    gameMode.joinPlayer('p1', 'Ana');

    const onResolved = vi.fn();
    const onRoundStarted = vi.fn();
    gameMode.on('word:resolved', onResolved);
    gameMode.on('round:started', onRoundStarted);

    gameMode.submitGuess('p1', 'Ana', 'TERMO');

    expect(onResolved).toHaveBeenCalledWith(expect.objectContaining({ reason: 'solved', winnerId: 'p1' }));
    expect(onRoundStarted).toHaveBeenCalledWith(expect.objectContaining({ wordIndex: 1 }));
  });

  it('emits game:finished after the last word once a single leader exists', () => {
    const gameMode = createRoundMode(['TERMO'], 1);
    gameMode.start();
    gameMode.joinPlayer('p1', 'Ana');

    const onFinished = vi.fn();
    gameMode.on('game:finished', onFinished);

    gameMode.submitGuess('p1', 'Ana', 'TERMO');

    expect(onFinished).toHaveBeenCalledWith(expect.objectContaining({ winnerIds: ['p1'] }));
    expect(gameMode.isResolved()).toBe(true);
    expect(gameMode.getWinner()).toBe('p1');
  });

  it('mid-game: a "simultaneous" guess for an already-resolved word lands on the new word instead of double-scoring the old one', () => {
    const gameMode = createRoundMode(['TERMO', 'PONTE']);
    gameMode.start();
    gameMode.joinPlayer('p1', 'Ana');
    gameMode.joinPlayer('p2', 'Bia');

    gameMode.submitGuess('p1', 'Ana', 'TERMO');
    // Node's run-to-completion model means resolution + advancement to the next
    // word happen atomically within the call above — there is no window where a
    // "simultaneous" guess could double-score the resolved word. This guess is
    // evaluated against the *new* current round instead.
    gameMode.submitGuess('p2', 'Bia', 'PONTE');

    const game = gameMode.getGame();
    expect(game.scores.get('p1')).toBe(1);
    expect(game.scores.get('p2')).toBe(1);
  });

  it('resolves the word as a timeout once the per-word timer elapses with nobody solving it', () => {
    vi.useFakeTimers();
    try {
      const gameMode = createRoundMode(['TERMO', 'PONTE']);
      gameMode.start();
      gameMode.joinPlayer('p1', 'Ana');

      const onResolved = vi.fn();
      const onRoundStarted = vi.fn();
      gameMode.on('word:resolved', onResolved);
      gameMode.on('round:started', onRoundStarted);

      gameMode.submitGuess('p1', 'Ana', 'PONTE');
      expect(onResolved).not.toHaveBeenCalled();

      vi.advanceTimersByTime(60_000);

      expect(onResolved).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'timeout', winnerId: null, revealedWord: 'TERMO' }),
      );
      expect(onRoundStarted).toHaveBeenCalledWith(expect.objectContaining({ wordIndex: 1 }));

      const game = gameMode.getGame();
      expect(game.scores.get('p1')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('once the game is decided, a further guess for the same word is rejected instead of altering the outcome', () => {
    const gameMode = createRoundMode(['TERMO'], 1);
    gameMode.start();
    gameMode.joinPlayer('p1', 'Ana');
    gameMode.joinPlayer('p2', 'Bia');

    gameMode.submitGuess('p1', 'Ana', 'TERMO');
    expect(gameMode.isResolved()).toBe(true);

    expect(() => gameMode.submitGuess('p2', 'Bia', 'TERMO')).toThrow(RoundAlreadyResolvedError);

    const game = gameMode.getGame();
    expect(game.scores.get('p1')).toBe(1);
    expect(game.scores.get('p2')).toBeUndefined();
  });
});
