import type { DailyBoardResult, DailyGameMode } from './types';

const SQUARE_BY_STATUS = { correct: '🟩', present: '🟨', absent: '⬛' } as const;

export function buildDailyShareText(
  boards: DailyBoardResult[],
): string {

  const rowCount = Math.max(...boards.map((board) => board.attempts.length), 0);
  const grids = boards.map((board) =>
    board.attempts.map((attempt) => attempt.feedback.map((letter) => SQUARE_BY_STATUS[letter.status]).join('')),
  );

  const lines: string[] = [];
  for (let row = 0; row < rowCount; row++) {
    lines.push(grids.map((grid) => grid[row] ?? '').join('  ').trimEnd());
  }

  return [...lines].join('\n');
}
