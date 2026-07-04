import { describe, expect, it } from 'vitest';
import { DailyPuzzle } from './daily-puzzle.js';
import { Word } from './word.js';
import { InvalidGuessError } from '../errors/invalid-guess-error.js';
import { AttemptsExceededError } from '../errors/attempts-exceeded-error.js';

describe('DailyPuzzle', () => {
  it('Termo-style single board: solves and reveals the word once matched', () => {
    const puzzle = new DailyPuzzle([Word.create('TERMO')], 6);

    const result = puzzle.replay(['PONTE', 'TERMO']);

    expect(result.won).toBe(true);
    expect(result.finished).toBe(true);
    expect(result.attemptsUsed).toBe(2);
    expect(result.boards[0]!.solved).toBe(true);
    expect(result.boards[0]!.revealedWord).toBe('TERMO');
    expect(result.boards[0]!.attempts).toHaveLength(2);
  });

  it('stays unfinished while boards remain unsolved and attempts remain', () => {
    const puzzle = new DailyPuzzle([Word.create('TERMO')], 6);

    const result = puzzle.replay(['PONTE']);

    expect(result.won).toBe(false);
    expect(result.finished).toBe(false);
    expect(result.boards[0]!.revealedWord).toBeNull();
  });

  it('finishes (loss) once the shared attempt budget is exhausted without solving', () => {
    const puzzle = new DailyPuzzle([Word.create('TERMO')], 2);

    const result = puzzle.replay(['PONTE', 'PRATO']);

    expect(result.won).toBe(false);
    expect(result.finished).toBe(true);
    expect(result.boards[0]!.revealedWord).toBe('TERMO');
  });

  it('Dueto-style multi-board: one guess is scored against every board, sharing one attempt count', () => {
    const puzzle = new DailyPuzzle([Word.create('TERMO'), Word.create('PONTE')], 7);

    const result = puzzle.replay(['TERMO']);

    expect(result.attemptsUsed).toBe(1);
    expect(result.boards[0]!.solved).toBe(true);
    expect(result.boards[1]!.solved).toBe(false);
    expect(result.finished).toBe(false);
  });

  it('a solved board stops receiving further guesses, but they still count toward the shared budget', () => {
    const puzzle = new DailyPuzzle([Word.create('TERMO'), Word.create('PONTE')], 7);

    const result = puzzle.replay(['TERMO', 'PONTE']);

    expect(result.attemptsUsed).toBe(2);
    expect(result.boards[0]!.attempts).toHaveLength(1);
    expect(result.boards[1]!.attempts).toHaveLength(2);
    expect(result.won).toBe(true);
  });

  it('throws AttemptsExceededError when the guess history exceeds maxAttempts', () => {
    const puzzle = new DailyPuzzle([Word.create('TERMO')], 1);

    expect(() => puzzle.replay(['PONTE', 'PRATO'])).toThrow(AttemptsExceededError);
  });

  it('throws InvalidGuessError when a guess is not exactly 5 letters', () => {
    const puzzle = new DailyPuzzle([Word.create('TERMO')], 6);

    expect(() => puzzle.replay(['ABC'])).toThrow(InvalidGuessError);
  });
});
