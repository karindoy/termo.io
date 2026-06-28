import { InvalidWordError } from '../errors/invalid-word-error.js';

export const WORD_LENGTH = 5;

export class Word {
  private constructor(public readonly value: string) {}

  static create(value: string): Word {
    if (value.length !== WORD_LENGTH) {
      throw new InvalidWordError(`Word must be exactly ${WORD_LENGTH} letters: "${value}"`);
    }
    return new Word(value.toUpperCase());
  }
}
