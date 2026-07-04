const PUZZLE_TIMEZONE = 'America/Sao_Paulo';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PUZZLE_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Mirrors the backend's currentPuzzleDate (same fixed timezone) — used only as a
 * localStorage cache key, never trusted as the source of truth for which word it is. */
export function currentPuzzleDate(now: Date = new Date()): string {
  return formatter.format(now);
}
