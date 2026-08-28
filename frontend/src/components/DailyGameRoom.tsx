import { useEffect, useState } from 'react';
import { useDailyGame } from '../hooks/useDailyGame';
import { useGuessInput } from '../hooks/useGuessInput';
import { useBanner } from '../hooks/useBanner';
import { WordGrid } from './WordGrid';
import { Keyboard } from './Keyboard';
import { BannerSlot } from './BannerSlot';
import { DailyStatsModal } from './DailyStatsModal';
import { buildDailyShareText } from '../lib/daily-share-text';
import type { DailyGameMode } from '../lib/types';

const WORD_LENGTH = 5;

export function DailyGameRoom({
  mode,
  onBack,
}: {
  mode: DailyGameMode;
  onBack: () => void;
}) {
  const { config, guesses, result, stats, loading, error, rejectedToken, submitGuess } = useDailyGame(mode);
  const { banner, show: showBanner } = useBanner();

  const finished = result?.finished ?? false;
  const canGuess = !finished && !loading && config != null;
  const guessInput = useGuessInput(WORD_LENGTH, canGuess, guesses.length);

  const [statsOpen, setStatsOpen] = useState(false);
  useEffect(() => {
    if (finished) setStatsOpen(true);
  }, [finished]);

  function handleShare(): void {
    if (!result) return;
    const text = buildDailyShareText(result.boards);
    navigator.clipboard
      .writeText(text)
      .then(() => showBanner('Resultado copiado!', 'success'))
      .catch(() => showBanner('Não foi possível copiar o resultado', 'error'));
  }

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

  const fallbackBanner = error ? { message: error, type: 'error' as const } : null;

  return (
    <div id="daily-game-room" className="app-shell app-shell-with-mode-bar">
      <header id="daily-game-header" className="app-header">
        <div id="daily-game-status-pill" className="status-pill">
          <span>
            Tentativas: {guesses.length}/{maxAttempts}
          </span>
          {finished && (
            <button className="btn btn-ghost btn-sm" onClick={() => setStatsOpen(true)}>
              Progresso
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            Voltar
          </button>
        </div>
      </header>

      <main id="daily-game-main" className="app-main app-main-with-keyboard">
        <BannerSlot id="daily-game-banner-slot" banner={banner} fallback={fallbackBanner} />

        <div id="daily-game-boards" className="daily-boards" data-count={boards.length}>
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

      {statsOpen && stats && (
        <DailyStatsModal
          stats={stats}
          maxAttempts={maxAttempts}
          onDismiss={() => setStatsOpen(false)}
          onShare={handleShare}
        />
      )}
    </div>
  );
}
