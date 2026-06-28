import { describe, expect, it } from 'vitest';
import { Game, type GameOptions } from './game.js';
import { Word } from './word.js';
import type { WordRepository } from '../repositories/word-repository.js';
import { InvalidGuessError } from '../errors/invalid-guess-error.js';

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

const baseOptions: GameOptions = {
  wordCount: 2,
  maxAttempts: 6,
  timeLimitMs: 60_000,
  tieBreakMaxAttempts: 3,
  tieBreakTimeLimitMs: 60_000,
};

describe('Game', () => {
  it('advances to the next word after a round resolves', () => {
    const repository = new FixedWordRepository(['TERMO', 'PONTE', 'GATOS']);
    const game = new Game(repository, baseOptions);

    expect(game.currentRound.secretWord.value).toBe('TERMO');

    const result = game.resolveCurrentRound('solved', 'p1', ['p1', 'p2']);

    expect(result.gameStatus).toBe('continue');
    expect(game.wordIndexNumber).toBe(1);
    expect(game.currentRound.secretWord.value).toBe('PONTE');
    expect(game.scores.get('p1')).toBe(1);
  });

  it('does not award a point for timeout or exhausted resolutions', () => {
    const repository = new FixedWordRepository(['TERMO', 'PONTE']);
    const game = new Game(repository, baseOptions);

    game.resolveCurrentRound('timeout', null, ['p1', 'p2']);

    expect(game.scores.get('p1')).toBeUndefined();
    expect(game.scores.get('p2')).toBeUndefined();
  });

  it('finishes the game when exactly one player leads after the last word', () => {
    const repository = new FixedWordRepository(['TERMO', 'PONTE']);
    const game = new Game(repository, { ...baseOptions, wordCount: 1 });

    const result = game.resolveCurrentRound('solved', 'p1', ['p1', 'p2']);

    expect(result.gameStatus).toBe('finished');
    expect(result.finalWinnerIds).toEqual(['p1']);
    expect(game.phase).toBe('finished');
    expect(game.winnerIds).toEqual(['p1']);
  });

  it('starts a tie-break when players are tied for the lead after the last word', () => {
    const repository = new FixedWordRepository(['TERMO', 'PONTE', 'GATOS']);
    const game = new Game(repository, { ...baseOptions, wordCount: 1 });

    const result = game.resolveCurrentRound('exhausted', null, ['p1', 'p2']);

    expect(result.gameStatus).toBe('tie-break-started');
    expect(result.tieBreakCandidates).toEqual(['p1', 'p2']);
    expect(game.phase).toBe('tie-break');
    expect(game.currentRound.secretWord.value).toBe('PONTE');
  });

  it('rejects guesses from players who are not in the tie-break', () => {
    const repository = new FixedWordRepository(['TERMO', 'PONTE']);
    const game = new Game(repository, { ...baseOptions, wordCount: 1 });
    game.resolveCurrentRound('exhausted', null, ['p1', 'p2']);

    expect(() => game.submitGuess('p3', 'Caio', 'PONTE')).toThrow(InvalidGuessError);
  });

  it('ends the game the moment a tie-break candidate solves a penalty word', () => {
    const repository = new FixedWordRepository(['TERMO', 'PONTE', 'GATOS']);
    const game = new Game(repository, { ...baseOptions, wordCount: 1 });
    game.resolveCurrentRound('exhausted', null, ['p1', 'p2']);

    const result = game.resolveCurrentRound('solved', 'p2', ['p1', 'p2']);

    expect(result.gameStatus).toBe('finished');
    expect(result.finalWinnerIds).toEqual(['p2']);
  });

  it('deals a new tie-break word when nobody solves the penalty round', () => {
    const repository = new FixedWordRepository(['TERMO', 'PONTE', 'GATOS']);
    const game = new Game(repository, { ...baseOptions, wordCount: 1 });
    game.resolveCurrentRound('exhausted', null, ['p1', 'p2']);

    const result = game.resolveCurrentRound('timeout', null, ['p1', 'p2']);

    expect(result.gameStatus).toBe('continue');
    expect(game.phase).toBe('tie-break');
    expect(game.currentRound.secretWord.value).toBe('GATOS');
  });
});
