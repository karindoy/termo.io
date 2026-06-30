import { describe, expect, it } from 'vitest';
import { RaceGame, type RaceGameOptions } from './race-game.js';
import { Word } from './word.js';
import type { WordRepository } from '../repositories/word-repository.js';
import { GameAlreadyFinishedError } from '../errors/game-already-finished-error.js';

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

const baseOptions: RaceGameOptions = {
  wordCount: 2,
  timeLimitMs: 60_000,
};

describe('RaceGame', () => {
  it('gives each player their own independent current word', () => {
    const repository = new FixedWordRepository(['TERMO', 'PONTE']);
    const game = new RaceGame(repository, baseOptions);
    game.addPlayer('p1');
    game.addPlayer('p2');

    game.submitGuess('p1', 'Ana', 'TERMO');

    expect(game.wordIndexFor('p1')).toBe(0);
    expect(game.currentRoundFor('p1').solvedBy).toBe('p1');
    expect(game.currentRoundFor('p2').solvedBy).toBeNull();
  });

  it('advances only the solving player to the next word, leaving others on the current one', () => {
    const repository = new FixedWordRepository(['TERMO', 'PONTE']);
    const game = new RaceGame(repository, baseOptions);
    game.addPlayer('p1');
    game.addPlayer('p2');
    game.submitGuess('p1', 'Ana', 'TERMO');

    const result = game.resolvePlayerWord('p1', 'solved');

    expect(result.hasNextWord).toBe(true);
    expect(game.wordIndexFor('p1')).toBe(1);
    expect(game.currentRoundFor('p1').secretWord.value).toBe('PONTE');
    expect(game.wordIndexFor('p2')).toBe(0);
  });

  it('allows an unlimited number of attempts per word', () => {
    const repository = new FixedWordRepository(['TERMO']);
    const game = new RaceGame(repository, { ...baseOptions, wordCount: 1 });
    game.addPlayer('p1');

    for (let i = 0; i < 20; i += 1) {
      expect(() => game.submitGuess('p1', 'Ana', 'PONTE')).not.toThrow();
    }
  });

  it('declares a player the winner only once they have correctly solved every word', () => {
    const repository = new FixedWordRepository(['TERMO', 'PONTE']);
    const game = new RaceGame(repository, baseOptions);
    game.addPlayer('p1');

    game.submitGuess('p1', 'Ana', 'TERMO');
    const first = game.resolvePlayerWord('p1', 'solved');
    expect(first.playerWon).toBe(false);
    expect(game.phase).toBe('playing');

    game.submitGuess('p1', 'Ana', 'PONTE');
    const second = game.resolvePlayerWord('p1', 'solved');

    expect(second.playerWon).toBe(true);
    expect(second.gameFinished).toBe(true);
    expect(game.phase).toBe('finished');
    expect(game.winnerId).toBe('p1');
  });

  it('disqualifies a player from winning once any of their words times out, even if they finish all 5', () => {
    const repository = new FixedWordRepository(['TERMO', 'PONTE']);
    const game = new RaceGame(repository, baseOptions);
    game.addPlayer('p1');

    const first = game.resolvePlayerWord('p1', 'timeout');
    expect(first.playerWon).toBe(false);

    game.submitGuess('p1', 'Ana', 'PONTE');
    const second = game.resolvePlayerWord('p1', 'solved');

    expect(second.playerWon).toBe(false);
    expect(second.playerFinished).toBe(true);
  });

  it('finishes the game with no winner once every player has finished without anyone solving all words', () => {
    const repository = new FixedWordRepository(['TERMO', 'PONTE']);
    const game = new RaceGame(repository, baseOptions);
    game.addPlayer('p1');
    game.addPlayer('p2');

    game.resolvePlayerWord('p1', 'timeout');
    const p1Final = game.resolvePlayerWord('p1', 'timeout');
    expect(p1Final.gameFinished).toBe(false);

    game.resolvePlayerWord('p2', 'timeout');
    const p2Final = game.resolvePlayerWord('p2', 'timeout');

    expect(p2Final.gameFinished).toBe(true);
    expect(game.phase).toBe('finished');
    expect(game.winnerId).toBeNull();
  });

  it('rejects further guesses once the game has been won by another player', () => {
    const repository = new FixedWordRepository(['TERMO', 'PONTE']);
    const game = new RaceGame(repository, { ...baseOptions, wordCount: 1 });
    game.addPlayer('p1');
    game.addPlayer('p2');

    game.submitGuess('p1', 'Ana', 'TERMO');
    game.resolvePlayerWord('p1', 'solved');

    expect(() => game.submitGuess('p2', 'Bia', 'TERMO')).toThrow(GameAlreadyFinishedError);
  });
});
