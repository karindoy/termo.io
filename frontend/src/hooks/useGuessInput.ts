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

/** Cursor-addressable fixed-length guess buffer: arrow keys / cell clicks reposition the
 * cursor, so a letter can be typed/edited at any position, not just appended at the end. */
export function useGuessInput(wordLength: number, enabled: boolean): UseGuessInputResult {
  const [state, setState] = useState<GuessInputState>(() => ({
    letters: emptyLetters(wordLength),
    cursor: 0,
    lastEdited: null,
  }));

  useEffect(() => {
    setState({ letters: emptyLetters(wordLength), cursor: 0, lastEdited: null });
  }, [wordLength]);

  function typeLetter(letter: string): void {
    if (!enabled) return;
    setState((prev) => {
      const letters = [...prev.letters];
      letters[prev.cursor] = letter;
      return { letters, cursor: clampIndex(prev.cursor + 1, wordLength), lastEdited: prev.cursor };
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
