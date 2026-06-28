import type { GameMode } from './game-mode.js';
import type { Attempt } from '../../domain/entities/attempt.js';
import { Room } from '../../domain/entities/room.js';
import type { WordRepository } from '../../domain/repositories/word-repository.js';
import { InvalidGuessError } from '../../domain/errors/invalid-guess-error.js';

export class SingleWordMode implements GameMode {
  private room: Room | null = null;

  constructor(
    private readonly roomId: string,
    private readonly wordRepository: WordRepository,
  ) {}

  start(): void {
    const word = this.wordRepository.getRandomWord();
    this.room = new Room(this.roomId, word);
  }

  submitGuess(playerId: string, nickname: string, guess: string): Attempt {
    const room = this.requireRoom();

    if (!this.wordRepository.isValidGuess(guess)) {
      throw new InvalidGuessError(`"${guess}" não está na lista de palavras`);
    }

    if (!room.players.has(playerId)) {
      room.addPlayer({ playerId, nickname });
    }

    return room.submitGuess(playerId, nickname, guess);
  }

  isResolved(): boolean {
    return this.room?.solvedBy != null;
  }

  getWinner(): string | null {
    return this.room?.solvedBy ?? null;
  }

  getRoom(): Room {
    return this.requireRoom();
  }

  private requireRoom(): Room {
    if (!this.room) {
      throw new Error('Game has not started yet');
    }
    return this.room;
  }
}
