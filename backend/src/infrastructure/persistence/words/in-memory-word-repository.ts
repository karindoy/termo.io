import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Word } from '../../../domain/entities/word.js';
import type { WordRepository } from '../../../domain/repositories/word-repository.js';
import { normalizeWord } from '../../../domain/value-objects/normalize-letter.js';

const WORDLIST_PATH = join(dirname(fileURLToPath(import.meta.url)), 'wordlist.txt');

// Every word in the list is eligible to be both the secret word and a valid guess.
function loadWords(): string[] {
  return readFileSync(WORDLIST_PATH, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

const WORDS = loadWords();

export class InMemoryWordRepository implements WordRepository {
  private readonly normalizedWords = new Set(WORDS.map(normalizeWord));

  getRandomWord(): Word {
    const value = WORDS[Math.floor(Math.random() * WORDS.length)]!;
    return Word.create(value);
  }

  isValidGuess(value: string): boolean {
    return this.normalizedWords.has(normalizeWord(value));
  }
}
