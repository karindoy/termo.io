import type { DailyGameMode } from './types';
import { currentPuzzleDate } from './puzzle-date';

const PREFIX = 'termo_daily_progress';

function storageKey(mode: DailyGameMode): string {
  return `${PREFIX}:${mode}:${currentPuzzleDate()}`;
}

// Daily-game progress is client-local only (no per-player server-side history) — keyed by
// mode + calendar date, so yesterday's guesses never leak into today's puzzle.
export function getStoredDailyGuesses(mode: DailyGameMode): string[] {
  const raw = localStorage.getItem(storageKey(mode));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

export function storeDailyGuesses(mode: DailyGameMode, guesses: string[]): void {
  localStorage.setItem(storageKey(mode), JSON.stringify(guesses));
}
