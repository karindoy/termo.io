import type { DailyGameMode } from './types';
import { currentPuzzleDate } from './puzzle-date';

const PREFIX = 'termo_daily_stats';

export interface DailyStats {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  bestStreak: number;
  /** attemptsUsed -> number of wins finished in exactly that many attempts. */
  distribution: Record<number, number>;
  losses: number;
  lastRecordedDate: string | null;
}

function statsKey(mode: DailyGameMode): string {
  return `${PREFIX}:${mode}`;
}

function emptyStats(): DailyStats {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    bestStreak: 0,
    distribution: {},
    losses: 0,
    lastRecordedDate: null,
  };
}

export function getDailyStats(mode: DailyGameMode): DailyStats {
  const raw = localStorage.getItem(statsKey(mode));
  if (!raw) return emptyStats();
  try {
    const parsed = JSON.parse(raw) as Partial<DailyStats>;
    return { ...emptyStats(), ...parsed, distribution: parsed.distribution ?? {} };
  } catch {
    return emptyStats();
  }
}

/** Records the outcome of today's puzzle exactly once per calendar day — guarded by
 * lastRecordedDate so replaying stored guesses against the server on refresh (see
 * useDailyGame) never double-counts a finished game. */
export function recordDailyResult(mode: DailyGameMode, won: boolean, attemptsUsed: number): DailyStats {
  const stats = getDailyStats(mode);
  const today = currentPuzzleDate();
  if (stats.lastRecordedDate === today) return stats;

  const nextStreak = won ? stats.currentStreak + 1 : 0;
  const next: DailyStats = {
    gamesPlayed: stats.gamesPlayed + 1,
    gamesWon: won ? stats.gamesWon + 1 : stats.gamesWon,
    currentStreak: nextStreak,
    bestStreak: Math.max(stats.bestStreak, nextStreak),
    distribution: won
      ? { ...stats.distribution, [attemptsUsed]: (stats.distribution[attemptsUsed] ?? 0) + 1 }
      : stats.distribution,
    losses: won ? stats.losses : stats.losses + 1,
    lastRecordedDate: today,
  };
  localStorage.setItem(statsKey(mode), JSON.stringify(next));
  return next;
}
