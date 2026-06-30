import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { createSocket } from '../lib/socket';
import type {
  Attempt,
  GameFinishedPayload,
  GuessResult,
  Player,
  RoomSessionPayload,
  RoomState,
  RoundSnapshot,
  TieBreakStartedPayload,
  WordResolvedPayload,
} from '../lib/types';

const REVEAL_DISPLAY_MS = 4000;

export interface RevealInfo {
  revealedWord: string;
  reason: WordResolvedPayload['reason'];
  winnerId: string | null;
  isTieBreak: boolean;
}

export function useGame(code: string, playerId: string, nickname: string) {
  const socketRef = useRef<Socket | null>(null);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundSequenceRef = useRef<number | null>(null);
  const sessionSecretRef = useRef<string | null>(null);

  const [connected, setConnected] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [solvedBy, setSolvedBy] = useState<string | null>(null);
  const [round, setRound] = useState<RoundSnapshot | null>(null);
  const [reveal, setReveal] = useState<RevealInfo | null>(null);
  const [finished, setFinished] = useState<GameFinishedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extraAttempts, setExtraAttempts] = useState(false);

  function applyRound(snapshot: RoundSnapshot): void {
    roundSequenceRef.current = snapshot.roundSequence;
    setRound(snapshot);
  }

  function clearRevealTimeout(): void {
    if (revealTimeoutRef.current) {
      clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = null;
    }
  }

  useEffect(() => {
    const socket = createSocket('championship');
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('room:join', { code, playerId, nickname });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('room:session', (payload: RoomSessionPayload) => {
      sessionSecretRef.current = payload.sessionSecret;
    });

    socket.on('room:state', (state: RoomState) => {
      applyRound(state);
      setPlayers(state.players);
      setScores(state.scores);
      setAttempts(state.attempts);
      setSolvedBy(state.solvedBy);
      setFinished(null);
      setReveal(null);
      clearRevealTimeout();
    });

    socket.on('room:players', (incomingPlayers: Player[]) => setPlayers(incomingPlayers));

    socket.on('round:started', (snapshot: RoundSnapshot) => {
      applyRound(snapshot);
      setAttempts([]);
      setSolvedBy(null);
      setError(null);
      setExtraAttempts(false);
    });

    socket.on('tiebreak:started', (payload: TieBreakStartedPayload) => {
      applyRound(payload);
      setAttempts([]);
      setSolvedBy(null);
      setError(null);
      setExtraAttempts(false);
    });

    socket.on('round:extra-attempts', (snapshot: RoundSnapshot) => {
      applyRound(snapshot);
      setExtraAttempts(true);
    });

    socket.on('word:resolved', (result: WordResolvedPayload) => {
      setScores(result.scores);
      setReveal({
        revealedWord: result.revealedWord,
        reason: result.reason,
        winnerId: result.winnerId,
        isTieBreak: result.isTieBreak,
      });
      clearRevealTimeout();
      revealTimeoutRef.current = setTimeout(() => setReveal(null), REVEAL_DISPLAY_MS);
    });

    socket.on('game:finished', (payload: GameFinishedPayload) => {
      setFinished(payload);
      setScores(payload.scores);
    });

    socket.on('guess:result', (result: GuessResult) => {
      setError(null);
      if (result.roundSequence !== roundSequenceRef.current) return;
      setAttempts((prev) => [...prev, result.attempt]);
      if (result.solved) setSolvedBy(result.winnerId);
    });

    socket.on('guess:error', (payload: { message: string }) => setError(payload.message));
    socket.on('room:error', (payload: { message: string }) => setError(payload.message));

    return () => {
      clearRevealTimeout();
      socket.disconnect();
    };
  }, [code, playerId, nickname]);

  function submitGuess(guess: string): void {
    socketRef.current?.emit('guess:submit', { code, playerId, nickname, guess, sessionSecret: sessionSecretRef.current });
  }

  function restartGame(): void {
    socketRef.current?.emit('room:restart', { code, playerId });
  }

  return {
    connected,
    players,
    scores,
    attempts,
    solvedBy,
    round,
    reveal,
    finished,
    error,
    extraAttempts,
    submitGuess,
    restartGame,
  };
}
