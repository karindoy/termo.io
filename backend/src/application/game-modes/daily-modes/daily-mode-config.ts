export type DailyGameMode = 'termo' | 'dueto' | 'quarteto';

export interface DailyModeConfig {
  wordCount: number;
  maxAttempts: number;
}

// The three daily games are the same mechanic parameterized differently: Termo is the
// classic single-board Wordle-style daily, Dueto/Quarteto add more simultaneous boards
// under one shared attempt budget (see domain/entities/daily-puzzle.ts).
export const DAILY_MODE_CONFIG: Record<DailyGameMode, DailyModeConfig> = {
  termo: { wordCount: 1, maxAttempts: 6 },
  dueto: { wordCount: 2, maxAttempts: 7 },
  quarteto: { wordCount: 4, maxAttempts: 9 },
};

export const DAILY_GAME_MODES = Object.keys(DAILY_MODE_CONFIG) as DailyGameMode[];

export function isDailyGameMode(value: string): value is DailyGameMode {
  return (DAILY_GAME_MODES as string[]).includes(value);
}
