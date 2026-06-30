import { useEffect, useMemo, useState } from 'react';
import { useGame } from './hooks/useGame';
import { useRaceGame } from './hooks/useRaceGame';
import { useGuessInput } from './hooks/useGuessInput';
import { WordGrid } from './components/WordGrid';
import { Keyboard } from './components/Keyboard';
import { PlayerBoard } from './components/PlayerBoard';
import { ScoreBoard } from './components/ScoreBoard';
import { RoundStatus } from './components/RoundStatus';
import { WordRevealBanner } from './components/WordRevealBanner';
import { RaceStatus } from './components/RaceStatus';
import { RaceLeaderboard } from './components/RaceLeaderboard';
import { RaceSummary } from './components/RaceSummary';
import { Lobby } from './components/Lobby';
import { PublicRoomBrowser } from './components/PublicRoomBrowser';
import { getOrCreatePlayerId, getStoredNickname, storeNickname } from './lib/player-identity';
import { createRoom, getRoom, RoomLookupError } from './lib/api';
import type { RoomMode, RoomRecord } from './lib/types';

const playerId = getOrCreatePlayerId();

export function App() {
  const [nickname, setNickname] = useState<string | null>(getStoredNickname());
  const [room, setRoom] = useState<RoomRecord | null>(null);

  if (!nickname) {
    return <NicknameForm onSubmit={(value) => { storeNickname(value); setNickname(value); }} />;
  }

  if (!room) {
    return <RoomChoiceScreen nickname={nickname} onRoomReady={setRoom} />;
  }

  if (room.status === 'lobby') {
    return (
      <Lobby room={room} playerId={playerId} nickname={nickname} onGameStart={setRoom} onBack={() => setRoom(null)} />
    );
  }

  if (room.mode === 'championship') {
    return <ChampionshipGameRoom code={room.code} playerId={playerId} nickname={nickname} isHost={room.hostId === playerId} onBack={() => setRoom(null)} />;
  }

  return <RaceGameRoom code={room.code} playerId={playerId} nickname={nickname} isHost={room.hostId === playerId} onBack={() => setRoom(null)} />;
}

function NicknameForm({ onSubmit }: { onSubmit: (nickname: string) => void }) {
  const [value, setValue] = useState('');

  return (
    <div id="nickname-form" className="centered-shell">
      <h1>termo.io</h1>
      <div id="nickname-card" className="card">
        <input
          className="input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Escolha seu apelido"
          maxLength={24}
        />
        <button className="btn btn-primary" disabled={value.trim().length === 0} onClick={() => onSubmit(value.trim())}>
          Entrar
        </button>
      </div>
    </div>
  );
}

function RoomChoiceScreen({
  nickname,
  onRoomReady,
}: {
  nickname: string;
  onRoomReady: (room: RoomRecord) => void;
}) {
  const [mode, setMode] = useState<RoomMode>('championship');
  const [isPublic, setIsPublic] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const room = await createRoom({ hostId: playerId, nickname, mode, isPublic });
      onRoomReady(room);
    } catch (err) {
      setError(err instanceof RoomLookupError ? err.message : 'Não foi possível criar a sala');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinByCode(code: string): Promise<void> {
    if (code.trim().length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const room = await getRoom(code.trim().toUpperCase());
      onRoomReady(room);
    } catch (err) {
      setError(err instanceof RoomLookupError ? err.message : 'Não foi possível entrar na sala');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id="room-choice-screen" className="centered-shell" style={{ maxWidth: 420 }}>
      <h1>termo.io</h1>

      <section id="create-room-section" className="card">
        <h2>Criar uma sala</h2>
        <select className="input" value={mode} onChange={(event) => setMode(event.target.value as RoomMode)}>
          <option value="championship">Campeonato</option>
          <option value="race">Corrida</option>
        </select>
        <label className="checkbox-field">
          <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />
          Sala pública (aparece na lista de salas)
        </label>
        <button className="btn btn-primary" disabled={loading} onClick={handleCreate}>
          Criar sala
        </button>
      </section>

      <section id="join-room-section" className="card">
        <h2>Entrar com código</h2>
        <input
          className="input"
          value={joinCode}
          onChange={(event) => setJoinCode(event.target.value)}
          placeholder="Código da sala"
          maxLength={8}
        />
        <button className="btn" disabled={loading} onClick={() => handleJoinByCode(joinCode)}>
          Entrar
        </button>
      </section>

      <PublicRoomBrowser onJoin={(code) => handleJoinByCode(code)} />

      {error && <p className="banner banner-error">{error}</p>}
    </div>
  );
}

const RESTART_COUNTDOWN_SECS = 15;

function ChampionshipGameRoom({
  code,
  playerId,
  nickname,
  isHost,
  onBack,
}: {
  code: string;
  playerId: string;
  nickname: string;
  isHost: boolean;
  onBack: () => void;
}) {
  const { connected, players, scores, attempts, solvedBy, round, reveal, finished, error, extraAttempts, submitGuess, restartGame } = useGame(
    code,
    playerId,
    nickname,
  );
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!finished) {
      setCountdown(null);
      return;
    }
    setCountdown(RESTART_COUNTDOWN_SECS);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          if (isHost) restartGame();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [finished]);

  const wordLength = round?.wordLength ?? 5;
  const myAttempts = useMemo(() => attempts.filter((attempt) => attempt.playerId === playerId), [attempts, playerId]);
  const otherPlayers = useMemo(() => players.filter((player) => player.playerId !== playerId), [players, playerId]);

  const isTieBreakSpectator =
    round?.phase === 'tie-break' && round.tieBreakCandidates != null && !round.tieBreakCandidates.includes(playerId);
  const isRoundOver = solvedBy !== null;
  const isAttemptsExhausted = round != null && myAttempts.length >= round.maxAttempts;
  const canGuess = !finished && round != null && !isTieBreakSpectator && !isRoundOver && !isAttemptsExhausted;

  const guessInput = useGuessInput(wordLength, canGuess);

  function handleEnter(): void {
    if (!canGuess || !guessInput.isComplete) return;
    submitGuess(guessInput.guess);
    guessInput.reset();
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

  const otherPlayerRows = round?.maxAttempts ?? 6;

  return (
    <div id="championship-room" className="app-shell">
      <header id="championship-header" className="app-header">
        <h1>termo.io — Campeonato</h1>
        <div id="championship-status-pill" className="status-pill">
          <span>Sala: {code}</span>
          <span>{connected ? '🟢 conectado' : '🔴 desconectado'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            Trocar modo
          </button>
        </div>
      </header>

      <main id="championship-main" className="app-main app-main-with-keyboard">
        {round && !finished && <RoundStatus round={round} myAttemptsCount={myAttempts.length} />}

        {finished && (
          <p className="banner banner-gold">
            🏆{' '}
            {finished.winnerIds
              .map((winnerId) => players.find((player) => player.playerId === winnerId)?.nickname ?? 'Alguém')
              .join(', ')}{' '}
            venceu o jogo!
          </p>
        )}
        {countdown !== null && (
          <p className="banner banner-warning">
            Nova partida em {countdown}…
          </p>
        )}
        {reveal && <WordRevealBanner reveal={reveal} players={players} />}
        {isTieBreakSpectator && (
          <p className="banner banner-warning">👀 Você não está no desempate — aguarde o resultado.</p>
        )}
        {extraAttempts && (
          <p className="banner banner-warning">Ninguém acertou — cada jogador recebe mais 2 tentativas!</p>
        )}
        {isRoundOver && !finished && (
          <p className="banner banner-success">
            🎉 {players.find((player) => player.playerId === solvedBy)?.nickname ?? 'Alguém'} acertou a palavra!
          </p>
        )}
        {error && <p className="banner banner-error">{error}</p>}

        <section id="championship-board-section" className="game-board-section">
          <div id="championship-other-players" className="other-players-column">
            <h2>Outros jogadores</h2>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {otherPlayers.map((player) => (
                <PlayerBoard
                  key={player.playerId}
                  nickname={player.nickname}
                  wordLength={wordLength}
                  attempts={attempts.filter((attempt) => attempt.playerId === player.playerId)}
                  totalRows={otherPlayerRows}
                />
              ))}
              {otherPlayers.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nenhum outro jogador na sala ainda.</p>}
            </div>
          </div>

          <div id="championship-my-word" className="my-word-column">
            <WordGrid
              wordLength={wordLength}
              attempts={myAttempts}
              activeGuess={canGuess ? guessInput.letters : undefined}
              activeCursor={canGuess ? guessInput.cursor : undefined}
              activeLastEdited={canGuess ? guessInput.lastEdited : undefined}
              onActiveCellClick={canGuess ? guessInput.setCursor : undefined}
            />
          </div>

          <ScoreBoard
            players={players}
            scores={scores}
            tieBreakCandidates={round?.tieBreakCandidates ?? null}
            ownPlayerId={playerId}
          />
        </section>
      </main>

      <div className="keyboard-footer">
        <Keyboard
          attempts={myAttempts}
          onLetter={guessInput.typeLetter}
          onEnter={handleEnter}
          onBackspace={guessInput.backspace}
          disabled={!canGuess}
        />
      </div>
    </div>
  );
}

function RaceGameRoom({
  code,
  playerId,
  nickname,
  isHost,
  onBack,
}: {
  code: string;
  playerId: string;
  nickname: string;
  isHost: boolean;
  onBack: () => void;
}) {
  const { connected, config, players, progress, attemptsByPlayer, revealHistory, finished, submitGuess, restartGame } =
    useRaceGame(code, playerId, nickname);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [winnerModalDismissed, setWinnerModalDismissed] = useState(false);

  useEffect(() => {
    if (!finished) {
      setCountdown(null);
      setWinnerModalDismissed(false);
      return;
    }
    setCountdown(RESTART_COUNTDOWN_SECS);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          if (isHost) restartGame();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [finished]);

  const wordLength = config?.wordLength ?? 5;
  const myAttempts = attemptsByPlayer[playerId] ?? [];
  const myProgress = progress[playerId];
  const otherPlayers = useMemo(() => players.filter((player) => player.playerId !== playerId), [players, playerId]);

  const canGuess = connected && config != null && myProgress != null && !myProgress.finished && !finished;
  const showWinnerModal = finished !== null && !winnerModalDismissed;
  const showSummary = finished !== null && winnerModalDismissed;

  const guessInput = useGuessInput(wordLength, canGuess);

  function handleEnter(): void {
    if (!canGuess || !guessInput.isComplete) return;
    submitGuess(guessInput.guess);
    guessInput.reset();
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

  return (
    <div id="race-room" className="app-shell">
      <header id="race-header" className="app-header">
        <h1>termo.io — Corrida</h1>
        <div id="race-status-pill" className="status-pill">
          <span>Sala: {code}</span>
          <span>{connected ? '🟢 conectado' : '🔴 desconectado'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            Trocar modo
          </button>
        </div>
      </header>

      <main id="race-main" className="app-main app-main-with-keyboard">
        {config && myProgress && !finished && <RaceStatus config={config} progress={myProgress} />}

        {showSummary && (
          <>
            <p className="banner banner-gold">
              {finished!.winnerId
                ? `🏆 ${players.find((player) => player.playerId === finished!.winnerId)?.nickname ?? 'Alguém'} venceu a corrida!`
                : '🏁 Corrida encerrada — ninguém acertou todas as palavras.'}
            </p>
            {countdown !== null && (
              <p className="banner banner-warning">
                Nova partida em {countdown}…
              </p>
            )}
            <RaceSummary revealHistory={revealHistory} players={players} />
          </>
        )}
        {myProgress?.finished && !finished && (
          <p className="banner banner-warning">👀 Você terminou todas as palavras — aguarde o fim da corrida.</p>
        )}

        <section id="race-board-section" className="game-board-section">
          <div id="race-other-players" className="other-players-column">
            <h2>Outros jogadores</h2>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {otherPlayers.map((player) => (
                <PlayerBoard
                  key={player.playerId}
                  nickname={player.nickname}
                  wordLength={wordLength}
                  attempts={attemptsByPlayer[player.playerId] ?? []}
                  totalRows={6}
                />
              ))}
              {otherPlayers.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nenhum outro jogador na sala ainda.</p>}
            </div>
          </div>

          <div id="race-my-word" className="my-word-column">
            <WordGrid
              wordLength={wordLength}
              attempts={myAttempts}
              activeGuess={canGuess ? guessInput.letters : undefined}
              activeCursor={canGuess ? guessInput.cursor : undefined}
              activeLastEdited={canGuess ? guessInput.lastEdited : undefined}
              onActiveCellClick={canGuess ? guessInput.setCursor : undefined}
            />
          </div>

          {config && <RaceLeaderboard players={players} progress={progress} wordCount={config.wordCount} ownPlayerId={playerId} />}
        </section>
      </main>

      <div className="keyboard-footer">
        <Keyboard
          attempts={myAttempts}
          onLetter={guessInput.typeLetter}
          onEnter={handleEnter}
          onBackspace={guessInput.backspace}
          disabled={!canGuess}
        />
      </div>

      {showWinnerModal && (
        <WinnerModal
          winnerName={finished!.winnerId ? (players.find((p) => p.playerId === finished!.winnerId)?.nickname ?? 'Alguém') : null}
          onDismiss={() => setWinnerModalDismissed(true)}
        />
      )}
    </div>
  );
}

function WinnerModal({ winnerName, onDismiss }: { winnerName: string | null; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <p className="modal-title">
          {winnerName ? `🏆 ${winnerName} venceu a corrida!` : '🏁 Corrida encerrada'}
        </p>
        <button className="btn btn-primary" onClick={onDismiss}>
          Ver resultados
        </button>
      </div>
    </div>
  );
}
