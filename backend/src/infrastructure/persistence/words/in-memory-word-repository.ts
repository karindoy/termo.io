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

// Opt-in test hook: unset in normal/prod use. When set, secret words cycle through
// this list in order instead of being picked randomly, so e2e tests can know the
// secret word in advance (to script a winning guess) without touching game logic.
const FIXED_WORDS = process.env.E2E_FIXED_WORDS?.split(',').map((word) => word.trim()).filter(Boolean);
let fixedWordCursor = 0;

export class InMemoryWordRepository implements WordRepository {
  private readonly normalizedWords = new Set(WORDS.map(normalizeWord));

  getRandomWord(): Word {
    if (FIXED_WORDS && FIXED_WORDS.length > 0) {
      const value = FIXED_WORDS[fixedWordCursor % FIXED_WORDS.length]!;
      fixedWordCursor += 1;
      return Word.create(value);
    }
    const value = WORDS[Math.floor(Math.random() * WORDS.length)]!;
    return Word.create(value);
  }

  isValidGuess(value: string): boolean {
    return this.normalizedWords.has(normalizeWord(value));
  }
}
