import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { createSocket } from '../lib/socket';
import type { CountdownStartedPayload, HostMigratedPayload, RoomRecord, RoomSessionPayload, RoomSettings } from '../lib/types';

export function useLobby(initialRoom: RoomRecord, playerId: string, nickname: string, onNotFound?: () => void) {
  const { code, mode } = initialRoom;
  const socketRef = useRef<Socket | null>(null);
  const sessionSecretRef = useRef<string | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<RoomRecord>(initialRoom);
  const [gameStarted, setGameStarted] = useState(false);
  const [hostMigratedTo, setHostMigratedTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    const socket = createSocket(mode);
    socketRef.current = socket;

    function clearCountdownInterval(): void {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('room:join', { code, playerId, nickname });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('room:session', (payload: RoomSessionPayload) => {
      sessionSecretRef.current = payload.sessionSecret;
    });

    socket.on('lobby:state', (state: RoomRecord) => setRoom(state));

    socket.on('room:countdown:started', (payload: CountdownStartedPayload) => {
      clearCountdownInterval();
      setCountdown(payload.seconds);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearCountdownInterval();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    });

    socket.on('game:start', (state: RoomRecord) => {
      clearCountdownInterval();
      setCountdown(null);
      setRoom(state);
      setGameStarted(true);
    });

    socket.on('host:migrated', (payload: HostMigratedPayload) => {
      setRoom((prev) => ({ ...prev, hostId: payload.hostId }));
      setHostMigratedTo(payload.hostId);
    });

    socket.on('room:error', (payload: { message: string; code?: string }) => {
      setError(payload.message);
      if (payload.code === 'ROOM_NOT_FOUND') onNotFound?.();
    });

    return () => {
      clearCountdownInterval();
      socket.disconnect();
    };
  }, [code, mode, playerId, nickname]);

  function updateSettings(settings: Partial<RoomSettings>): void {
    socketRef.current?.emit('room:settings:update', { code, playerId, sessionSecret: sessionSecretRef.current, settings });
  }

  function startGame(): void {
    socketRef.current?.emit('room:start', { code, playerId, sessionSecret: sessionSecretRef.current });
  }

  function leaveRoom(): void {
    socketRef.current?.emit('room:leave', { code, playerId, sessionSecret: sessionSecretRef.current });
  }

  return { connected, room, gameStarted, hostMigratedTo, error, countdown, updateSettings, startGame, leaveRoom };
}
