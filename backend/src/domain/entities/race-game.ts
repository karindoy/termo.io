import type { Attempt } from './attempt.js';
import { Word } from './word.js';
import { WordRound } from './word-round.js';
import type { WordRepository } from '../repositories/word-repository.js';
import { GameAlreadyFinishedError } from '../errors/game-already-finished-error.js';

export type RaceGamePhase = 'playing' | 'finished';
export type RaceResolutionReason = 'solved' | 'timeout';

export interface RaceGameOptions {
  wordCount: number;
  timeLimitMs: number;
}

interface PlayerProgress {
  playerId: string;
  wordIndex: number;
  round: WordRound;
  allSolved: boolean;
  finished: boolean;
}

export interface PlayerWordResolution {
  playerId: string;
  wordIndex: number;
  reason: RaceResolutionReason;
  revealedWord: string;
  hasNextWord: boolean;
  playerFinished: boolean;
  playerWon: boolean;
  gameFinished: boolean;
  winnerId: string | null;
}

export interface PlayerProgressSnapshot {
  playerId: string;
  wordIndex: number;
  roundStartedAt: number;
  finished: boolean;
  won: boolean;
}

export class RaceGame {
  phase: RaceGamePhase = 'playing';
  winnerId: string | null = null;

  private readonly words: Word[];
  private readonly players = new Map<string, PlayerProgress>();

  constructor(
    private readonly wordRepository: WordRepository,
    private readonly options: RaceGameOptions,
  ) {
    this.words = Array.from({ length: options.wordCount }, () => wordRepository.getRandomWord());
  }

  hasPlayer(playerId: string): boolean {
    return this.players.has(playerId);
  }

  addPlayer(playerId: string): void {
    if (this.players.has(playerId)) return;
    this.players.set(playerId, {
      playerId,
      wordIndex: 0,
      round: new WordRound(this.words[0]!, Number.POSITIVE_INFINITY, this.options.timeLimitMs),
      allSolved: true,
      finished: false,
    });
  }

  wordIndexFor(playerId: string): number {
    return this.requirePlayer(playerId).wordIndex;
  }

  isFinished(playerId: string): boolean {
    return this.requirePlayer(playerId).finished;
  }

  currentRoundFor(playerId: string): WordRound {
    return this.requirePlayer(playerId).round;
  }

  attemptsFor(playerId: string): Attempt[] {
    return this.requirePlayer(playerId).round.attempts;
  }

  progressSummary(): PlayerProgressSnapshot[] {
    return Array.from(this.players.values()).map((progress) => ({
      playerId: progress.playerId,
      wordIndex: progress.wordIndex,
      roundStartedAt: progress.round.startedAt,
      finished: progress.finished,
      won: this.winnerId === progress.playerId,
    }));
  }

  submitGuess(playerId: string, nickname: string, guessValue: string): Attempt {
    if (this.phase === 'finished') {
      throw new GameAlreadyFinishedError('O jogo já terminou');
    }
    return this.requirePlayer(playerId).round.submitGuess(playerId, nickname, guessValue);
  }

  resolvePlayerWord(playerId: string, reason: RaceResolutionReason): PlayerWordResolution {
    const progress = this.requirePlayer(playerId);
    progress.round.resolve(reason, reason === 'solved' ? playerId : null);
    if (reason === 'timeout') progress.allSolved = false;

    const wordIndex = progress.wordIndex;
    const revealedWord = progress.round.secretWord.value;
    const nextIndex = wordIndex + 1;

    if (nextIndex < this.words.length) {
      progress.wordIndex = nextIndex;
      progress.round = new WordRound(this.words[nextIndex]!, Number.POSITIVE_INFINITY, this.options.timeLimitMs);
      return {
        playerId,
        wordIndex,
        reason,
        revealedWord,
        hasNextWord: true,
        playerFinished: false,
        playerWon: false,
        gameFinished: false,
        winnerId: this.winnerId,
      };
    }

    progress.finished = true;
    const playerWon = progress.allSolved;

    if (playerWon) {
      this.phase = 'finished';
      this.winnerId = playerId;
    } else if (this.allPlayersFinished()) {
      this.phase = 'finished';
    }

    return {
      playerId,
      wordIndex,
      reason,
      revealedWord,
      hasNextWord: false,
      playerFinished: true,
      playerWon,
      gameFinished: this.phase === 'finished',
      winnerId: this.winnerId,
    };
  }

  private allPlayersFinished(): boolean {
    if (this.players.size === 0) return false;
    return Array.from(this.players.values()).every((progress) => progress.finished);
  }

  private requirePlayer(playerId: string): PlayerProgress {
    const progress = this.players.get(playerId);
    if (!progress) throw new Error('Player not in game');
    return progress;
  }
}
