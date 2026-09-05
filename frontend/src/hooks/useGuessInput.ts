import { useEffect, useState } from 'react';

interface GuessInputState {
  letters: string[];
  cursor: number;
  lastEdited: number | null;
}

export interface UseGuessInputResult {
  letters: string[];
  cursor: number;
  /** Index of the cell most recently written/cleared, for "just typed" pop animations. */
  lastEdited: number | null;
  guess: string;
  isComplete: boolean;
  typeLetter: (letter: string) => void;
  backspace: () => void;
  moveCursor: (delta: number) => void;
  setCursor: (index: number) => void;
  reset: () => void;
}

function emptyLetters(wordLength: number): string[] {
  return Array(wordLength).fill('');
}

function clampIndex(index: number, wordLength: number): number {
  return Math.max(0, Math.min(index, wordLength - 1));
}

/** Next empty cell after `from`, scanning left to right and wrapping around the row.
 * Falls back to `from + 1`, wrapped around the row, once every cell is filled. */
function nextCursorAfterType(letters: string[], wordLength: number, from: number): number {
  for (let step = 1; step <= wordLength; step++) {
    const index = (from + step) % wordLength;
    if (!letters[index]) return index;
  }
  return (from + 1) % wordLength;
}

/** Cursor-addressable fixed-length guess buffer: arrow keys / cell clicks reposition the
 * cursor, so a letter can be typed/edited at any position, not just appended at the end.
 * `resetKey` should change whenever the word to guess changes (e.g. round sequence /
 * word index) so leftover letters from the previous word don't linger in the row. */
export function useGuessInput(wordLength: number, enabled: boolean, resetKey?: unknown): UseGuessInputResult {
  const [state, setState] = useState<GuessInputState>(() => ({
    letters: emptyLetters(wordLength),
    cursor: 0,
    lastEdited: null,
  }));

  useEffect(() => {
    setState({ letters: emptyLetters(wordLength), cursor: 0, lastEdited: null });
  }, [wordLength, resetKey]);

  function typeLetter(letter: string): void {
    if (!enabled) return;
    setState((prev) => {
      const letters = [...prev.letters];
      letters[prev.cursor] = letter;
      return { letters, cursor: nextCursorAfterType(letters, wordLength, prev.cursor), lastEdited: prev.cursor };
    });
  }

  function backspace(): void {
    if (!enabled) return;
    setState((prev) => {
      const letters = [...prev.letters];
      if (letters[prev.cursor] !== '') {
        letters[prev.cursor] = '';
        return { letters, cursor: prev.cursor, lastEdited: prev.cursor };
      }
      if (prev.cursor > 0) {
        letters[prev.cursor - 1] = '';
        return { letters, cursor: prev.cursor - 1, lastEdited: prev.cursor - 1 };
      }
      return prev;
    });
  }

  function moveCursor(delta: number): void {
    if (!enabled) return;
    setState((prev) => ({ ...prev, cursor: clampIndex(prev.cursor + delta, wordLength) }));
  }

  function setCursor(index: number): void {
    if (!enabled) return;
    setState((prev) => ({ ...prev, cursor: clampIndex(index, wordLength) }));
  }

  function reset(): void {
    setState({ letters: emptyLetters(wordLength), cursor: 0, lastEdited: null });
  }

  return {
    letters: state.letters,
    cursor: state.cursor,
    lastEdited: state.lastEdited,
    guess: state.letters.join(''),
    isComplete: state.letters.every((letter) => letter !== ''),
    typeLetter,
    backspace,
    moveCursor,
    setCursor,
    reset,
  };
}
