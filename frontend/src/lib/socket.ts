import { io, type Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

// Room code goes on the handshake query string so a reverse proxy can route the
// WebSocket upgrade to the backend instance that owns this room, purely by reading it.
export function createSocket(namespace: string, code: string): Socket {
  return io(`${SOCKET_URL}/${namespace}`, { query: { code } });
}
