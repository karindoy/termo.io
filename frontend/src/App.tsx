import { useEffect, useMemo, useState } from 'react';
import { useGame } from './hooks/useGame';
import { useFastGame } from './hooks/useFastGame';
import { WordGrid } from './components/WordGrid';
import { Keyboard } from './components/Keyboard';
import { PlayerBoard } from './components/PlayerBoard';
import { ScoreBoard } from './components/ScoreBoard';
import { RoundStatus } from './components/RoundStatus';
import { WordRevealBanner } from './components/WordRevealBanner';
import { RaceStatus } from './components/RaceStatus';
import { RaceLeaderboard } from './components/RaceLeaderboard';
import { FastRevealBanner } from './components/FastRevealBanner';
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

  if (room.mode === 'round') {
    return <RoundGameRoom code={room.code} playerId={playerId} nickname={nickname} onBack={() => setRoom(null)} />;
  }

  return <FastGameRoom code={room.code} playerId={playerId} nickname={nickname} onBack={() => setRoom(null)} />;
}

function NicknameForm({ onSubmit }: { onSubmit: (nickname: string) => void }) {
  const [value, setValue] = useState('');

  return (
    <div className="centered-shell">
      <h1>termo.io</h1>
      <div className="card">
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
  const [mode, setMode] = useState<RoomMode>('round');
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
    <div className="centered-shell" style={{ maxWidth: 420 }}>
      <h1>termo.io</h1>

      <section className="card">
        <h2>Criar uma sala</h2>
        <select className="input" value={mode} onChange={(event) => setMode(event.target.value as RoomMode)}>
          <option value="round">Modo Round</option>
          <option value="fast">Modo Fast</option>
        </select>
        <label className="checkbox-field">
          <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />
          Sala pública (aparece na lista de salas)
        </label>
        <button className="btn btn-primary" disabled={loading} onClick={handleCreate}>
          Criar sala
        </button>
      </section>

      <section className="card">
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

function RoundGameRoom({
  code,
  playerId,
  nickname,
  onBack,
}: {
  code: string;
  playerId: string;
  nickname: string;
  onBack: () => void;
}) {
  const { connected, players, scores, attempts, solvedBy, round, reveal, finished, error, submitGuess } = useGame(
    code,
    playerId,
    nickname,
  );
  const [currentGuess, setCurrentGuess] = useState('');

  const wordLength = round?.wordLength ?? 5;
  const myAttempts = useMemo(() => attempts.filter((attempt) => attempt.playerId === playerId), [attempts, playerId]);
  const otherPlayers = useMemo(() => players.filter((player) => player.playerId !== playerId), [players, playerId]);

  const isTieBreakSpectator =
    round?.phase === 'tie-break' && round.tieBreakCandidates != null && !round.tieBreakCandidates.includes(playerId);
  const isRoundOver = solvedBy !== null;
  const isAttemptsExhausted = round != null && myAttempts.length >= round.maxAttempts;
  const canGuess = !finished && round != null && !isTieBreakSpectator && !isRoundOver && !isAttemptsExhausted;

  function handleLetter(letter: string): void {
    if (!canGuess || currentGuess.length >= wordLength) return;
    setCurrentGuess((prev) => prev + letter);
  }

  function handleBackspace(): void {
    setCurrentGuess((prev) => prev.slice(0, -1));
  }

  function handleEnter(): void {
    if (!canGuess || currentGuess.length !== wordLength) return;
    submitGuess(currentGuess);
    setCurrentGuess('');
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Enter') {
        handleEnter();
      } else if (event.key === 'Backspace') {
        handleBackspace();
      } else if (/^[a-zA-Z]$/.test(event.key)) {
        handleLetter(event.key.toUpperCase());
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>termo.io — Round</h1>
        <div className="status-pill">
          <span>Sala: {code}</span>
          <span>{connected ? '🟢 conectado' : '🔴 desconectado'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            Trocar modo
          </button>
        </div>
      </header>

      <main className="app-main">
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
        {reveal && <WordRevealBanner reveal={reveal} players={players} />}
        {isTieBreakSpectator && (
          <p className="banner banner-warning">👀 Você não está no desempate — aguarde o resultado.</p>
        )}
        {isRoundOver && !finished && (
          <p className="banner banner-success">
            🎉 {players.find((player) => player.playerId === solvedBy)?.nickname ?? 'Alguém'} acertou a palavra!
          </p>
        )}
        {error && <p className="banner banner-error">{error}</p>}

        <section style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <div>
            <h2>Sua palavra</h2>
            <WordGrid wordLength={wordLength} attempts={myAttempts} activeGuess={canGuess ? currentGuess : undefined} />
            {canGuess && (
              <Keyboard attempts={myAttempts} onLetter={handleLetter} onEnter={handleEnter} onBackspace={handleBackspace} />
            )}
          </div>

          <div>
            <h2>Outros jogadores</h2>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {otherPlayers.map((player) => (
                <PlayerBoard
                  key={player.playerId}
                  nickname={player.nickname}
                  wordLength={wordLength}
                  attempts={attempts.filter((attempt) => attempt.playerId === player.playerId)}
                />
              ))}
              {otherPlayers.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nenhum outro jogador na sala ainda.</p>}
            </div>
          </div>

          <ScoreBoard
            players={players}
            scores={scores}
            tieBreakCandidates={round?.tieBreakCandidates ?? null}
            ownPlayerId={playerId}
          />
        </section>
      </main>
    </div>
  );
}

function FastGameRoom({
  code,
  playerId,
  nickname,
  onBack,
}: {
  code: string;
  playerId: string;
  nickname: string;
  onBack: () => void;
}) {
  const { connected, config, players, progress, attemptsByPlayer, reveal, finished, error, submitGuess } =
    useFastGame(code, playerId, nickname);
  const [currentGuess, setCurrentGuess] = useState('');

  const wordLength = config?.wordLength ?? 5;
  const myAttempts = attemptsByPlayer[playerId] ?? [];
  const myProgress = progress[playerId];
  const otherPlayers = useMemo(() => players.filter((player) => player.playerId !== playerId), [players, playerId]);

  const canGuess = connected && config != null && myProgress != null && !myProgress.finished && !finished;

  function handleLetter(letter: string): void {
    if (!canGuess || currentGuess.length >= wordLength) return;
    setCurrentGuess((prev) => prev + letter);
  }

  function handleBackspace(): void {
    setCurrentGuess((prev) => prev.slice(0, -1));
  }

  function handleEnter(): void {
    if (!canGuess || currentGuess.length !== wordLength) return;
    submitGuess(currentGuess);
    setCurrentGuess('');
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Enter') {
        handleEnter();
      } else if (event.key === 'Backspace') {
        handleBackspace();
      } else if (/^[a-zA-Z]$/.test(event.key)) {
        handleLetter(event.key.toUpperCase());
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>termo.io — Fast</h1>
        <div className="status-pill">
          <span>Sala: {code}</span>
          <span>{connected ? '🟢 conectado' : '🔴 desconectado'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            Trocar modo
          </button>
        </div>
      </header>

      <main className="app-main">
        {config && myProgress && !finished && (
          <RaceStatus config={config} progress={myProgress} myAttemptsCount={myAttempts.length} />
        )}

        {finished && (
          <p className="banner banner-gold">
            {finished.winnerId
              ? `🏆 ${players.find((player) => player.playerId === finished.winnerId)?.nickname ?? 'Alguém'} venceu a corrida!`
              : '🏁 Corrida encerrada — ninguém acertou todas as palavras.'}
          </p>
        )}
        {reveal && <FastRevealBanner reveal={reveal} players={players} />}
        {myProgress?.finished && !finished && (
          <p className="banner banner-warning">👀 Você terminou todas as palavras — aguarde o fim da corrida.</p>
        )}
        {error && <p className="banner banner-error">{error}</p>}

        <section style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <div>
            <h2>Sua palavra</h2>
            <WordGrid wordLength={wordLength} attempts={myAttempts} activeGuess={canGuess ? currentGuess : undefined} />
            {canGuess && (
              <Keyboard attempts={myAttempts} onLetter={handleLetter} onEnter={handleEnter} onBackspace={handleBackspace} />
            )}
          </div>

          <div>
            <h2>Outros jogadores</h2>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {otherPlayers.map((player) => (
                <PlayerBoard
                  key={player.playerId}
                  nickname={player.nickname}
                  wordLength={wordLength}
                  attempts={attemptsByPlayer[player.playerId] ?? []}
                />
              ))}
              {otherPlayers.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nenhum outro jogador na sala ainda.</p>}
            </div>
          </div>

          {config && <RaceLeaderboard players={players} progress={progress} wordCount={config.wordCount} ownPlayerId={playerId} />}
        </section>
      </main>
    </div>
  );
}
