import type { Attempt } from './attempt.js';
import { Word } from './word.js';
import { WordRound, type RoundResolutionReason } from './word-round.js';
import type { WordRepository } from '../repositories/word-repository.js';
import { InvalidGuessError } from '../errors/invalid-guess-error.js';

export type GamePhase = 'playing' | 'tie-break' | 'finished';
export type GameStatus = 'continue' | 'tie-break-started' | 'finished';

export interface GameOptions {
  wordCount: number;
  maxAttempts: number;
  timeLimitMs: number;
  tieBreakMaxAttempts: number;
  tieBreakTimeLimitMs: number;
}

export interface RoundResolutionResult {
  roundSequence: number;
  wordIndex: number;
  isTieBreak: boolean;
  reason: RoundResolutionReason;
  winnerId: string | null;
  revealedWord: string;
  scores: Record<string, number>;
  gameStatus: GameStatus;
  tieBreakCandidates: string[] | null;
  finalWinnerIds: string[] | null;
}

export class Game {
  readonly scores = new Map<string, number>();
  phase: GamePhase = 'playing';
  tieBreakCandidates: string[] | null = null;
  winnerIds: string[] | null = null;

  private readonly words: Word[];
  private wordIndex = 0;
  private rounds: WordRound[];

  constructor(
    private readonly wordRepository: WordRepository,
    private readonly options: GameOptions,
  ) {
    this.words = Array.from({ length: options.wordCount }, () => wordRepository.getRandomWord());
    this.rounds = [new WordRound(this.words[0]!, options.maxAttempts, options.timeLimitMs)];
  }

  get currentRound(): WordRound {
    const round = this.rounds[this.rounds.length - 1];
    if (!round) throw new Error('No active round');
    return round;
  }

  get wordIndexNumber(): number {
    return this.wordIndex;
  }

  get roundSequenceNumber(): number {
    return this.rounds.length - 1;
  }

  submitGuess(playerId: string, nickname: string, guess: string): Attempt {
    if (this.phase === 'tie-break' && this.tieBreakCandidates && !this.tieBreakCandidates.includes(playerId)) {
      throw new InvalidGuessError('Apenas os jogadores empatados participam do desempate');
    }
    return this.currentRound.submitGuess(playerId, nickname, guess);
  }

  resolveCurrentRound(
    reason: RoundResolutionReason,
    winnerId: string | null,
    connectedPlayerIds: string[],
  ): RoundResolutionResult {
    const round = this.currentRound;
    round.resolve(reason, winnerId);

    if (reason === 'solved' && winnerId && this.phase === 'playing') {
      this.scores.set(winnerId, (this.scores.get(winnerId) ?? 0) + 1);
    }

    const baseResult = {
      roundSequence: this.roundSequenceNumber,
      wordIndex: this.wordIndex,
      isTieBreak: this.phase === 'tie-break',
      reason,
      winnerId,
      revealedWord: round.secretWord.value,
      scores: Object.fromEntries(this.scores),
    };

    if (this.phase === 'tie-break') {
      return this.advanceTieBreak(baseResult, reason, winnerId);
    }

    return this.advanceRegularRound(baseResult, connectedPlayerIds);
  }

  private advanceTieBreak(
    baseResult: Omit<RoundResolutionResult, 'gameStatus' | 'tieBreakCandidates' | 'finalWinnerIds'>,
    reason: RoundResolutionReason,
    winnerId: string | null,
  ): RoundResolutionResult {
    if (reason === 'solved' && winnerId) {
      this.phase = 'finished';
      this.winnerIds = [winnerId];
      return { ...baseResult, gameStatus: 'finished', tieBreakCandidates: this.tieBreakCandidates, finalWinnerIds: this.winnerIds };
    }

    const nextWord = this.wordRepository.getRandomWord();
    this.rounds.push(new WordRound(nextWord, this.options.tieBreakMaxAttempts, this.options.tieBreakTimeLimitMs));
    return { ...baseResult, gameStatus: 'continue', tieBreakCandidates: this.tieBreakCandidates, finalWinnerIds: null };
  }

  private advanceRegularRound(
    baseResult: Omit<RoundResolutionResult, 'gameStatus' | 'tieBreakCandidates' | 'finalWinnerIds'>,
    connectedPlayerIds: string[],
  ): RoundResolutionResult {
    this.wordIndex += 1;

    if (this.wordIndex < this.words.length) {
      const nextWord = this.words[this.wordIndex]!;
      this.rounds.push(new WordRound(nextWord, this.options.maxAttempts, this.options.timeLimitMs));
      return { ...baseResult, gameStatus: 'continue', tieBreakCandidates: null, finalWinnerIds: null };
    }

    const leaders = this.computeLeaders(connectedPlayerIds);

    if (leaders.length === 1) {
      this.phase = 'finished';
      this.winnerIds = leaders;
      return { ...baseResult, gameStatus: 'finished', tieBreakCandidates: null, finalWinnerIds: leaders };
    }

    this.phase = 'tie-break';
    this.tieBreakCandidates = leaders;
    const tieBreakWord = this.wordRepository.getRandomWord();
    this.rounds.push(new WordRound(tieBreakWord, this.options.tieBreakMaxAttempts, this.options.tieBreakTimeLimitMs));
    return { ...baseResult, gameStatus: 'tie-break-started', tieBreakCandidates: leaders, finalWinnerIds: null };
  }

  private computeLeaders(connectedPlayerIds: string[]): string[] {
    if (connectedPlayerIds.length === 0) return [];
    const maxScore = Math.max(...connectedPlayerIds.map((playerId) => this.scores.get(playerId) ?? 0));
    return connectedPlayerIds.filter((playerId) => (this.scores.get(playerId) ?? 0) === maxScore);
  }
}
