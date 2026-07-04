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
  roomId: string;
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

export class ChampionshipMode extends EventEmitter implements GameMode {
  private room: Room | null = null;
  private game: Game | null = null;
  private timeoutHandle: NodeJS.Timeout | null = null;
  private options: GameOptions;

  constructor(
    private readonly roomId: string,
    private readonly wordRepository: WordRepository,
    options: Partial<GameOptions> = {},
  ) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  start(): void {
    this.room = this.room ?? new Room(this.roomId);
    this.game = new Game(this.wordRepository, this.options);
    this.scheduleTimeout();
    this.emit('round:started', this.currentRoundSnapshot());
  }

  updateOptions(options: Partial<GameOptions>): void {
    this.options = { ...this.options, ...options };
  }

  joinPlayer(playerId: string, nickname: string): void {
    this.room = this.room ?? new Room(this.roomId);
    this.room.addPlayer({ playerId, nickname });
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
      roomId: this.roomId,
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

    // The word stays open — even after someone solves it — until every player still eligible
    // to guess it has either solved it themselves or run out of attempts, so the round can
    // award the point to whoever solved it in the fewest attempts rather than whoever merely
    // solved it first. During a tie-break, only the tied candidates are eligible — everyone
    // else in the room is barred from guessing and would never "finish", so they must not be
    // counted or the round would hang until its timeout every time.
    if (!round.allPlayersFinished(this.eligiblePlayerIds(game))) return;

    const best = round.bestSolver();
    if (best) {
      this.resolveRound('solved', best.playerId);
    } else if (!round.extraAttemptsGranted) {
      round.grantExtraAttempts(2);
      this.emit('round:extra-attempts', this.currentRoundSnapshot());
    } else {
      this.resolveRound('exhausted', null);
    }
  }

  private eligiblePlayerIds(game: Game): string[] {
    const connectedIds = Array.from(this.requireRoom().players.keys());
    if (game.phase === 'tie-break' && game.tieBreakCandidates) {
      const candidates = game.tieBreakCandidates;
      return connectedIds.filter((playerId) => candidates.includes(playerId));
    }
    return connectedIds;
  }

  private resolveRound(reason: RoundResolutionReason, winnerId: string | null): void {
    this.clearTimeout();
    const game = this.requireGame();
    const connectedIds = Array.from(this.requireRoom().players.keys());
    const result = game.resolveCurrentRound(reason, winnerId, connectedIds);

    this.emit('word:resolved', { roomId: this.roomId, ...result });
    this.handleResolutionOutcome(result);
  }

  private handleResolutionOutcome(result: RoundResolutionResult): void {
    if (result.gameStatus === 'finished') {
      this.emit('game:finished', { roomId: this.roomId, winnerIds: result.finalWinnerIds, scores: result.scores });
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
      // Some players may have already solved the word before time ran out for the
      // stragglers — the fastest-by-attempts of them still wins the point.
      const best = game.currentRound.bestSolver();
      this.resolveRound(best ? 'solved' : 'timeout', best?.playerId ?? null);
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
