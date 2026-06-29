import type { Attempt, LetterStatus } from '../lib/types';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

const STATUS_CLASS: Record<LetterStatus, string> = {
  correct: 'key-correct',
  present: 'key-present',
  absent: 'key-absent',
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
    <div className="keyboard">
      {ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="keyboard-row">
          {row.split('').map((letter) => {
            const status = letterStatus[letter];
            return (
              <button
                key={letter}
                onClick={() => onLetter(letter)}
                className={['key', status ? STATUS_CLASS[status] : ''].join(' ').trim()}
              >
                {letter}
              </button>
            );
          })}
        </div>
      ))}
      <div className="keyboard-row">
        <button onClick={onEnter} className="key key-wide">
          Enviar
        </button>
        <button onClick={onBackspace} className="key key-wide">
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
