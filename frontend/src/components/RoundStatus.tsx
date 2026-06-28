import { useEffect, useState } from 'react';
import type { RoundSnapshot } from '../lib/types';

interface RoundStatusProps {
  round: RoundSnapshot;
  myAttemptsCount: number;
}

export function RoundStatus({ round, myAttemptsCount }: RoundStatusProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = Math.max(0, round.roundStartedAt + round.timeLimitMs - now);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <span>
        {round.phase === 'tie-break' ? 'Desempate' : `Palavra ${round.wordIndex + 1} de ${round.wordCount}`}
      </span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        ⏱ {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
      <span>
        Tentativas: {myAttemptsCount}/{round.maxAttempts}
      </span>
    </div>
  );
}
