import { describe, expect, it, vi } from 'vitest';
import { ChampionshipMode } from './championship-mode.js';
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

function createChampionshipMode(words: string[], wordCount = 2, maxAttempts = 6) {
  const repository = new FixedWordRepository(words);
  const gameMode = new ChampionshipMode('room-1', repository, {
    wordCount,
    maxAttempts,
    timeLimitMs: 60_000,
    tieBreakMaxAttempts: 3,
    tieBreakTimeLimitMs: 60_000,
  });
  return gameMode;
}

describe('ChampionshipMode', () => {
  it('emits round:started on start()', () => {
    const gameMode = createChampionshipMode(['TERMO', 'PONTE']);
    const onRoundStarted = vi.fn();
    gameMode.on('round:started', onRoundStarted);

    gameMode.start();

    expect(onRoundStarted).toHaveBeenCalledWith(expect.objectContaining({ wordIndex: 0, phase: 'playing' }));
  });

  it('emits word:resolved then round:started when a guess solves the current word', () => {
    const gameMode = createChampionshipMode(['TERMO', 'PONTE']);
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
    const gameMode = createChampionshipMode(['TERMO'], 1);
    gameMode.start();
    gameMode.joinPlayer('p1', 'Ana');

    const onFinished = vi.fn();
    gameMode.on('game:finished', onFinished);

    gameMode.submitGuess('p1', 'Ana', 'TERMO');

    expect(onFinished).toHaveBeenCalledWith(expect.objectContaining({ winnerIds: ['p1'] }));
    expect(gameMode.isResolved()).toBe(true);
    expect(gameMode.getWinner()).toBe('p1');
  });

  it('keeps the word open after one player solves it until every connected player finishes', () => {
    const gameMode = createChampionshipMode(['TERMO', 'PONTE'], 2, 1);
    gameMode.start();
    gameMode.joinPlayer('p1', 'Ana');
    gameMode.joinPlayer('p2', 'Bia');

    const onResolved = vi.fn();
    const onRoundStarted = vi.fn();
    gameMode.on('word:resolved', onResolved);
    gameMode.on('round:started', onRoundStarted);

    gameMode.submitGuess('p1', 'Ana', 'TERMO');
    // p1 solved it, but p2 hasn't taken their (only) attempt yet — the word stays open.
    expect(onResolved).not.toHaveBeenCalled();
    expect(gameMode.getGame().currentRound.secretWord.value).toBe('TERMO');

    gameMode.submitGuess('p2', 'Bia', 'PONTE');
    // p2's only attempt was wrong, so they're finished too — now the word resolves.
    expect(onResolved).toHaveBeenCalledWith(expect.objectContaining({ reason: 'solved', winnerId: 'p1' }));
    expect(onRoundStarted).toHaveBeenCalledWith(expect.objectContaining({ wordIndex: 1 }));
  });

  it('awards the word to whoever solved it in the fewest attempts, not whoever solved it first', () => {
    const gameMode = createChampionshipMode(['TERMO', 'PONTE'], 2, 6);
    gameMode.start();
    gameMode.joinPlayer('p1', 'Ana');
    gameMode.joinPlayer('p2', 'Bia');

    const onResolved = vi.fn();
    gameMode.on('word:resolved', onResolved);

    gameMode.submitGuess('p1', 'Ana', 'TERMO'); // p1 solves first, in 1 attempt
    gameMode.submitGuess('p2', 'Bia', 'PONTE'); // p2's 1st (wrong) attempt
    gameMode.submitGuess('p2', 'Bia', 'TERMO'); // p2 solves in 2 attempts

    expect(onResolved).toHaveBeenCalledWith(expect.objectContaining({ reason: 'solved', winnerId: 'p1' }));
    const game = gameMode.getGame();
    expect(game.scores.get('p1')).toBe(1);
    expect(game.scores.get('p2')).toBeUndefined();
  });

  it('resolves the word as a timeout once the per-word timer elapses with nobody solving it', () => {
    vi.useFakeTimers();
    try {
      const gameMode = createChampionshipMode(['TERMO', 'PONTE']);
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

  it('resolves a tie-break once only the tied candidates finish, ignoring non-candidate spectators', () => {
    const repository = new FixedWordRepository(['TERMO', 'PONTE', 'GATOS']);
    const gameMode = new ChampionshipMode('room-1', repository, {
      wordCount: 2,
      maxAttempts: 1,
      timeLimitMs: 60_000,
      tieBreakMaxAttempts: 1,
      tieBreakTimeLimitMs: 60_000,
    });
    gameMode.start();
    gameMode.joinPlayer('p1', 'Ana');
    gameMode.joinPlayer('p2', 'Bia');
    gameMode.joinPlayer('p3', 'Caio'); // never guesses again once the tie-break excludes them

    const onTieBreakStarted = vi.fn();
    const onFinished = vi.fn();
    gameMode.on('tiebreak:started', onTieBreakStarted);
    gameMode.on('game:finished', onFinished);

    // Word 1: p1 wins.
    gameMode.submitGuess('p1', 'Ana', 'TERMO');
    gameMode.submitGuess('p2', 'Bia', 'PRATO');
    gameMode.submitGuess('p3', 'Caio', 'PRATO');

    // Word 2: p2 wins, tying p1 1-1 — p3 (spectator) is left out of the tie-break.
    gameMode.submitGuess('p1', 'Ana', 'PRATO');
    gameMode.submitGuess('p2', 'Bia', 'PONTE');
    gameMode.submitGuess('p3', 'Caio', 'PRATO');

    expect(onTieBreakStarted).toHaveBeenCalledWith(expect.objectContaining({ candidateIds: ['p1', 'p2'] }));

    // Tie-break: only p1/p2 may guess. p3 never guesses again — the round must still resolve.
    gameMode.submitGuess('p1', 'Ana', 'GATOS'); // p1 solves it
    expect(onFinished).not.toHaveBeenCalled(); // p2 hasn't taken their (only) tie-break attempt yet
    gameMode.submitGuess('p2', 'Bia', 'PRATO'); // p2's only (wrong) tie-break attempt

    expect(onFinished).toHaveBeenCalledWith(expect.objectContaining({ winnerIds: ['p1'] }));
  });

  it('once the game is decided, a further guess is rejected instead of altering the outcome', () => {
    const gameMode = createChampionshipMode(['TERMO'], 1, 1);
    gameMode.start();
    gameMode.joinPlayer('p1', 'Ana');
    gameMode.joinPlayer('p2', 'Bia');

    gameMode.submitGuess('p1', 'Ana', 'TERMO'); // p1 solves in their only attempt
    expect(gameMode.isResolved()).toBe(false); // still waiting on p2

    gameMode.submitGuess('p2', 'Bia', 'PONTE'); // p2's only (wrong) attempt — game now decided
    expect(gameMode.isResolved()).toBe(true);

    expect(() => gameMode.submitGuess('p2', 'Bia', 'TERMO')).toThrow(RoundAlreadyResolvedError);

    const game = gameMode.getGame();
    expect(game.scores.get('p1')).toBe(1);
    expect(game.scores.get('p2')).toBeUndefined();
  });
});
