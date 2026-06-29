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
  activeGuess?: string;
}

export function WordGrid({ wordLength, attempts, activeGuess }: WordGridProps) {
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

  const rows = activeGuess !== undefined ? [...attempts, null] : attempts;

  return (
    <div className="word-grid">
      {rows.map((attempt, rowIndex) => (
        <div key={rowIndex} className="word-row">
          {Array.from({ length: wordLength }).map((_, columnIndex) => {
            if (attempt) {
              const letterFeedback = attempt.feedback[columnIndex];
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
            }
            const letter = activeGuess?.[columnIndex] ?? '';
            const isLastTyped = letter !== '' && columnIndex === (activeGuess?.length ?? 0) - 1;
            return <Tile key={columnIndex} letter={letter} isTyping={isLastTyped} />;
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
  delay,
}: {
  letter: string;
  status?: LetterStatus;
  isFlipping?: boolean;
  isTyping?: boolean;
  delay?: number;
}) {
  const classNames = ['tile'];
  if (letter && !isFlipping) classNames.push('tile-filled');
  if (status && !isFlipping) classNames.push(STATUS_CLASS[status]);
  if (isFlipping) classNames.push('tile-flip');
  if (isTyping) classNames.push('tile-pop');

  return (
    <div
      className={classNames.join(' ')}
      style={
        isFlipping && status
          ? ({ animationDelay: `${delay}ms`, '--tile-color': STATUS_COLOR[status] } as React.CSSProperties)
          : undefined
      }
    >
      {letter}
    </div>
  );
}
