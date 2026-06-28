import type { GuessFeedback } from '../value-objects/guess-feedback.js';

export interface Attempt {
  playerId: string;
  nickname: string;
  guess: string;
  feedback: GuessFeedback;
  attemptNumber: number;
  createdAt: number;
}
