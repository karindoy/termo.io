import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { createSocket } from '../lib/socket';
import type { HostMigratedPayload, RoomRecord, RoomSettings } from '../lib/types';

export function useLobby(initialRoom: RoomRecord, playerId: string, nickname: string) {
  const { code, mode } = initialRoom;
  const socketRef = useRef<Socket | null>(null);

  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<RoomRecord>(initialRoom);
  const [gameStarted, setGameStarted] = useState(false);
  const [hostMigratedTo, setHostMigratedTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = createSocket(mode);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('room:join', { code, playerId, nickname });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('lobby:state', (state: RoomRecord) => setRoom(state));

    socket.on('game:start', (state: RoomRecord) => {
      setRoom(state);
      setGameStarted(true);
    });

    socket.on('host:migrated', (payload: HostMigratedPayload) => {
      setRoom((prev) => ({ ...prev, hostId: payload.hostId }));
      setHostMigratedTo(payload.hostId);
    });

    socket.on('room:error', (payload: { message: string }) => setError(payload.message));

    return () => {
      socket.disconnect();
    };
  }, [code, mode, playerId, nickname]);

  function updateSettings(settings: Partial<RoomSettings>): void {
    socketRef.current?.emit('room:settings:update', { code, playerId, settings });
  }

  function startGame(): void {
    socketRef.current?.emit('room:start', { code, playerId });
  }

  function leaveRoom(): void {
    socketRef.current?.emit('room:leave', { code, playerId });
  }

  return { connected, room, gameStarted, hostMigratedTo, error, updateSettings, startGame, leaveRoom };
}
