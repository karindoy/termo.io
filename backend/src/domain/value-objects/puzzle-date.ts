const PUZZLE_TIMEZONE = 'America/Sao_Paulo';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PUZZLE_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Calendar date (YYYY-MM-DD) in a fixed timezone, so the daily puzzle rolls over at the
 * same instant for every player regardless of where they are. */
export function currentPuzzleDate(now: Date = new Date()): string {
  return formatter.format(now);
}
