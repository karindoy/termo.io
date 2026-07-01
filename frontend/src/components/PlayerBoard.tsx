import type { Attempt } from '../lib/types';
import { WordGrid } from './WordGrid';

interface PlayerBoardProps {
  nickname: string;
  wordLength: number;
  attempts: Attempt[];
  totalRows?: number;
  correctWords?: number;
  wrongWords?: number;
}

export function PlayerBoard({ nickname, wordLength, attempts, totalRows, correctWords, wrongWords }: PlayerBoardProps) {
  const slug = nickname.toLowerCase().replace(/\W+/g, '-');
  return (
    <div id={`player-board-${slug}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <strong style={{ color: 'var(--color-text-muted)' }}>{nickname}</strong>
      <WordGrid
        gridId={`player-grid-${slug}`}
        wordLength={wordLength}
        attempts={attempts}
        totalRows={totalRows}
        correctWords={correctWords}
        wrongWords={wrongWords}
      />
    </div>
  );
}
