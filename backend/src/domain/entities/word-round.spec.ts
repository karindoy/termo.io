import { describe, expect, it } from 'vitest';
import { WordRound } from './word-round.js';
import { Word } from './word.js';
import { AttemptsExceededError } from '../errors/attempts-exceeded-error.js';
import { RoundAlreadyResolvedError } from '../errors/round-already-resolved-error.js';

describe('WordRound', () => {
  it('marks solvedBy when a guess matches the secret word', () => {
    const round = new WordRound(Word.create('TERMO'), 6, 60_000);

    round.submitGuess('p1', 'Ana', 'PONTE');
    expect(round.solvedBy).toBeNull();

    round.submitGuess('p1', 'Ana', 'TERMO');
    expect(round.solvedBy).toBe('p1');
  });

  it('throws AttemptsExceededError once a player exceeds maxAttempts', () => {
    const round = new WordRound(Word.create('TERMO'), 2, 60_000);

    round.submitGuess('p1', 'Ana', 'PONTE');
    round.submitGuess('p1', 'Ana', 'PRATO');

    expect(() => round.submitGuess('p1', 'Ana', 'LIVRO')).toThrow(AttemptsExceededError);
  });

  it('tracks attempts independently per player', () => {
    const round = new WordRound(Word.create('TERMO'), 1, 60_000);

    round.submitGuess('p1', 'Ana', 'PONTE');
    expect(() => round.submitGuess('p2', 'Bia', 'PRATO')).not.toThrow();
  });

  it('allPlayersFinished is true only once every connected player hit the cap or solved', () => {
    const round = new WordRound(Word.create('TERMO'), 1, 60_000);

    round.submitGuess('p1', 'Ana', 'PONTE');
    expect(round.allPlayersFinished(['p1', 'p2'])).toBe(false);

    round.submitGuess('p2', 'Bia', 'PRATO');
    expect(round.allPlayersFinished(['p1', 'p2'])).toBe(true);
  });

  it('allPlayersFinished treats a solved player as finished even with attempts left', () => {
    const round = new WordRound(Word.create('TERMO'), 6, 60_000);

    round.submitGuess('p1', 'Ana', 'TERMO');
    expect(round.allPlayersFinished(['p1', 'p2'])).toBe(false);

    round.submitGuess('p2', 'Bia', 'PONTE');
    round.submitGuess('p2', 'Bia', 'PRATO');
    expect(round.allPlayersFinished(['p1', 'p2'])).toBe(false);

    for (let i = 0; i < 4; i += 1) round.submitGuess('p2', 'Bia', 'PRATO');
    expect(round.allPlayersFinished(['p1', 'p2'])).toBe(true);
  });

  it('rejects further guesses from a player who already solved the word', () => {
    const round = new WordRound(Word.create('TERMO'), 6, 60_000);
    round.submitGuess('p1', 'Ana', 'TERMO');

    expect(() => round.submitGuess('p1', 'Ana', 'PONTE')).toThrow(AttemptsExceededError);
  });

  it('bestSolver picks the fewest-attempts solver, tie-broken by who solved it first', () => {
    const round = new WordRound(Word.create('TERMO'), 6, 60_000);

    round.submitGuess('p1', 'Ana', 'PONTE');
    round.submitGuess('p1', 'Ana', 'TERMO'); // p1 solves in 2 attempts
    round.submitGuess('p2', 'Bia', 'TERMO'); // p2 solves in 1 attempt

    expect(round.bestSolver()).toMatchObject({ playerId: 'p2' });
  });

  it('bestSolver breaks a same-attempt-count tie by earliest solve', () => {
    const round = new WordRound(Word.create('TERMO'), 6, 60_000);

    round.submitGuess('p2', 'Bia', 'TERMO'); // solves first, in 1 attempt
    round.submitGuess('p1', 'Ana', 'TERMO'); // also solves in 1 attempt, but later

    expect(round.bestSolver()).toMatchObject({ playerId: 'p2' });
  });

  it('bestSolver returns null when nobody has solved the word yet', () => {
    const round = new WordRound(Word.create('TERMO'), 6, 60_000);
    round.submitGuess('p1', 'Ana', 'PONTE');

    expect(round.bestSolver()).toBeNull();
  });

  it('isExpired compares elapsed time against timeLimitMs', () => {
    const round = new WordRound(Word.create('TERMO'), 6, 50);
    expect(round.isExpired(Date.now())).toBe(false);
    expect(round.isExpired(round.startedAt + 100)).toBe(true);
  });

  it('resolve() is idempotent and rejects further guesses once resolved', () => {
    const round = new WordRound(Word.create('TERMO'), 6, 60_000);
    round.resolve('timeout');
    round.resolve('solved', 'p1');

    expect(round.resolvedReason).toBe('timeout');
    expect(round.solvedBy).toBeNull();
    expect(() => round.submitGuess('p1', 'Ana', 'TERMO')).toThrow(RoundAlreadyResolvedError);
  });
});
