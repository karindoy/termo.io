import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { createSocket } from '../lib/socket';
import type {
  Attempt,
  FastGuessResult,
  Player,
  PlayerProgressSnapshot,
  PlayerRoundSnapshot,
  PlayerWordResolvedPayload,
  RaceConfigSnapshot,
  RaceFinishedPayload,
  RaceRoomState,
} from '../lib/types';

const REVEAL_DISPLAY_MS = 4000;

export interface FastRevealInfo {
  playerId: string;
  revealedWord: string;
  reason: PlayerWordResolvedPayload['reason'];
  playerWon: boolean;
}

export function useFastGame(playerId: string, nickname: string) {
  const socketRef = useRef<Socket | null>(null);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordIndexRef = useRef<Record<string, number>>({});

  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<RaceConfigSnapshot | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [progress, setProgress] = useState<Record<string, PlayerProgressSnapshot>>({});
  const [attemptsByPlayer, setAttemptsByPlayer] = useState<Record<string, Attempt[]>>({});
  const [reveal, setReveal] = useState<FastRevealInfo | null>(null);
  const [finished, setFinished] = useState<RaceFinishedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  function clearRevealTimeout(): void {
    if (revealTimeoutRef.current) {
      clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = null;
    }
  }

  function setProgressEntry(entry: PlayerProgressSnapshot): void {
    wordIndexRef.current[entry.playerId] = entry.wordIndex;
    setProgress((prev) => ({ ...prev, [entry.playerId]: entry }));
  }

  useEffect(() => {
    const socket = createSocket('fast');
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('room:join', { playerId, nickname });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('room:state', (state: RaceRoomState) => {
      setConfig(state);
      setPlayers(state.players);
      setAttemptsByPlayer(state.attemptsByPlayer);
      setProgress(Object.fromEntries(state.progress.map((entry) => [entry.playerId, entry])));
      wordIndexRef.current = Object.fromEntries(state.progress.map((entry) => [entry.playerId, entry.wordIndex]));
      setFinished(state.phase === 'finished' ? { winnerId: state.winnerId } : null);
      setReveal(null);
      clearRevealTimeout();
      setError(null);
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
      setReveal({
        playerId: result.playerId,
        revealedWord: result.revealedWord,
        reason: result.reason,
        playerWon: result.playerWon,
      });
      clearRevealTimeout();
      revealTimeoutRef.current = setTimeout(() => setReveal(null), REVEAL_DISPLAY_MS);
    });

    socket.on('race:finished', (payload: RaceFinishedPayload) => setFinished(payload));

    socket.on('guess:result', (result: FastGuessResult) => {
      setError(null);
      if (result.wordIndex !== wordIndexRef.current[result.attempt.playerId]) return;
      setAttemptsByPlayer((prev) => ({
        ...prev,
        [result.attempt.playerId]: [...(prev[result.attempt.playerId] ?? []), result.attempt],
      }));
    });

    socket.on('guess:error', (payload: { message: string }) => setError(payload.message));
    socket.on('room:error', (payload: { message: string }) => setError(payload.message));

    return () => {
      clearRevealTimeout();
      socket.disconnect();
    };
  }, [playerId, nickname]);

  function submitGuess(guess: string): void {
    socketRef.current?.emit('guess:submit', { playerId, nickname, guess });
  }

  return {
    connected,
    config,
    players,
    progress,
    attemptsByPlayer,
    reveal,
    finished,
    error,
    submitGuess,
  };
}
