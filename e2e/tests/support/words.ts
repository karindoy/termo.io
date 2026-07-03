import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORDLIST_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../backend/src/infrastructure/persistence/words/wordlist.txt',
);

const ASCII_WORD_PATTERN = /^[a-z]{5}$/;

function loadCandidateWords(): string[] {
  return readFileSync(WORDLIST_PATH, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((word) => ASCII_WORD_PATTERN.test(word));
}

export interface E2eWords {
  corridaWord: string;
  championshipRound1Word: string;
  championshipRound2Word: string;
  tieBreakWord: string;
  wrongGuess: string;
}

// Deterministically picks 5 distinct plain-ASCII words from the backend's own
// wordlist, so the test and the E2E_FIXED_WORDS env var it feeds the backend
// always agree without duplicating word literals in two places.
export function pickE2eWords(): E2eWords {
  const candidates = loadCandidateWords();
  const [corridaWord, championshipRound1Word, championshipRound2Word, tieBreakWord, wrongGuess] = candidates;
  if (!corridaWord || !championshipRound1Word || !championshipRound2Word || !tieBreakWord || !wrongGuess) {
    throw new Error('Not enough plain-ASCII 5-letter words found in wordlist.txt to build e2e fixtures');
  }
  return { corridaWord, championshipRound1Word, championshipRound2Word, tieBreakWord, wrongGuess };
}

export function e2eFixedWordsEnv(words: E2eWords): string {
  return [words.corridaWord, words.championshipRound1Word, words.championshipRound2Word, words.tieBreakWord].join(',');
}
