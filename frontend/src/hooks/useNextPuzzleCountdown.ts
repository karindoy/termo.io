import { useEffect, useState } from 'react';

const PUZZLE_TIMEZONE = 'America/Sao_Paulo';

function msUntilNextPuzzle(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PUZZLE_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  // Some ICU implementations report midnight as "24" under hour12: false.
  const hours = get('hour') % 24;
  const elapsedMs = ((hours * 60 + get('minute')) * 60 + get('second')) * 1000;
  return 24 * 60 * 60 * 1000 - elapsedMs;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(totalSeconds / 3600))}:${pad(Math.floor((totalSeconds % 3600) / 60))}:${pad(totalSeconds % 60)}`;
}

/** Countdown to the next daily puzzle rollover, formatted HH:MM:SS in the puzzle timezone. */
export function useNextPuzzleCountdown(): string {
  const [remainingMs, setRemainingMs] = useState(() => msUntilNextPuzzle(new Date()));

  useEffect(() => {
    const interval = setInterval(() => setRemainingMs(msUntilNextPuzzle(new Date())), 1000);
    return () => clearInterval(interval);
  }, []);

  return formatCountdown(remainingMs);
}
