import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { createSocket } from '../lib/socket';
import type {
  Attempt,
  RaceGuessResult,
  Player,
  PlayerProgressSnapshot,
  PlayerRoundSnapshot,
  PlayerWordResolvedPayload,
  RaceConfigSnapshot,
  RaceFinishedPayload,
  RaceRoomState,
  RoomSessionPayload,
} from '../lib/types';

export interface RaceRevealInfo {
  playerId: string;
  revealedWord: string;
  reason: PlayerWordResolvedPayload['reason'];
  playerWon: boolean;
}

export function useRaceGame(code: string, playerId: string, nickname: string) {
  const socketRef = useRef<Socket | null>(null);
  const wordIndexRef = useRef<Record<string, number>>({});
  const sessionSecretRef = useRef<string | null>(null);

  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<RaceConfigSnapshot | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [progress, setProgress] = useState<Record<string, PlayerProgressSnapshot>>({});
  const [attemptsByPlayer, setAttemptsByPlayer] = useState<Record<string, Attempt[]>>({});
  const [revealHistory, setRevealHistory] = useState<RaceRevealInfo[]>([]);
  const [finished, setFinished] = useState<RaceFinishedPayload | null>(null);

  function setProgressEntry(entry: PlayerProgressSnapshot): void {
    wordIndexRef.current[entry.playerId] = entry.wordIndex;
    setProgress((prev) => ({ ...prev, [entry.playerId]: entry }));
  }

  useEffect(() => {
    const socket = createSocket('race');
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('room:join', { code, playerId, nickname });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('room:session', (payload: RoomSessionPayload) => {
      sessionSecretRef.current = payload.sessionSecret;
    });

    socket.on('room:state', (state: RaceRoomState) => {
      setConfig(state);
      setPlayers(state.players);
      setAttemptsByPlayer(state.attemptsByPlayer);
      setProgress(Object.fromEntries(state.progress.map((entry) => [entry.playerId, entry])));
      wordIndexRef.current = Object.fromEntries(state.progress.map((entry) => [entry.playerId, entry.wordIndex]));
      setFinished(state.phase === 'finished' ? { winnerId: state.winnerId } : null);
      setRevealHistory([]);
    });

    socket.on('room:players', (incomingPlayers: Player[]) => setPlayers(incomingPlayers));

    socket.on('player:word-started', (snapshot: PlayerRoundSnapshot) => {
      setProgressEntry({ ...snapshot, won: false });
      setAttemptsByPlayer((prev) => ({ ...prev, [snapshot.playerId]: [] }));
    });

    socket.on('player:word-resolved', (result: PlayerWordResolvedPayload) => {
      setProgress((prev) => {
        const current = prev[result.playerId];
        if (!current) return prev;
        return {
          ...prev,
          [result.playerId]: { ...current, finished: result.playerFinished, won: result.playerWon },
        };
      });
      setRevealHistory((prev) => [
        ...prev,
        {
          playerId: result.playerId,
          revealedWord: result.revealedWord,
          reason: result.reason,
          playerWon: result.playerWon,
        },
      ]);
    });

    socket.on('race:finished', (payload: RaceFinishedPayload) => setFinished(payload));

    socket.on('guess:result', (result: RaceGuessResult) => {
      if (result.wordIndex !== wordIndexRef.current[result.attempt.playerId]) return;
      setAttemptsByPlayer((prev) => ({
        ...prev,
        [result.attempt.playerId]: [...(prev[result.attempt.playerId] ?? []), result.attempt],
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, [code, playerId, nickname]);

  function submitGuess(guess: string): void {
    socketRef.current?.emit('guess:submit', { code, playerId, nickname, guess, sessionSecret: sessionSecretRef.current });
  }

  return {
    connected,
    config,
    players,
    progress,
    attemptsByPlayer,
    revealHistory,
    finished,
    submitGuess,
  };
}
