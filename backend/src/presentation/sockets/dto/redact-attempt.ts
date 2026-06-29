import type { Attempt } from '../../../domain/entities/attempt.js';

export function redactAttempt(attempt: Attempt): Attempt {
  return {
    ...attempt,
    guess: '',
    feedback: attempt.feedback.map((letter) => ({ ...letter, letter: '' })),
  };
}

export function redactAttemptsForViewer(attempts: Attempt[], viewerPlayerId: string): Attempt[] {
  return attempts.map((attempt) => (attempt.playerId === viewerPlayerId ? attempt : redactAttempt(attempt)));
}
