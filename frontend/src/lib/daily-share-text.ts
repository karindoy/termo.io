import type { DailyBoardResult, DailyGameMode } from './types';
import { currentPuzzleDate } from './puzzle-date';

const MODE_LABEL: Record<DailyGameMode, string> = {
  termo: 'Termo',
  dueto: 'Dueto',
  quarteto: 'Quarteto',
};

const SQUARE_BY_STATUS = { correct: '🟩', present: '🟨', absent: '⬛' } as const;

export function buildDailyShareText(
  mode: DailyGameMode,
  boards: DailyBoardResult[],
  attemptsUsed: number,
  maxAttempts: number,
  won: boolean,
): string {
  const scoreLine = won ? `${attemptsUsed}/${maxAttempts}` : `X/${maxAttempts}`;
  const header = `termo.io — ${MODE_LABEL[mode]} — ${currentPuzzleDate()} — ${scoreLine}`;

  const rowCount = Math.max(...boards.map((board) => board.attempts.length), 0);
  const grids = boards.map((board) =>
    board.attempts.map((attempt) => attempt.feedback.map((letter) => SQUARE_BY_STATUS[letter.status]).join('')),
  );

  const lines: string[] = [];
  for (let row = 0; row < rowCount; row++) {
    lines.push(grids.map((grid) => grid[row] ?? '').join('  ').trimEnd());
  }

  return [header, '', ...lines].join('\n');
}
