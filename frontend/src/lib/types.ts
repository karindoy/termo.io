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

export interface RoomState {
  wordLength: number;
  players: Player[];
  attempts: Attempt[];
  solvedBy: string | null;
}

export interface GuessResult {
  attempt: Attempt;
  solved: boolean;
  winnerId: string | null;
}
