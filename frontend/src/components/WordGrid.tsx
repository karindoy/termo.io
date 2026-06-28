import type { Attempt, LetterStatus } from '../lib/types';

const STATUS_COLOR: Record<LetterStatus, string> = {
  correct: '#538d4e',
  present: '#b59f3b',
  absent: '#3a3a3c',
};

interface WordGridProps {
  wordLength: number;
  attempts: Attempt[];
  activeGuess?: string;
}

export function WordGrid({ wordLength, attempts, activeGuess }: WordGridProps) {
  const rows = activeGuess !== undefined ? [...attempts, null] : attempts;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.map((attempt, rowIndex) => (
        <div key={rowIndex} style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: wordLength }).map((_, columnIndex) => {
            if (attempt) {
              const letterFeedback = attempt.feedback[columnIndex];
              return (
                <LetterBox
                  key={columnIndex}
                  letter={letterFeedback?.letter ?? ''}
                  background={letterFeedback ? STATUS_COLOR[letterFeedback.status] : undefined}
                />
              );
            }
            return <LetterBox key={columnIndex} letter={activeGuess?.[columnIndex] ?? ''} />;
          })}
        </div>
      ))}
    </div>
  );
}

function LetterBox({ letter, background }: { letter: string; background?: string }) {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px solid #3a3a3c',
        backgroundColor: background ?? 'transparent',
        color: '#fff',
        fontWeight: 700,
        textTransform: 'uppercase',
      }}
    >
      {letter}
    </div>
  );
}
