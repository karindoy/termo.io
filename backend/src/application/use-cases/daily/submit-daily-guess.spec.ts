import { describe, expect, it } from 'vitest';
import { submitDailyGuess } from './submit-daily-guess.js';
import { Word } from '../../../domain/entities/word.js';
import type { WordRepository } from '../../../domain/repositories/word-repository.js';
import { InvalidGuessError } from '../../../domain/errors/invalid-guess-error.js';
import { AttemptsExceededError } from '../../../domain/errors/attempts-exceeded-error.js';
import { currentPuzzleDate } from '../../../domain/value-objects/puzzle-date.js';
import { DailyWordResolver } from '../../../infrastructure/persistence/words/daily-word-resolver.js';

const WORDS = ['TERMO', 'PONTE', 'PRATO', 'LIVRO', 'CASAS', 'FALAR', 'NOITE', 'RIVER'];

class FixedListWordRepository implements WordRepository {
  constructor(private readonly words: string[]) {}

  getRandomWord(): Word {
    return Word.create(this.words[0]!);
  }

  isValidGuess(value: string): boolean {
    return this.words.includes(value.toUpperCase());
  }

  getWordAt(index: number): Word {
    return Word.create(this.words[index % this.words.length]!);
  }

  size(): number {
    return this.words.length;
  }
}

describe('submitDailyGuess', () => {
  it("rejects a guess that isn't in the dictionary", () => {
    const wordRepository = new FixedListWordRepository(WORDS);

    expect(() => submitDailyGuess({ wordRepository }, { mode: 'termo', guesses: ['ZZZZZ'] })).toThrow(
      InvalidGuessError,
    );
  });

  it('rejects once the guess history exceeds the mode attempt budget', () => {
    const wordRepository = new FixedListWordRepository(WORDS);
    const guesses = Array.from({ length: 7 }, () => 'PONTE');

    expect(() => submitDailyGuess({ wordRepository }, { mode: 'termo', guesses })).toThrow(AttemptsExceededError);
  });

  it("resolves today's secret word(s) the same way DailyWordResolver would, for the configured wordCount", () => {
    const wordRepository = new FixedListWordRepository(WORDS);
    const date = currentPuzzleDate();
    const expected = new DailyWordResolver(wordRepository).resolve(date, 'dueto', 2);

    const result = submitDailyGuess({ wordRepository }, { mode: 'dueto', guesses: [expected[0]!.value] });

    expect(result.boards).toHaveLength(2);
    expect(result.boards[0]!.solved).toBe(true);
    expect(result.boards[1]!.solved).toBe(false);
  });
});
