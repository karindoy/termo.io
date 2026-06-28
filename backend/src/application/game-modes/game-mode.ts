import type { Attempt } from '../../domain/entities/attempt.js';

export interface GameMode {
  start(): void;
  submitGuess(playerId: string, nickname: string, guess: string): Attempt;
  isResolved(): boolean;
  getWinner(): string | null;
}
