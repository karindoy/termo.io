import { useEffect, useRef, useState } from 'react';
import type { Attempt, LetterStatus } from '../lib/types';

const STATUS_CLASS: Record<LetterStatus, string> = {
  correct: 'tile-correct',
  present: 'tile-present',
  absent: 'tile-absent',
};

const STATUS_COLOR: Record<LetterStatus, string> = {
  correct: '#16a34a',
  present: '#eab308',
  absent: '#334155',
};

interface WordGridProps {
  wordLength: number;
  attempts: Attempt[];
  /** Fixed-length array, one entry per cell ('' = empty), for the in-progress row. */
  activeGuess?: string[];
  /** Index of the cell the player is currently editing, within the active row. */
  activeCursor?: number;
  /** Index of the cell most recently written/cleared, for the "just typed" pop animation. */
  activeLastEdited?: number | null;
  /** Lets the player click/tap a cell in the active row to move the cursor there. */
  onActiveCellClick?: (index: number) => void;
  /** Pre-render at least this many rows to prevent layout shifts. */
  totalRows?: number;
}

export function WordGrid({
  wordLength,
  attempts,
  activeGuess,
  activeCursor,
  activeLastEdited,
  onActiveCellClick,
  totalRows,
}: WordGridProps) {
  const [revealedCount, setRevealedCount] = useState(attempts.length);
  const previousLength = useRef(attempts.length);

  useEffect(() => {
    if (attempts.length > previousLength.current) {
      setRevealedCount(previousLength.current);
      const timeout = setTimeout(() => setRevealedCount(attempts.length), 450);
      previousLength.current = attempts.length;
      return () => clearTimeout(timeout);
    }
    previousLength.current = attempts.length;
  }, [attempts.length]);

  // 'null' = active input row, undefined = empty pre-rendered placeholder
  const rows: (Attempt | null | undefined)[] = [...attempts];
  if (activeGuess !== undefined) rows.push(null);
  const targetLength = Math.max(rows.length, totalRows ?? 0);
  while (rows.length < targetLength) rows.push(undefined);

  return (
    <div className="word-grid">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="word-row">
          {Array.from({ length: wordLength }).map((_, columnIndex) => {
            if (row === undefined) {
              return <Tile key={columnIndex} letter="" />;
            }
            if (row === null) {
              const letter = activeGuess?.[columnIndex] ?? '';
              return (
                <Tile
                  key={columnIndex}
                  letter={letter}
                  isTyping={activeLastEdited === columnIndex}
                  isCursor={activeCursor === columnIndex}
                  onClick={onActiveCellClick ? () => onActiveCellClick(columnIndex) : undefined}
                />
              );
            }
            const letterFeedback = row.feedback[columnIndex];
            const isFlipping = rowIndex >= revealedCount;
            return (
              <Tile
                key={columnIndex}
                letter={letterFeedback?.letter ?? ''}
                status={letterFeedback?.status}
                isFlipping={isFlipping}
                delay={columnIndex * 80}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Tile({
  letter,
  status,
  isFlipping,
  isTyping,
  isCursor,
  delay,
  onClick,
}: {
  letter: string;
  status?: LetterStatus;
  isFlipping?: boolean;
  isTyping?: boolean;
  isCursor?: boolean;
  delay?: number;
  onClick?: () => void;
}) {
  const classNames = ['tile'];
  if (letter && !isFlipping) classNames.push('tile-filled');
  if (status && !isFlipping) classNames.push(STATUS_CLASS[status]);
  if (isFlipping) classNames.push('tile-flip');
  if (isTyping) classNames.push('tile-pop');
  if (isCursor) classNames.push('tile-cursor');
  if (onClick) classNames.push('tile-clickable');

  return (
    <div
      className={classNames.join(' ')}
      style={
        isFlipping && status
          ? ({ animationDelay: `${delay}ms`, '--tile-color': STATUS_COLOR[status] } as React.CSSProperties)
          : undefined
      }
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {letter}
    </div>
  );
}
