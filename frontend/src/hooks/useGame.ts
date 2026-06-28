import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { createSocket } from '../lib/socket';
import type { Attempt, GuessResult, Player, RoomState } from '../lib/types';

export function useGame(playerId: string, nickname: string) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [wordLength, setWordLength] = useState(5);
  const [solvedBy, setSolvedBy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('room:join', { playerId, nickname });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('room:state', (state: RoomState) => {
      setWordLength(state.wordLength);
      setPlayers(state.players);
      setAttempts(state.attempts);
      setSolvedBy(state.solvedBy);
    });

    socket.on('room:players', (incomingPlayers: Player[]) => {
      setPlayers(incomingPlayers);
    });

    socket.on('guess:result', (result: GuessResult) => {
      setAttempts((prev) => [...prev, result.attempt]);
      setError(null);
      if (result.solved) setSolvedBy(result.winnerId);
    });

    socket.on('guess:error', (payload: { message: string }) => setError(payload.message));
    socket.on('room:error', (payload: { message: string }) => setError(payload.message));

    return () => {
      socket.disconnect();
    };
  }, [playerId, nickname]);

  function submitGuess(guess: string): void {
    socketRef.current?.emit('guess:submit', { playerId, nickname, guess });
  }

  return { connected, players, attempts, wordLength, solvedBy, error, submitGuess };
}
