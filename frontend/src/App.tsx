import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from './hooks/useGame';
import { useRaceGame } from './hooks/useRaceGame';
import { useGuessInput } from './hooks/useGuessInput';
import { useBanner } from './hooks/useBanner';
import { WordGrid } from './components/WordGrid';
import { Keyboard } from './components/Keyboard';
import { PlayerBoard } from './components/PlayerBoard';
import { RoundStatus } from './components/RoundStatus';
import { BannerSlot } from './components/BannerSlot';
import { RaceStatus } from './components/RaceStatus';
import { PlacarModal, type PlacarWordRow } from './components/PlacarModal';
import { CountdownDisplay } from './components/CountdownDisplay';
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
  const { connected, players, attempts, solvedBy, round, reveal, finished, error, extraAttempts, playerStats, wordHistory, countdown, submitGuess, restartGame } = useGame(
    code,
    playerId,
    nickname,
  );
  const [placarDismissed, setPlacarDismissed] = useState(false);

  useEffect(() => {
    if (!finished) setPlacarDismissed(false);
  }, [finished]);

  const wordLength = round?.wordLength ?? 5;
  const myAttempts = useMemo(() => attempts.filter((attempt) => attempt.playerId === playerId), [attempts, playerId]);
  const otherPlayers = useMemo(() => players.filter((player) => player.playerId !== playerId), [players, playerId]);

  const isTieBreakSpectator =
    round?.phase === 'tie-break' && round.tieBreakCandidates != null && !round.tieBreakCandidates.includes(playerId);
  const isRoundOver = solvedBy !== null;
  const isAttemptsExhausted = round != null && myAttempts.length >= round.maxAttempts;
  const canGuess = !finished && round != null && !isTieBreakSpectator && !isRoundOver && !isAttemptsExhausted;

  const guessInput = useGuessInput(wordLength, canGuess, round?.roundSequence);

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

  const { banner: eventBanner, show } = useBanner();

  // Stable ref so banner effects don't re-fire when players list updates.
  const playersRef = useRef(players);
  useEffect(() => { playersRef.current = players; });

  // Show immediately when someone solves — reveal arrives ~100 ms later and replaces it.
  const prevSolvedByRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevSolvedByRef.current;
    prevSolvedByRef.current = solvedBy;
    if (!solvedBy || solvedBy === prev || finished) return;
    const name = playersRef.current.find((p) => p.playerId === solvedBy)?.nickname ?? 'Alguém';
    show(`🎉 ${name} acertou a palavra!`, 'success', 4000);
  }, [solvedBy, finished, show]);

  // Reveal replaces the solve notice with the actual word and reason.
  useEffect(() => {
    if (!reveal) return;
    const winnerNickname = playersRef.current.find((p) => p.playerId === reveal.winnerId)?.nickname;
    const prefix = reveal.isTieBreak ? 'Desempate — ' : '';
    let message: string;
    if (reveal.reason === 'solved' && winnerNickname) {
      message = `${prefix}🎉 ${winnerNickname} acertou: ${reveal.revealedWord}`;
    } else if (reveal.reason === 'timeout') {
      message = `${prefix}⏰ Tempo esgotado! A palavra era: ${reveal.revealedWord}`;
    } else {
      message = `${prefix}❌ Tentativas esgotadas! A palavra era: ${reveal.revealedWord}`;
    }
    show(message, reveal.reason === 'solved' ? 'success' : 'warning', 4000);
  }, [reveal, show]);

  useEffect(() => {
    if (error) show(error, 'error');
  }, [error, show]);

  useEffect(() => {
    if (extraAttempts) show('Ninguém acertou — cada jogador recebe mais 2 tentativas!', 'warning', 5000);
  }, [extraAttempts, show]);

  // Persistent fallback: countdown updates in-place (no re-animation on each tick).
  const persistentBanner = useMemo(() => {
    if (isTieBreakSpectator) {
      return { message: '👀 Você não está no desempate — aguarde o resultado.', type: 'warning' as const };
    }
    return null;
  }, [isTieBreakSpectator]);

  const placarHeadline = finished
    ? `🏆 ${finished.winnerIds.map((id) => players.find((p) => p.playerId === id)?.nickname ?? 'Alguém').join(', ')} venceu!`
    : '';

  const placarRows = useMemo<PlacarWordRow[]>(
    () =>
      wordHistory.map((entry, index) => {
        const statusByPlayer: PlacarWordRow['statusByPlayer'] = {};
        for (const player of players) {
          if (entry.tieBreakCandidates && !entry.tieBreakCandidates.includes(player.playerId)) {
            statusByPlayer[player.playerId] = 'pending';
          } else {
            statusByPlayer[player.playerId] = entry.winnerId === player.playerId ? 'hit' : 'miss';
          }
        }
        return {
          key: `${entry.wordIndex}-${index}`,
          label: entry.isTieBreak ? 'Desempate' : `Palavra ${entry.wordIndex + 1}`,
          word: entry.word,
          statusByPlayer,
        };
      }),
    [wordHistory, players],
  );

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
        <BannerSlot id="championship-banner-slot" banner={eventBanner} fallback={persistentBanner} />

        <section id="championship-board-section" className="game-layout">
          <div id="championship-other-players" className="other-players-panel">
            <h2>Outros jogadores</h2>
            <div id="championship-other-players-list" className="other-players-list">
              {otherPlayers.map((player) => (
                <PlayerBoard
                  key={player.playerId}
                  nickname={player.nickname}
                  wordLength={wordLength}
                  attempts={attempts.filter((attempt) => attempt.playerId === player.playerId)}
                  totalRows={otherPlayerRows}
                  correctWords={playerStats[player.playerId]?.correct ?? 0}
                  wrongWords={playerStats[player.playerId]?.wrong ?? 0}
                />
              ))}
              {otherPlayers.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nenhum outro jogador na sala ainda.</p>}
            </div>
          </div>

          <div id="championship-my-word" className="game-center">
            <WordGrid
              gridId="my-word"
              wordLength={wordLength}
              attempts={myAttempts}
              activeGuess={canGuess ? guessInput.letters : undefined}
              activeCursor={canGuess ? guessInput.cursor : undefined}
              activeLastEdited={canGuess ? guessInput.lastEdited : undefined}
              onActiveCellClick={canGuess ? guessInput.setCursor : undefined}
              correctWords={playerStats[playerId]?.correct ?? 0}
              wrongWords={playerStats[playerId]?.wrong ?? 0}
            />
          </div>

          <div id="championship-aside" className="game-aside" />
        </section>
      </main>

      <div id="championship-keyboard-footer" className="keyboard-footer">
        <Keyboard
          attempts={myAttempts}
          onLetter={guessInput.typeLetter}
          onEnter={handleEnter}
          onBackspace={guessInput.backspace}
          disabled={!canGuess}
        />
      </div>

      {finished && !placarDismissed && (
        <PlacarModal
          headline={placarHeadline}
          players={players}
          rows={placarRows}
          footer={<RestartFooter isHost={isHost} countdown={countdown} onRestart={restartGame} />}
          onDismiss={() => setPlacarDismissed(true)}
        />
      )}
    </div>
  );
}

function RestartFooter({
  isHost,
  countdown,
  onRestart,
}: {
  isHost: boolean;
  countdown: number | null;
  onRestart: () => void;
}) {
  if (countdown !== null) {
    return <CountdownDisplay seconds={countdown} label="Nova partida em" />;
  }
  if (isHost) {
    return (
      <button className="btn btn-primary" onClick={onRestart}>
        Iniciar partida
      </button>
    );
  }
  return <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>Aguardando o host iniciar a nova partida…</p>;
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
  const { connected, config, players, progress, attemptsByPlayer, revealHistory, sessionStats, finished, countdown, submitGuess, restartGame } =
    useRaceGame(code, playerId, nickname);
  const [placarDismissed, setPlacarDismissed] = useState(false);

  useEffect(() => {
    if (!finished) setPlacarDismissed(false);
  }, [finished]);

  const wordLength = config?.wordLength ?? 5;
  const myAttempts = attemptsByPlayer[playerId] ?? [];
  const myProgress = progress[playerId];
  const otherPlayers = useMemo(() => players.filter((player) => player.playerId !== playerId), [players, playerId]);

  const canGuess = connected && config != null && myProgress != null && !myProgress.finished && !finished;

  const guessInput = useGuessInput(wordLength, canGuess, myProgress?.wordIndex);

  const placarHeadline = finished
    ? finished.winnerId
      ? `🏆 ${players.find((player) => player.playerId === finished.winnerId)?.nickname ?? 'Alguém'} venceu a corrida!`
      : '🏁 Corrida encerrada — ninguém acertou todas as palavras.'
    : '';

  const placarRows = useMemo<PlacarWordRow[]>(() => {
    if (!config) return [];
    const rows: PlacarWordRow[] = [];
    for (let wordIndex = 0; wordIndex < config.wordCount; wordIndex += 1) {
      const entriesForWord = revealHistory.filter((entry) => entry.wordIndex === wordIndex);
      const firstEntry = entriesForWord[0];
      if (!firstEntry) continue;
      const statusByPlayer: PlacarWordRow['statusByPlayer'] = {};
      for (const player of players) {
        const entry = entriesForWord.find((candidate) => candidate.playerId === player.playerId);
        statusByPlayer[player.playerId] = !entry ? 'pending' : entry.reason === 'solved' ? 'hit' : 'miss';
      }
      rows.push({
        key: String(wordIndex),
        label: `Palavra ${wordIndex + 1}`,
        word: firstEntry.revealedWord,
        statusByPlayer,
      });
    }
    return rows;
  }, [revealHistory, players, config]);

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

        {myProgress?.finished && !finished && (
          <p className="banner banner-warning">👀 Você terminou todas as palavras — aguarde o fim da corrida.</p>
        )}

        <section id="race-board-section" className="game-layout">
          <div id="race-other-players" className="other-players-panel">
            <h2>Outros jogadores</h2>
            <div id="race-other-players-list" className="other-players-list">
              {otherPlayers.map((player) => (
                <PlayerBoard
                  key={player.playerId}
                  nickname={player.nickname}
                  wordLength={wordLength}
                  attempts={attemptsByPlayer[player.playerId] ?? []}
                  totalRows={6}
                  correctWords={sessionStats[player.playerId]?.correct ?? 0}
                  wrongWords={sessionStats[player.playerId]?.wrong ?? 0}
                />
              ))}
              {otherPlayers.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nenhum outro jogador na sala ainda.</p>}
            </div>
          </div>

          <div id="race-my-word" className="game-center">
            <WordGrid
              gridId="my-word"
              wordLength={wordLength}
              attempts={myAttempts}
              activeGuess={canGuess ? guessInput.letters : undefined}
              activeCursor={canGuess ? guessInput.cursor : undefined}
              activeLastEdited={canGuess ? guessInput.lastEdited : undefined}
              onActiveCellClick={canGuess ? guessInput.setCursor : undefined}
              correctWords={sessionStats[playerId]?.correct ?? 0}
              wrongWords={sessionStats[playerId]?.wrong ?? 0}
            />
          </div>

          <div id="race-aside" className="game-aside" />
        </section>
      </main>

      <div id="race-keyboard-footer" className="keyboard-footer">
        <Keyboard
          attempts={myAttempts}
          onLetter={guessInput.typeLetter}
          onEnter={handleEnter}
          onBackspace={guessInput.backspace}
          disabled={!canGuess}
        />
      </div>

      {finished && !placarDismissed && (
        <PlacarModal
          headline={placarHeadline}
          players={players}
          rows={placarRows}
          footer={<RestartFooter isHost={isHost} countdown={countdown} onRestart={restartGame} />}
          onDismiss={() => setPlacarDismissed(true)}
        />
      )}
    </div>
  );
}
