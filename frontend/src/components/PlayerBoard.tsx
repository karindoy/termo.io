import type { Attempt } from '../lib/types';
import { WordGrid } from './WordGrid';

interface PlayerBoardProps {
  nickname: string;
  wordLength: number;
  attempts: Attempt[];
}

export function PlayerBoard({ nickname, wordLength, attempts }: PlayerBoardProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <strong style={{ color: 'var(--color-text-muted)' }}>{nickname}</strong>
      <WordGrid wordLength={wordLength} attempts={attempts} />
    </div>
  );
}
