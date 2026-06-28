export type RoomMode = 'round' | 'fast';
export type RoomStatus = 'lobby' | 'in-progress' | 'finished';

export interface RoomPlayer {
  playerId: string;
  nickname: string;
}

export interface RoomSettings {
  wordCount: number;
  maxAttempts: number;
  timeLimitMs: number;
}

export interface RoomRecord {
  code: string;
  mode: RoomMode;
  hostId: string;
  createdAt: number;
  isPublic: boolean;
  settings: RoomSettings;
  status: RoomStatus;
  players: RoomPlayer[];
}

// The public room browser is unauthenticated, so the backend redacts playerId
// from each player here — it's a seat identifier other code treats as an
// implicit credential, and an unauthenticated listing has no business handing it out.
export interface PublicRoomPlayer {
  nickname: string;
}

export type RoomSummary = Pick<RoomRecord, 'code' | 'mode' | 'isPublic' | 'settings' | 'status'> & {
  players: PublicRoomPlayer[];
};

export interface HostMigratedPayload {
  code: string;
  hostId: string;
}

export interface RoomSessionPayload {
  sessionSecret: string;
}

export type LetterStatus = 'correct' | 'present' | 'absent';

export interface LetterFeedback {
  letter: string;
  status: LetterStatus;
}

export type GuessFeedback = LetterFeedback[];

export interface Attempt {
  playerId: string;
  nickname: string;
  guess: string;
  feedback: GuessFeedback;
  attemptNumber: number;
  createdAt: number;
}

export interface Player {
  playerId: string;
  nickname: string;
}

export type GamePhase = 'playing' | 'tie-break' | 'finished';
export type RoundResolutionReason = 'solved' | 'timeout' | 'exhausted';
export type GameStatus = 'continue' | 'tie-break-started' | 'finished';

export interface RoundSnapshot {
  roundSequence: number;
  wordIndex: number;
  wordCount: number;
  wordLength: number;
  maxAttempts: number;
  timeLimitMs: number;
  roundStartedAt: number;
  phase: GamePhase;
  tieBreakCandidates: string[] | null;
}

export interface RoomState extends RoundSnapshot {
  players: Player[];
  scores: Record<string, number>;
  attempts: Attempt[];
  solvedBy: string | null;
}

export interface GuessResult {
  attempt: Attempt;
  solved: boolean;
  winnerId: string | null;
  roundSequence: number;
}

export interface WordResolvedPayload {
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

export interface TieBreakStartedPayload extends RoundSnapshot {
  candidateIds: string[];
}

export interface GameFinishedPayload {
  winnerIds: string[];
  scores: Record<string, number>;
}

export type FastResolutionReason = 'solved' | 'timeout';

export interface RaceConfigSnapshot {
  wordCount: number;
  wordLength: number;
  timeLimitMs: number;
}

export interface PlayerProgressSnapshot {
  playerId: string;
  wordIndex: number;
  roundStartedAt: number;
  finished: boolean;
  won: boolean;
}

export interface PlayerRoundSnapshot {
  playerId: string;
  wordIndex: number;
  roundStartedAt: number;
  finished: boolean;
}

export interface RaceRoomState extends RaceConfigSnapshot {
  players: Player[];
  progress: PlayerProgressSnapshot[];
  attemptsByPlayer: Record<string, Attempt[]>;
  phase: 'playing' | 'finished';
  winnerId: string | null;
}

export interface PlayerWordResolvedPayload {
  playerId: string;
  wordIndex: number;
  reason: FastResolutionReason;
  revealedWord: string;
  hasNextWord: boolean;
  playerFinished: boolean;
  playerWon: boolean;
  gameFinished: boolean;
  winnerId: string | null;
}

export interface RaceFinishedPayload {
  winnerId: string | null;
}

export interface FastGuessResult {
  attempt: Attempt;
  solved: boolean;
  winnerId: string | null;
  wordIndex: number;
}
