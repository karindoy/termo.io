import { EventEmitter } from 'node:events';
import type { GameMode } from './game-mode.js';
import type { Attempt } from '../../domain/entities/attempt.js';
import { Room } from '../../domain/entities/room.js';
import { RaceGame, type RaceGameOptions } from '../../domain/entities/race-game.js';
import type { RaceResolutionReason } from '../../domain/entities/race-game.js';
import type { WordRepository } from '../../domain/repositories/word-repository.js';
import { InvalidGuessError } from '../../domain/errors/invalid-guess-error.js';
import { WORD_LENGTH } from '../../domain/entities/word.js';

const DEFAULT_OPTIONS: RaceGameOptions = {
  wordCount: 5,
  timeLimitMs: 5 * 60 * 1000,
};

export interface RaceConfigSnapshot {
  roomId: string;
  wordCount: number;
  wordLength: number;
  timeLimitMs: number;
}

export interface PlayerRoundSnapshot {
  roomId: string;
  playerId: string;
  wordIndex: number;
  roundStartedAt: number;
  finished: boolean;
}

export class RaceMode extends EventEmitter implements GameMode {
  private room: Room | null = null;
  private game: RaceGame | null = null;
  private readonly timeouts = new Map<string, NodeJS.Timeout>();
  private options: RaceGameOptions;

  constructor(
    private readonly roomId: string,
    private readonly wordRepository: WordRepository,
    options: Partial<RaceGameOptions> = {},
  ) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  start(): void {
    this.room = this.room ?? new Room(this.roomId);
    this.game = new RaceGame(this.wordRepository, this.options);
    this.emit('race:started', this.configSnapshot());
    // Players who joined during the lobby phase predate this.game — register them now.
    for (const player of this.room.players.values()) {
      this.ensurePlayerInGame(player.playerId);
    }
  }

  updateOptions(options: Partial<RaceGameOptions>): void {
    this.options = { ...this.options, ...options };
  }

  joinPlayer(playerId: string, nickname: string): void {
    this.room = this.room ?? new Room(this.roomId);
    this.room.addPlayer({ playerId, nickname });
    if (this.game) this.ensurePlayerInGame(playerId);
  }

  submitGuess(playerId: string, nickname: string, guess: string): Attempt {
    const room = this.requireRoom();
    const game = this.requireGame();

    if (!this.wordRepository.isValidGuess(guess)) {
      throw new InvalidGuessError(`"${guess}" não está na lista de palavras`);
    }

    if (!room.players.has(playerId)) {
      room.addPlayer({ playerId, nickname });
    }
    this.ensurePlayerInGame(playerId);

    const attempt = game.submitGuess(playerId, nickname, guess);
    this.checkPlayerCompletion(playerId);
    return attempt;
  }

  isResolved(): boolean {
    return this.game?.phase === 'finished';
  }

  getWinner(): string | null {
    return this.game?.winnerId ?? null;
  }

  getRoom(): Room {
    return this.requireRoom();
  }

  getGame(): RaceGame {
    return this.requireGame();
  }

  configSnapshot(): RaceConfigSnapshot {
    return {
      roomId: this.roomId,
      wordCount: this.options.wordCount,
      wordLength: WORD_LENGTH,
      timeLimitMs: this.options.timeLimitMs,
    };
  }

  playerRoundSnapshot(playerId: string): PlayerRoundSnapshot {
    const game = this.requireGame();
    return {
      roomId: this.roomId,
      playerId,
      wordIndex: game.wordIndexFor(playerId),
      roundStartedAt: game.currentRoundFor(playerId).startedAt,
      finished: game.isFinished(playerId),
    };
  }

  private ensurePlayerInGame(playerId: string): void {
    const game = this.requireGame();
    if (game.hasPlayer(playerId)) return;
    game.addPlayer(playerId);
    this.schedulePlayerTimeout(playerId);
    this.emit('player:word-started', this.playerRoundSnapshot(playerId));
  }

  private checkPlayerCompletion(playerId: string): void {
    const round = this.requireGame().currentRoundFor(playerId);
    if (round.solvedBy) {
      this.resolvePlayerWord(playerId, 'solved');
    }
  }

  private resolvePlayerWord(playerId: string, reason: RaceResolutionReason): void {
    this.clearPlayerTimeout(playerId);
    const game = this.requireGame();
    const result = game.resolvePlayerWord(playerId, reason);

    this.emit('player:word-resolved', { roomId: this.roomId, ...result });

    if (result.gameFinished) {
      this.clearAllTimeouts();
      this.emit('race:finished', { roomId: this.roomId, winnerId: result.winnerId });
      return;
    }

    if (result.hasNextWord) {
      this.schedulePlayerTimeout(playerId);
      this.emit('player:word-started', this.playerRoundSnapshot(playerId));
    }
  }

  private schedulePlayerTimeout(playerId: string): void {
    const round = this.requireGame().currentRoundFor(playerId);
    const handle = setTimeout(() => {
      this.resolvePlayerWord(playerId, 'timeout');
    }, round.timeLimitMs);
    this.timeouts.set(playerId, handle);
  }

  private clearPlayerTimeout(playerId: string): void {
    const handle = this.timeouts.get(playerId);
    if (handle) {
      clearTimeout(handle);
      this.timeouts.delete(playerId);
    }
  }

  private clearAllTimeouts(): void {
    for (const handle of this.timeouts.values()) clearTimeout(handle);
    this.timeouts.clear();
  }

  private requireRoom(): Room {
    if (!this.room) {
      throw new Error('Game has not started yet');
    }
    return this.room;
  }

  private requireGame(): RaceGame {
    if (!this.game) {
      throw new Error('Game has not started yet');
    }
    return this.game;
  }
}
