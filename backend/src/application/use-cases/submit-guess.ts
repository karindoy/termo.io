import type { GameMode } from '../game-modes/game-mode.js';
import type { Attempt } from '../../domain/entities/attempt.js';

export interface SubmitGuessInput {
  playerId: string;
  nickname: string;
  guess: string;
}

export interface SubmitGuessResult {
  attempt: Attempt;
  solved: boolean;
  winnerId: string | null;
}

export function submitGuess(gameMode: GameMode, input: SubmitGuessInput): SubmitGuessResult {
  const attempt = gameMode.submitGuess(input.playerId, input.nickname, input.guess);
  return {
    attempt,
    solved: gameMode.isResolved(),
    winnerId: gameMode.getWinner(),
  };
}
