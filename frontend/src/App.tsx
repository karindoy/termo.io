import { useEffect, useMemo, useState } from 'react';
import { useGame } from './hooks/useGame';
import { WordGrid } from './components/WordGrid';
import { Keyboard } from './components/Keyboard';
import { PlayerBoard } from './components/PlayerBoard';
import { getOrCreatePlayerId, getStoredNickname, storeNickname } from './lib/player-identity';

const playerId = getOrCreatePlayerId();

export function App() {
  const [nickname, setNickname] = useState<string | null>(getStoredNickname());

  if (!nickname) {
    return <NicknameForm onSubmit={(value) => { storeNickname(value); setNickname(value); }} />;
  }

  return <GameRoom playerId={playerId} nickname={nickname} />;
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

function GameRoom({ playerId, nickname }: { playerId: string; nickname: string }) {
  const { connected, players, attempts, wordLength, solvedBy, error, submitGuess } = useGame(playerId, nickname);
  const [currentGuess, setCurrentGuess] = useState('');

  const myAttempts = useMemo(() => attempts.filter((attempt) => attempt.playerId === playerId), [attempts, playerId]);
  const otherPlayers = useMemo(() => players.filter((player) => player.playerId !== playerId), [players, playerId]);
  const isSolved = solvedBy !== null;

  function handleLetter(letter: string): void {
    if (isSolved || currentGuess.length >= wordLength) return;
    setCurrentGuess((prev) => prev + letter);
  }

  function handleBackspace(): void {
    setCurrentGuess((prev) => prev.slice(0, -1));
  }

  function handleEnter(): void {
    if (isSolved || currentGuess.length !== wordLength) return;
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
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24, color: '#fff' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>termo.io</h1>
        <span>{connected ? '🟢 conectado' : '🔴 desconectado'}</span>
      </header>

      {isSolved && (
        <p style={{ background: '#538d4e', padding: 8, borderRadius: 4 }}>
          🎉 {players.find((player) => player.playerId === solvedBy)?.nickname ?? 'Alguém'} acertou a palavra!
        </p>
      )}
      {error && <p style={{ background: '#8d3838', padding: 8, borderRadius: 4 }}>{error}</p>}

      <section style={{ display: 'flex', gap: 32, marginTop: 24, flexWrap: 'wrap' }}>
        <div>
          <h2>Sua palavra</h2>
          <WordGrid wordLength={wordLength} attempts={myAttempts} activeGuess={isSolved ? undefined : currentGuess} />
          {!isSolved && (
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
      </section>
    </div>
  );
}
