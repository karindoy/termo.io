import { useEffect } from 'react';
import { useDailyGame } from '../hooks/useDailyGame';
import { useGuessInput } from '../hooks/useGuessInput';
import { WordGrid } from './WordGrid';
import { Keyboard } from './Keyboard';
import { BannerSlot } from './BannerSlot';
import type { DailyGameMode } from '../lib/types';

const WORD_LENGTH = 5;

const MODE_LABEL: Record<DailyGameMode, string> = {
  termo: 'Termo',
  dueto: 'Dueto',
  quarteto: 'Quarteto',
};

export function DailyGameRoom({ mode, onBack }: { mode: DailyGameMode; onBack: () => void }) {
  const { config, guesses, result, loading, error, rejectedToken, submitGuess } = useDailyGame(mode);

  const finished = result?.finished ?? false;
  const canGuess = !finished && !loading && config != null;
  const guessInput = useGuessInput(WORD_LENGTH, canGuess, guesses.length);

  function handleEnter(): void {
    if (!canGuess || !guessInput.isComplete) return;
    submitGuess(guessInput.guess);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Enter') {
        handleEnter();
      } else if (event.key === 'Backspace') {
        guessInput.backspace();
      } else if (event.key === 'ArrowLeft') {
        guessInput.moveCursor(-1);
      } else if (event.key === 'ArrowRight') {
        guessInput.moveCursor(1);
      } else if (/^[a-zA-Z]$/.test(event.key)) {
        guessInput.typeLetter(event.key.toUpperCase());
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const wordCount = config?.wordCount ?? result?.boards.length ?? 1;
  const maxAttempts = config?.maxAttempts ?? result?.maxAttempts ?? 6;
  const boards = result?.boards ?? Array.from({ length: wordCount }, () => ({ attempts: [], solved: false, revealedWord: null }));

  const allAttempts = boards.flatMap((board) => board.attempts.map((attempt) => ({ feedback: attempt.feedback })));

  const fallbackBanner = finished
    ? result?.won
      ? { message: '🎉 Você acertou todas as palavras de hoje!', type: 'success' as const }
      : { message: `❌ Suas tentativas acabaram. Volte amanhã para um novo desafio!`, type: 'warning' as const }
    : error
      ? { message: error, type: 'error' as const }
      : null;

  return (
    <div id="daily-game-room" className="app-shell">
      <header id="daily-game-header" className="app-header">
        <h1>termo.io — {MODE_LABEL[mode]}</h1>
        <div id="daily-game-status-pill" className="status-pill">
          <span>
            Tentativas: {guesses.length}/{maxAttempts}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            Voltar
          </button>
        </div>
      </header>

      <main id="daily-game-main" className="app-main app-main-with-keyboard">
        <BannerSlot id="daily-game-banner-slot" banner={null} fallback={fallbackBanner} />

        <div id="daily-game-boards" className="daily-boards">
          {boards.map((board, index) => (
            <WordGrid
              key={index}
              gridId={`daily-board-${index}`}
              wordLength={WORD_LENGTH}
              attempts={board.attempts.map((attempt) => ({ feedback: attempt.feedback }))}
              activeGuess={canGuess && !board.solved ? guessInput.letters : undefined}
              activeCursor={canGuess && !board.solved ? guessInput.cursor : undefined}
              activeLastEdited={canGuess && !board.solved ? guessInput.lastEdited : undefined}
              onActiveCellClick={canGuess && !board.solved ? guessInput.setCursor : undefined}
              activeRowShakeToken={rejectedToken}
              totalRows={maxAttempts}
            />
          ))}
        </div>
      </main>

      <div id="daily-game-keyboard-footer" className="keyboard-footer">
        <Keyboard
          attempts={allAttempts}
          onLetter={guessInput.typeLetter}
          onEnter={handleEnter}
          onBackspace={guessInput.backspace}
          disabled={!canGuess}
        />
      </div>
    </div>
  );
}
