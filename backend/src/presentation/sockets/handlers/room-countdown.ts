import type { Namespace } from 'socket.io';

export const COUNTDOWN_SECONDS = 15;

const pendingCountdowns = new Map<string, NodeJS.Timeout>();

export type CountdownReason = 'start' | 'restart';

// Broadcasts a countdown to everyone in the room, then runs `action` once it
// elapses, so all clients see the same synced countdown before the game
// actually starts/restarts. Ignored if a countdown is already running for
// this room code (guards against double-clicking the host button).
export function runWithCountdown(io: Namespace, code: string, reason: CountdownReason, action: () => void | Promise<void>): void {
  if (pendingCountdowns.has(code)) return;

  io.to(code).emit('room:countdown:started', { code, seconds: COUNTDOWN_SECONDS, reason });

  const timeout = setTimeout(() => {
    pendingCountdowns.delete(code);
    void action();
  }, COUNTDOWN_SECONDS * 1000);

  pendingCountdowns.set(code, timeout);
}
