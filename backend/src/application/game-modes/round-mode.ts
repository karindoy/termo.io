import { EventEmitter } from 'node:events';
import type { GameMode } from './game-mode.js';
import type { Attempt } from '../../domain/entities/attempt.js';
import { Room } from '../../domain/entities/room.js';
import { Game, type GameOptions, type RoundResolutionResult } from '../../domain/entities/game.js';
import type { RoundResolutionReason } from '../../domain/entities/word-round.js';
import type { WordRepository } from '../../domain/repositories/word-repository.js';
import { InvalidGuessError } from '../../domain/errors/invalid-guess-error.js';
import { WORD_LENGTH } from '../../domain/entities/word.js';

const DEFAULT_OPTIONS: GameOptions = {
  wordCount: 5,
  maxAttempts: 6,
  timeLimitMs: 5 * 60 * 1000,
  tieBreakMaxAttempts: 3,
  tieBreakTimeLimitMs: 2 * 60 * 1000,
};

export interface RoundSnapshot {
  roundSequence: number;
  wordIndex: number;
  wordCount: number;
  wordLength: number;
  maxAttempts: number;
  timeLimitMs: number;
  roundStartedAt: number;
  phase: 'playing' | 'tie-break' | 'finished';
  tieBreakCandidates: string[] | null;
}

export class RoundMode extends EventEmitter implements GameMode {
  private room: Room | null = null;
  private game: Game | null = null;
  private timeoutHandle: NodeJS.Timeout | null = null;
  private readonly options: GameOptions;

  constructor(
    private readonly roomId: string,
    private readonly wordRepository: WordRepository,
    options: Partial<GameOptions> = {},
  ) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  start(): void {
    this.room = new Room(this.roomId);
    this.game = new Game(this.wordRepository, this.options);
    this.scheduleTimeout();
    this.emit('round:started', this.currentRoundSnapshot());
  }

  joinPlayer(playerId: string, nickname: string): void {
    this.requireRoom().addPlayer({ playerId, nickname });
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

    const attempt = game.submitGuess(playerId, nickname, guess);
    this.checkRoundCompletion();
    return attempt;
  }

  isResolved(): boolean {
    return this.game?.phase === 'finished';
  }

  getWinner(): string | null {
    return this.game?.winnerIds?.[0] ?? null;
  }

  getRoom(): Room {
    return this.requireRoom();
  }

  getGame(): Game {
    return this.requireGame();
  }

  currentRoundSnapshot(): RoundSnapshot {
    const game = this.requireGame();
    return {
      roundSequence: game.roundSequenceNumber,
      wordIndex: game.wordIndexNumber,
      wordCount: this.options.wordCount,
      wordLength: WORD_LENGTH,
      maxAttempts: game.currentRound.maxAttempts,
      timeLimitMs: game.currentRound.timeLimitMs,
      roundStartedAt: game.currentRound.startedAt,
      phase: game.phase,
      tieBreakCandidates: game.tieBreakCandidates,
    };
  }

  private checkRoundCompletion(): void {
    const game = this.requireGame();
    const round = game.currentRound;
    const connectedIds = Array.from(this.requireRoom().players.keys());

    if (round.solvedBy) {
      this.resolveRound('solved', round.solvedBy);
    } else if (round.allPlayersExhausted(connectedIds)) {
      this.resolveRound('exhausted', null);
    }
  }

  private resolveRound(reason: RoundResolutionReason, winnerId: string | null): void {
    this.clearTimeout();
    const game = this.requireGame();
    const connectedIds = Array.from(this.requireRoom().players.keys());
    const result = game.resolveCurrentRound(reason, winnerId, connectedIds);

    this.emit('word:resolved', result);
    this.handleResolutionOutcome(result);
  }

  private handleResolutionOutcome(result: RoundResolutionResult): void {
    if (result.gameStatus === 'finished') {
      this.emit('game:finished', { winnerIds: result.finalWinnerIds, scores: result.scores });
      return;
    }

    if (result.gameStatus === 'tie-break-started') {
      this.emit('tiebreak:started', { candidateIds: result.tieBreakCandidates, ...this.currentRoundSnapshot() });
    } else {
      this.emit('round:started', this.currentRoundSnapshot());
    }

    this.scheduleTimeout();
  }

  private scheduleTimeout(): void {
    const game = this.requireGame();
    this.timeoutHandle = setTimeout(() => {
      this.resolveRound('timeout', null);
    }, game.currentRound.timeLimitMs);
  }

  private clearTimeout(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  private requireRoom(): Room {
    if (!this.room) {
      throw new Error('Game has not started yet');
    }
    return this.room;
  }

  private requireGame(): Game {
    if (!this.game) {
      throw new Error('Game has not started yet');
    }
    return this.game;
  }
}
