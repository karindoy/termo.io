import type { RoomMode, RoomRecord } from './types';

const API_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

export class RoomLookupError extends Error {}

export async function createRoom(input: { hostId: string; nickname: string; mode: RoomMode }): Promise<RoomRecord> {
  const response = await fetch(`${API_URL}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new RoomLookupError('Não foi possível criar a sala');
  }

  return (await response.json()) as RoomRecord;
}

export async function getRoom(code: string): Promise<RoomRecord> {
  const response = await fetch(`${API_URL}/rooms/${encodeURIComponent(code)}`);

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new RoomLookupError(body?.message ?? `Sala "${code}" não encontrada`);
  }

  return (await response.json()) as RoomRecord;
}
