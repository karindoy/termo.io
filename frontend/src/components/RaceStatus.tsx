import { useEffect, useState } from 'react';
import type { PlayerProgressSnapshot, RaceConfigSnapshot } from '../lib/types';

interface RaceStatusProps {
  config: RaceConfigSnapshot;
  progress: PlayerProgressSnapshot;
  myAttemptsCount: number;
}

export function RaceStatus({ config, progress, myAttemptsCount }: RaceStatusProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = Math.max(0, progress.roundStartedAt + config.timeLimitMs - now);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <span>
        Palavra {Math.min(progress.wordIndex + 1, config.wordCount)} de {config.wordCount}
      </span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        ⏱ {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
      <span>Tentativas: {myAttemptsCount} (ilimitadas)</span>
    </div>
  );
}
