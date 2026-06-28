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

  it('allPlayersExhausted is true only once every connected player hit the cap', () => {
    const round = new WordRound(Word.create('TERMO'), 1, 60_000);

    round.submitGuess('p1', 'Ana', 'PONTE');
    expect(round.allPlayersExhausted(['p1', 'p2'])).toBe(false);

    round.submitGuess('p2', 'Bia', 'PRATO');
    expect(round.allPlayersExhausted(['p1', 'p2'])).toBe(true);
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
