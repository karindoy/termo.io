import { io, type Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

export function createSocket(namespace: string): Socket {
  return io(`${SOCKET_URL}/${namespace}`);
}
