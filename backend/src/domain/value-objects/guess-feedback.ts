export type LetterStatus = 'correct' | 'present' | 'absent';

export interface LetterFeedback {
  letter: string;
  status: LetterStatus;
}

export type GuessFeedback = LetterFeedback[];

export function isSolved(feedback: GuessFeedback): boolean {
  return feedback.every((letter) => letter.status === 'correct');
}
