import type { Word } from '../entities/word.js';

export interface WordRepository {
  getRandomWord(): Word;
  isValidGuess(value: string): boolean;
  /** Deterministic lookup by position in the dictionary — used to derive the same
   * word(s) for every player from a date-seeded index (see DailyWordResolver). */
  getWordAt(index: number): Word;
  size(): number;
}
