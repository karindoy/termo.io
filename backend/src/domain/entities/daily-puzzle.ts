import { computeFeedback } from '../services/word-matcher.js';
import { isSolved, type GuessFeedback } from '../value-objects/guess-feedback.js';
import { Word, WORD_LENGTH } from './word.js';
import { InvalidGuessError } from '../errors/invalid-guess-error.js';
import { AttemptsExceededError } from '../errors/attempts-exceeded-error.js';

export interface DailyBoardAttempt {
  guess: string;
  feedback: GuessFeedback;
  attemptNumber: number;
}

export interface DailyBoardResult {
  attempts: DailyBoardAttempt[];
  solved: boolean;
  /** Only populated once this board is solved or the puzzle is out of attempts. */
  revealedWord: string | null;
}

export interface DailyPuzzleResult {
  boards: DailyBoardResult[];
  attemptsUsed: number;
  maxAttempts: number;
  finished: boolean;
  won: boolean;
}

/** A daily puzzle has `secretWords.length` boards open at once against one shared attempt
 * budget (`maxAttempts`) — Termo has 1 board, Dueto 2, Quarteto 4. There is no persisted
 * server-side state between requests: the caller resends the full ordered guess history
 * every time and `replay` recomputes everything from scratch, stopping a board's guess
 * stream the moment it's solved (matching the "one guess, checked against every still-open
 * board" rule) while still counting every guess once toward the shared budget. */
export class DailyPuzzle {
  constructor(
    readonly secretWords: Word[],
    readonly maxAttempts: number,
  ) {}

  replay(guesses: string[]): DailyPuzzleResult {
    if (guesses.length > this.maxAttempts) {
      throw new AttemptsExceededError('Número de tentativas excede o limite do dia');
    }
    for (const guess of guesses) {
      if (guess.length !== WORD_LENGTH) {
        throw new InvalidGuessError(`A palavra deve ter exatamente ${WORD_LENGTH} letras`);
      }
    }

    const boards = this.secretWords.map((secretWord) => this.replayBoard(secretWord, guesses));
    const won = boards.every((board) => board.solved);
    const finished = won || guesses.length >= this.maxAttempts;

    return { boards, attemptsUsed: guesses.length, maxAttempts: this.maxAttempts, finished, won };
  }

  private replayBoard(secretWord: Word, guesses: string[]): DailyBoardResult {
    const attempts: DailyBoardAttempt[] = [];
    let solved = false;

    for (const guess of guesses) {
      if (solved) break;
      const feedback = computeFeedback(secretWord, guess);
      attempts.push({ guess: guess.toUpperCase(), feedback, attemptNumber: attempts.length + 1 });
      if (isSolved(feedback)) solved = true;
    }

    const finished = solved || guesses.length >= this.maxAttempts;
    return { attempts, solved, revealedWord: finished ? secretWord.value : null };
  }
}
