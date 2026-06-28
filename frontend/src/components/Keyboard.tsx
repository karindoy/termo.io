import type { Attempt, LetterStatus } from '../lib/types';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

const STATUS_COLOR: Record<LetterStatus, string> = {
  correct: '#538d4e',
  present: '#b59f3b',
  absent: '#3a3a3c',
};

const STATUS_PRIORITY: Record<LetterStatus, number> = {
  correct: 3,
  present: 2,
  absent: 1,
};

interface KeyboardProps {
  attempts: Attempt[];
  onLetter: (letter: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
}

export function Keyboard({ attempts, onLetter, onEnter, onBackspace }: KeyboardProps) {
  const letterStatus = buildLetterStatusMap(attempts);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
      {ROWS.map((row, rowIndex) => (
        <div key={rowIndex} style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          {row.split('').map((letter) => (
            <button
              key={letter}
              onClick={() => onLetter(letter)}
              style={{
                minWidth: 32,
                height: 42,
                backgroundColor: letterStatus[letter] ? STATUS_COLOR[letterStatus[letter]!] : '#818384',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {letter}
            </button>
          ))}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
        <button onClick={onEnter} style={{ height: 42, padding: '0 16px' }}>
          Enviar
        </button>
        <button onClick={onBackspace} style={{ height: 42, padding: '0 16px' }}>
          ⌫
        </button>
      </div>
    </div>
  );
}

function buildLetterStatusMap(attempts: Attempt[]): Record<string, LetterStatus | undefined> {
  const map: Record<string, LetterStatus | undefined> = {};
  for (const attempt of attempts) {
    for (const letterFeedback of attempt.feedback) {
      const current = map[letterFeedback.letter];
      if (!current || STATUS_PRIORITY[letterFeedback.status] > STATUS_PRIORITY[current]) {
        map[letterFeedback.letter] = letterFeedback.status;
      }
    }
  }
  return map;
}
