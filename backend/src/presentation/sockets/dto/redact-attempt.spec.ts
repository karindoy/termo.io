import { describe, expect, it } from 'vitest';
import type { Attempt } from '../../../domain/entities/attempt.js';
import { redactAttempt, redactAttemptsForViewer } from './redact-attempt.js';

function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    playerId: 'player-1',
    nickname: 'Alice',
    guess: 'TERMO',
    feedback: [
      { letter: 'T', status: 'correct' },
      { letter: 'E', status: 'absent' },
      { letter: 'R', status: 'present' },
      { letter: 'M', status: 'absent' },
      { letter: 'O', status: 'correct' },
    ],
    attemptNumber: 1,
    createdAt: 1000,
    ...overrides,
  };
}

describe('redactAttempt', () => {
  it('clears the guess and every letter while keeping the status', () => {
    const attempt = makeAttempt();
    const redacted = redactAttempt(attempt);

    expect(redacted.guess).toBe('');
    expect(redacted.feedback.map((letter) => letter.letter)).toEqual(['', '', '', '', '']);
    expect(redacted.feedback.map((letter) => letter.status)).toEqual(
      attempt.feedback.map((letter) => letter.status),
    );
  });

  it('preserves identifying fields untouched', () => {
    const attempt = makeAttempt();
    const redacted = redactAttempt(attempt);

    expect(redacted.playerId).toBe(attempt.playerId);
    expect(redacted.nickname).toBe(attempt.nickname);
    expect(redacted.attemptNumber).toBe(attempt.attemptNumber);
    expect(redacted.createdAt).toBe(attempt.createdAt);
  });
});

describe('redactAttemptsForViewer', () => {
  it('keeps the viewer own attempts untouched', () => {
    const own = makeAttempt({ playerId: 'viewer' });
    const [result] = redactAttemptsForViewer([own], 'viewer');

    expect(result).toEqual(own);
  });

  it('redacts attempts that belong to other players', () => {
    const other = makeAttempt({ playerId: 'someone-else' });
    const [result] = redactAttemptsForViewer([other], 'viewer');

    expect(result?.guess).toBe('');
    expect(result?.feedback.every((letter) => letter.letter === '')).toBe(true);
  });
});
