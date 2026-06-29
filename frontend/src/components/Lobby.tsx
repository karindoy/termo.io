import { useEffect, useState } from 'react';
import { useLobby } from '../hooks/useLobby';
import type { RoomRecord, RoomSettings } from '../lib/types';

export function Lobby({
  room: initialRoom,
  playerId,
  nickname,
  onGameStart,
  onBack,
}: {
  room: RoomRecord;
  playerId: string;
  nickname: string;
  onGameStart: (room: RoomRecord) => void;
  onBack: () => void;
}) {
  const { connected, room, gameStarted, hostMigratedTo, error, updateSettings, startGame, leaveRoom } = useLobby(
    initialRoom,
    playerId,
    nickname,
  );
  const [settingsDraft, setSettingsDraft] = useState<RoomSettings>(initialRoom.settings);

  const isHost = room.hostId === playerId;

  useEffect(() => {
    setSettingsDraft(room.settings);
  }, [room.settings]);

  useEffect(() => {
    if (gameStarted) onGameStart(room);
  }, [gameStarted, room, onGameStart]);

  function handleLeave(): void {
    leaveRoom();
    onBack();
  }

  function handleSettingsChange(field: keyof RoomSettings, value: number): void {
    const next = { ...settingsDraft, [field]: value };
    setSettingsDraft(next);
    updateSettings({ [field]: value });
  }

  return (
    <div className="centered-shell" style={{ maxWidth: 480 }}>
      <header className="app-header" style={{ borderRadius: 8, border: '1px solid var(--color-border)' }}>
        <h1>Sala {room.code}</h1>
        <span className="status-pill">{connected ? '🟢 conectado' : '🔴 desconectado'}</span>
      </header>

      <p style={{ color: 'var(--color-text-muted)' }}>
        Modo: {room.mode === 'round' ? 'Round' : 'Fast'} · {room.isPublic ? 'Pública' : 'Privada'}
      </p>

      {hostMigratedTo && (
        <p className="banner banner-warning">
          👑 {hostMigratedTo === playerId ? 'Você agora é o host da sala.' : 'O host da sala mudou.'}
        </p>
      )}
      {error && <p className="banner banner-error">{error}</p>}

      <section className="card">
        <h2>Jogadores</h2>
        <ul className="row-list">
          {room.players.map((player) => (
            <li key={player.playerId} className={['row-item', player.playerId === playerId ? 'is-self' : ''].join(' ').trim()}>
              <span>{player.nickname}</span>
              <span className="badge">
                {player.playerId === room.hostId ? <span className="tag-host">host</span> : null}
                {player.playerId === playerId ? ' você' : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Configurações</h2>
        <label className="field">
          Número de palavras
          <input
            className="input"
            type="number"
            min={1}
            max={15}
            disabled={!isHost}
            value={settingsDraft.wordCount}
            onChange={(event) => handleSettingsChange('wordCount', Number(event.target.value))}
          />
        </label>
        {room.mode === 'round' && (
          <label className="field">
            Tentativas por palavra
            <input
              className="input"
              type="number"
              min={1}
              max={10}
              disabled={!isHost}
              value={settingsDraft.maxAttempts}
              onChange={(event) => handleSettingsChange('maxAttempts', Number(event.target.value))}
            />
          </label>
        )}
        <label className="field">
          Tempo por palavra (segundos)
          <input
            className="input"
            type="number"
            min={30}
            max={900}
            disabled={!isHost}
            value={Math.round(settingsDraft.timeLimitMs / 1000)}
            onChange={(event) => handleSettingsChange('timeLimitMs', Number(event.target.value) * 1000)}
          />
        </label>
      </section>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {isHost ? (
          <button className="btn btn-primary" disabled={!connected} onClick={startGame}>
            Iniciar partida
          </button>
        ) : (
          <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>Aguardando o host iniciar a partida…</p>
        )}
        <button className="btn btn-ghost" onClick={handleLeave}>
          Sair da sala
        </button>
      </div>
    </div>
  );
}
