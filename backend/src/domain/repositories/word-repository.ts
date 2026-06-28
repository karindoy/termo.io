import type { Word } from '../entities/word.js';

export interface WordRepository {
  getRandomWord(): Word;
  isValidGuess(value: string): boolean;
}
