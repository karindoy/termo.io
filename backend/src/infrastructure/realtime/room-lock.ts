// Serializes read-modify-write access to a room's state per room code. Without this,
// concurrent socket handlers (e.g. several players joining at once) each read the same
// stale RoomRecord, mutate their own copy, and save — the last save wins and silently
// drops every other concurrent change (a classic lost-update race). Chaining a promise
// queue per code turns each mutation into a critical section without blocking unrelated
// rooms. This only serializes within a single process, which matches this app's model:
// game-mode state (GameModeRegistry) already lives in-process with no Socket.IO Redis
// adapter for horizontal scaling.
const roomLocks = new Map<string, Promise<void>>();

export function withRoomLock<T>(code: string, fn: () => Promise<T>): Promise<T> {
  const previous = roomLocks.get(code) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  roomLocks.set(code, tail);
  tail.finally(() => {
    if (roomLocks.get(code) === tail) {
      roomLocks.delete(code);
    }
  });
  return run;
}
