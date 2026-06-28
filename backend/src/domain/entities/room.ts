import type { Attempt } from './attempt.js';
import { Word, WORD_LENGTH } from './word.js';
import { InvalidGuessError } from '../errors/invalid-guess-error.js';
import { isSolved } from '../value-objects/guess-feedback.js';
import { computeFeedback } from '../services/word-matcher.js';

export interface Player {
  playerId: string;
  nickname: string;
}

export class Room {
  readonly players = new Map<string, Player>();
  readonly attempts: Attempt[] = [];
  solvedBy: string | null = null;

  constructor(
    readonly id: string,
    readonly secretWord: Word,
  ) {}

  addPlayer(player: Player): void {
    this.players.set(player.playerId, player);
  }

  attemptsFor(playerId: string): Attempt[] {
    return this.attempts.filter((attempt) => attempt.playerId === playerId);
  }

  submitGuess(playerId: string, nickname: string, guessValue: string): Attempt {
    if (guessValue.length !== WORD_LENGTH) {
      throw new InvalidGuessError(`Guess must be exactly ${WORD_LENGTH} letters`);
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
}
