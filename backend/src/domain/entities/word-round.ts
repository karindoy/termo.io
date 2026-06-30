import type { Attempt } from './attempt.js';
import { Word, WORD_LENGTH } from './word.js';
import { InvalidGuessError } from '../errors/invalid-guess-error.js';
import { AttemptsExceededError } from '../errors/attempts-exceeded-error.js';
import { RoundAlreadyResolvedError } from '../errors/round-already-resolved-error.js';
import { isSolved } from '../value-objects/guess-feedback.js';
import { computeFeedback } from '../services/word-matcher.js';

export type RoundResolutionReason = 'solved' | 'timeout' | 'exhausted';

export class WordRound {
  readonly attempts: Attempt[] = [];
  readonly startedAt = Date.now();
  resolved = false;
  resolvedReason: RoundResolutionReason | null = null;
  solvedBy: string | null = null;
  extraAttemptsGranted = false;

  constructor(
    readonly secretWord: Word,
    public maxAttempts: number,
    readonly timeLimitMs: number,
  ) {}

  grantExtraAttempts(count: number): void {
    this.maxAttempts += count;
    this.extraAttemptsGranted = true;
  }

  attemptsFor(playerId: string): Attempt[] {
    return this.attempts.filter((attempt) => attempt.playerId === playerId);
  }

  submitGuess(playerId: string, nickname: string, guessValue: string): Attempt {
    if (this.resolved) {
      throw new RoundAlreadyResolvedError('Esta palavra já foi resolvida');
    }
    if (guessValue.length !== WORD_LENGTH) {
      throw new InvalidGuessError(`Guess must be exactly ${WORD_LENGTH} letters`);
    }
    if (this.attemptsFor(playerId).length >= this.maxAttempts) {
      throw new AttemptsExceededError('Você esgotou suas tentativas nesta palavra');
    }

    const feedback = computeFeedback(this.secretWord, guessValue);
    const attempt: Attempt = {
      playerId,
      nickname,
      guess: guessValue.toUpperCase(),
      feedback,
      attemptNumber: this.attemptsFor(playerId).length + 1,
      createdAt: Date.now(),
    };

    this.attempts.push(attempt);

    if (this.solvedBy === null && isSolved(feedback)) {
      this.solvedBy = playerId;
    }

    return attempt;
  }

  allPlayersExhausted(connectedPlayerIds: string[]): boolean {
    if (connectedPlayerIds.length === 0) return false;
    return connectedPlayerIds.every((playerId) => this.attemptsFor(playerId).length >= this.maxAttempts);
  }

  isExpired(now: number): boolean {
    return now - this.startedAt >= this.timeLimitMs;
  }

  resolve(reason: RoundResolutionReason, winnerId: string | null = null): void {
    if (this.resolved) return;
    this.resolved = true;
    this.resolvedReason = reason;
    if (reason === 'solved') {
      this.solvedBy = winnerId ?? this.solvedBy;
    }
  }
}
