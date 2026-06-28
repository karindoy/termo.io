import { Word, WORD_LENGTH } from '../entities/word.js';
import type { GuessFeedback, LetterStatus } from '../value-objects/guess-feedback.js';
import { normalizeLetter } from '../value-objects/normalize-letter.js';

export function computeFeedback(secret: Word, guess: string): GuessFeedback {
  const secretLetters = secret.value.split('').map(normalizeLetter);
  const guessLetters = guess.toUpperCase().split('').map(normalizeLetter);

  const statuses: LetterStatus[] = new Array(WORD_LENGTH).fill('absent');
  const remaining = new Map<string, number>();

  for (let i = 0; i < WORD_LENGTH; i++) {
    const secretLetter = secretLetters[i]!;
    if (guessLetters[i] === secretLetter) {
      statuses[i] = 'correct';
    } else {
      remaining.set(secretLetter, (remaining.get(secretLetter) ?? 0) + 1);
    }
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (statuses[i] === 'correct') continue;
    const guessLetter = guessLetters[i]!;
    const available = remaining.get(guessLetter) ?? 0;
    if (available > 0) {
      statuses[i] = 'present';
      remaining.set(guessLetter, available - 1);
    }
  }

  return statuses.map((status, i) => ({
    letter: guess[i]!.toUpperCase(),
    status,
  }));
}
