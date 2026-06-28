const COMBINING_DIACRITICAL_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

export function normalizeLetter(letter: string): string {
  return letter.normalize('NFD').replace(COMBINING_DIACRITICAL_MARKS, '').toUpperCase();
}

export function normalizeWord(word: string): string {
  return word
    .split('')
    .map((letter) => normalizeLetter(letter))
    .join('');
}
