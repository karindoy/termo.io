import { useCallback, useEffect, useRef, useState } from 'react';

export type BannerType = 'success' | 'error' | 'warning' | 'info' | 'gold';

export interface ActiveBanner {
  message: string;
  type: BannerType;
  key: number;
}

export function useBanner(defaultDurationMs = 4500) {
  const [banner, setBanner] = useState<ActiveBanner | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(0);

  const clear = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setBanner(null);
  }, []);

  const show = useCallback((message: string, type: BannerType, durationMs?: number) => {
    const duration = durationMs ?? defaultDurationMs;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setBanner({ message, type, key: ++keyRef.current });
    if (duration > 0) {
      timerRef.current = setTimeout(() => setBanner(null), duration);
    }
  }, [defaultDurationMs]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { banner, show, clear };
}
