import { useCallback, useEffect, useState } from 'react';
import type { DailyGameMode, DailyModeConfig, DailyPuzzleResult } from '../lib/types';
import { DailyGuessError, getDailyConfig, submitDailyGuess } from '../lib/api';
import { getStoredDailyGuesses, storeDailyGuesses } from '../lib/daily-progress-storage';

export interface UseDailyGameResult {
  config: DailyModeConfig | null;
  guesses: string[];
  result: DailyPuzzleResult | null;
  loading: boolean;
  error: string | null;
  /** Bumps once per rejected guess, independent of message content, so the active row can
   * shake even if the same invalid word is retried twice in a row. */
  rejectedToken: number;
  submitGuess: (guess: string) => Promise<void>;
}

/** No sockets, no room/session — just HTTP against the stateless /daily/:mode endpoints.
 * The guess history itself is the only client-held state; a refresh resumes by replaying
 * whatever's in localStorage (see lib/daily-progress-storage.ts) against the server. */
export function useDailyGame(mode: DailyGameMode): UseDailyGameResult {
  const [config, setConfig] = useState<DailyModeConfig | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [result, setResult] = useState<DailyPuzzleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectedToken, setRejectedToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setConfig(null);
    setResult(null);
    setError(null);

    getDailyConfig(mode).then((value) => {
      if (!cancelled) setConfig(value);
    }).catch(() => {
      if (!cancelled) setError('Não foi possível carregar o modo do dia');
    });

    const stored = getStoredDailyGuesses(mode);
    setGuesses(stored);
    if (stored.length > 0) {
      setLoading(true);
      submitDailyGuess(mode, stored)
        .then((value) => {
          if (!cancelled) setResult(value);
        })
        .catch(() => {
          if (!cancelled) setError('Não foi possível carregar seu progresso de hoje');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [mode]);

  const submitGuess = useCallback(
    async (guess: string) => {
      setError(null);
      const nextGuesses = [...guesses, guess.toUpperCase()];
      setLoading(true);
      try {
        const next = await submitDailyGuess(mode, nextGuesses);
        setGuesses(nextGuesses);
        storeDailyGuesses(mode, nextGuesses);
        setResult(next);
      } catch (err) {
        setError(err instanceof DailyGuessError ? err.message : 'Não foi possível enviar a tentativa');
        setRejectedToken((token) => token + 1);
      } finally {
        setLoading(false);
      }
    },
    [guesses, mode],
  );

  return { config, guesses, result, loading, error, rejectedToken, submitGuess };
}
