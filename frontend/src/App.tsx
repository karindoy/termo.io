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
import { getOrCreatePlayerId, getStoredNickname, storeNickname } from './lib/player-identity';

const playerId = getOrCreatePlayerId();

type GameModeKind = 'round' | 'fast';

export function App() {
  const [nickname, setNickname] = useState<string | null>(getStoredNickname());
  const [mode, setMode] = useState<GameModeKind | null>(null);

  if (!nickname) {
    return <NicknameForm onSubmit={(value) => { storeNickname(value); setNickname(value); }} />;
  }

  if (!mode) {
    return <ModePicker onSelect={setMode} />;
  }

  if (mode === 'round') {
    return <RoundGameRoom playerId={playerId} nickname={nickname} onBack={() => setMode(null)} />;
  }

  return <FastGameRoom playerId={playerId} nickname={nickname} onBack={() => setMode(null)} />;
}

function NicknameForm({ onSubmit }: { onSubmit: (nickname: string) => void }) {
  const [value, setValue] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320, margin: '80px auto' }}>
      <h1>termo.io</h1>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Escolha seu apelido"
        maxLength={24}
      />
      <button disabled={value.trim().length === 0} onClick={() => onSubmit(value.trim())}>
        Entrar
      </button>
    </div>
  );
}

function ModePicker({ onSelect }: { onSelect: (mode: GameModeKind) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320, margin: '80px auto', color: '#fff' }}>
      <h1>termo.io</h1>
      <p>Escolha o modo de jogo</p>
      <button onClick={() => onSelect('round')}>Modo Round</button>
      <button onClick={() => onSelect('fast')}>Modo Fast</button>
    </div>
  );
}

function RoundGameRoom({ playerId, nickname, onBack }: { playerId: string; nickname: string; onBack: () => void }) {
  const { connected, players, scores, attempts, solvedBy, round, reveal, finished, error, submitGuess } = useGame(
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
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24, color: '#fff' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>termo.io — Round</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span>{connected ? '🟢 conectado' : '🔴 desconectado'}</span>
          <button onClick={onBack}>Trocar modo</button>
        </div>
      </header>

      {round && !finished && <RoundStatus round={round} myAttemptsCount={myAttempts.length} />}

      {finished && (
        <p style={{ background: '#9a7d1f', padding: 8, borderRadius: 4 }}>
          🏆{' '}
          {finished.winnerIds
            .map((winnerId) => players.find((player) => player.playerId === winnerId)?.nickname ?? 'Alguém')
            .join(', ')}{' '}
          venceu o jogo!
        </p>
      )}
      {reveal && <WordRevealBanner reveal={reveal} players={players} />}
      {isTieBreakSpectator && (
        <p style={{ background: '#3a3a3c', padding: 8, borderRadius: 4 }}>
          👀 Você não está no desempate — aguarde o resultado.
        </p>
      )}
      {isRoundOver && !finished && (
        <p style={{ background: '#538d4e', padding: 8, borderRadius: 4 }}>
          🎉 {players.find((player) => player.playerId === solvedBy)?.nickname ?? 'Alguém'} acertou a palavra!
        </p>
      )}
      {error && <p style={{ background: '#8d3838', padding: 8, borderRadius: 4 }}>{error}</p>}

      <section style={{ display: 'flex', gap: 32, marginTop: 24, flexWrap: 'wrap' }}>
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
            {otherPlayers.length === 0 && <p>Nenhum outro jogador na sala ainda.</p>}
          </div>
        </div>

        <ScoreBoard
          players={players}
          scores={scores}
          tieBreakCandidates={round?.tieBreakCandidates ?? null}
          ownPlayerId={playerId}
        />
      </section>
    </div>
  );
}

function FastGameRoom({ playerId, nickname, onBack }: { playerId: string; nickname: string; onBack: () => void }) {
  const { connected, config, players, progress, attemptsByPlayer, reveal, finished, error, submitGuess } =
    useFastGame(playerId, nickname);
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
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24, color: '#fff' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>termo.io — Fast</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span>{connected ? '🟢 conectado' : '🔴 desconectado'}</span>
          <button onClick={onBack}>Trocar modo</button>
        </div>
      </header>

      {config && myProgress && !finished && (
        <RaceStatus config={config} progress={myProgress} myAttemptsCount={myAttempts.length} />
      )}

      {finished && (
        <p style={{ background: '#9a7d1f', padding: 8, borderRadius: 4 }}>
          {finished.winnerId
            ? `🏆 ${players.find((player) => player.playerId === finished.winnerId)?.nickname ?? 'Alguém'} venceu a corrida!`
            : '🏁 Corrida encerrada — ninguém acertou todas as palavras.'}
        </p>
      )}
      {reveal && <FastRevealBanner reveal={reveal} players={players} />}
      {myProgress?.finished && !finished && (
        <p style={{ background: '#3a3a3c', padding: 8, borderRadius: 4 }}>
          👀 Você terminou todas as palavras — aguarde o fim da corrida.
        </p>
      )}
      {error && <p style={{ background: '#8d3838', padding: 8, borderRadius: 4 }}>{error}</p>}

      <section style={{ display: 'flex', gap: 32, marginTop: 24, flexWrap: 'wrap' }}>
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
            {otherPlayers.length === 0 && <p>Nenhum outro jogador na sala ainda.</p>}
          </div>
        </div>

        {config && <RaceLeaderboard players={players} progress={progress} wordCount={config.wordCount} ownPlayerId={playerId} />}
      </section>
    </div>
  );
}
