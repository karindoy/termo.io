import type { GameMode } from './game-mode.js';
import type { Attempt } from '../../domain/entities/attempt.js';
import { Room } from '../../domain/entities/room.js';
import { WordRound } from '../../domain/entities/word-round.js';
import type { WordRepository } from '../../domain/repositories/word-repository.js';
import { InvalidGuessError } from '../../domain/errors/invalid-guess-error.js';

const NO_ATTEMPT_LIMIT = Number.POSITIVE_INFINITY;
const NO_TIME_LIMIT = Number.POSITIVE_INFINITY;

export class SingleWordMode implements GameMode {
  private room: Room | null = null;
  private round: WordRound | null = null;

  constructor(
    private readonly roomId: string,
    private readonly wordRepository: WordRepository,
  ) {}

  start(): void {
    this.room = new Room(this.roomId);
    const word = this.wordRepository.getRandomWord();
    this.round = new WordRound(word, NO_ATTEMPT_LIMIT, NO_TIME_LIMIT);
  }

  submitGuess(playerId: string, nickname: string, guess: string): Attempt {
    const room = this.requireRoom();
    const round = this.requireRound();

    if (!this.wordRepository.isValidGuess(guess)) {
      throw new InvalidGuessError(`"${guess}" não está na lista de palavras`);
    }

    if (!room.players.has(playerId)) {
      room.addPlayer({ playerId, nickname });
    }

    return round.submitGuess(playerId, nickname, guess);
  }

  isResolved(): boolean {
    return this.round?.solvedBy != null;
  }

  getWinner(): string | null {
    return this.round?.solvedBy ?? null;
  }

  getRoom(): Room {
    return this.requireRoom();
  }

  getRound(): WordRound {
    return this.requireRound();
  }

  private requireRoom(): Room {
    if (!this.room) {
      throw new Error('Game has not started yet');
    }
    return this.room;
  }

  private requireRound(): WordRound {
    if (!this.round) {
      throw new Error('Game has not started yet');
    }
    return this.round;
  }
}
