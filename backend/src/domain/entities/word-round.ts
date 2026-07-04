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
  /** First player, chronologically, whose guess matched the secret word. */
  solvedBy: string | null = null;
  /** Every player who has solved this word so far, keyed by playerId, holding the attempt
   * that solved it for them (its attemptNumber is how many guesses they needed). Championship
   * mode uses this to award the word to whoever solved it in the fewest attempts, rather than
   * whoever solved it first — `solvedBy` alone can't express that once more than one player
   * is allowed to keep playing after another player has already solved. */
  readonly solvedAttempts = new Map<string, Attempt>();
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
    if (this.solvedAttempts.has(playerId)) {
      throw new AttemptsExceededError('Você já resolveu esta palavra');
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

    if (isSolved(feedback)) {
      if (this.solvedBy === null) this.solvedBy = playerId;
      this.solvedAttempts.set(playerId, attempt);
    }

    return attempt;
  }

  /** True once every connected player has either solved the word or used up their attempts —
   * i.e. nobody left who could still improve on the current best attempt count. */
  hasFinished(playerId: string): boolean {
    return this.solvedAttempts.has(playerId) || this.attemptsFor(playerId).length >= this.maxAttempts;
  }

  allPlayersFinished(connectedPlayerIds: string[]): boolean {
    if (connectedPlayerIds.length === 0) return false;
    return connectedPlayerIds.every((playerId) => this.hasFinished(playerId));
  }

  /** The player who solved the word in the fewest attempts; ties go to whoever solved it
   * first. Returns null if nobody has solved it (yet). */
  bestSolver(): { playerId: string; attempt: Attempt } | null {
    let best: { playerId: string; attempt: Attempt } | null = null;
    for (const [playerId, attempt] of this.solvedAttempts) {
      if (
        !best ||
        attempt.attemptNumber < best.attempt.attemptNumber ||
        (attempt.attemptNumber === best.attempt.attemptNumber && attempt.createdAt < best.attempt.createdAt)
      ) {
        best = { playerId, attempt };
      }
    }
    return best;
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
