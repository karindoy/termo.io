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
    <div style={{ maxWidth: 480, margin: '60px auto', display: 'flex', flexDirection: 'column', gap: 16, color: '#fff' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Sala {room.code}</h1>
        <span>{connected ? '🟢 conectado' : '🔴 desconectado'}</span>
      </header>

      <p>
        Modo: {room.mode === 'round' ? 'Round' : 'Fast'} · {room.isPublic ? 'Pública' : 'Privada'}
      </p>

      {hostMigratedTo && (
        <p style={{ background: '#3a3a3c', padding: 8, borderRadius: 4 }}>
          👑 {hostMigratedTo === playerId ? 'Você agora é o host da sala.' : 'O host da sala mudou.'}
        </p>
      )}
      {error && <p style={{ background: '#8d3838', padding: 8, borderRadius: 4 }}>{error}</p>}

      <section>
        <h2>Jogadores</h2>
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {room.players.map((player) => (
            <li key={player.playerId}>
              {player.playerId === room.hostId ? '👑 ' : ''}
              {player.nickname}
              {player.playerId === playerId ? ' (você)' : ''}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2>Configurações</h2>
        <label>
          Número de palavras
          <input
            type="number"
            min={1}
            max={15}
            disabled={!isHost}
            value={settingsDraft.wordCount}
            onChange={(event) => handleSettingsChange('wordCount', Number(event.target.value))}
          />
        </label>
        {room.mode === 'round' && (
          <label>
            Tentativas por palavra
            <input
              type="number"
              min={1}
              max={10}
              disabled={!isHost}
              value={settingsDraft.maxAttempts}
              onChange={(event) => handleSettingsChange('maxAttempts', Number(event.target.value))}
            />
          </label>
        )}
        <label>
          Tempo por palavra (segundos)
          <input
            type="number"
            min={30}
            max={900}
            disabled={!isHost}
            value={Math.round(settingsDraft.timeLimitMs / 1000)}
            onChange={(event) => handleSettingsChange('timeLimitMs', Number(event.target.value) * 1000)}
          />
        </label>
      </section>

      <div style={{ display: 'flex', gap: 12 }}>
        {isHost ? (
          <button disabled={!connected} onClick={startGame}>
            Iniciar partida
          </button>
        ) : (
          <p>Aguardando o host iniciar a partida…</p>
        )}
        <button onClick={handleLeave}>Sair da sala</button>
      </div>
    </div>
  );
}
