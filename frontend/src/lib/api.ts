import type { RoomMode, RoomRecord, RoomSettings, RoomSummary } from './types';

const API_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

export class RoomLookupError extends Error {}

async function parseOrThrow(response: Response, fallbackMessage: string): Promise<RoomRecord> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new RoomLookupError(body?.message ?? fallbackMessage);
  }
  return (await response.json()) as RoomRecord;
}

export async function createRoom(input: {
  hostId: string;
  nickname: string;
  mode: RoomMode;
  isPublic?: boolean;
  settings?: Partial<RoomSettings>;
}): Promise<RoomRecord> {
  const response = await fetch(`${API_URL}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  return parseOrThrow(response, 'Não foi possível criar a sala');
}

export async function getRoom(code: string): Promise<RoomRecord> {
  const response = await fetch(`${API_URL}/rooms/${encodeURIComponent(code)}`);
  return parseOrThrow(response, `Sala "${code}" não encontrada`);
}

export async function listPublicRooms(): Promise<RoomSummary[]> {
  const response = await fetch(`${API_URL}/rooms`);
  if (!response.ok) {
    throw new RoomLookupError('Não foi possível listar as salas públicas');
  }
  return (await response.json()) as RoomSummary[];
}

export async function updateRoomSettings(
  code: string,
  playerId: string,
  sessionSecret: string,
  settings: Partial<RoomSettings>,
): Promise<RoomRecord> {
  const response = await fetch(`${API_URL}/rooms/${encodeURIComponent(code)}/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, sessionSecret, settings }),
  });

  return parseOrThrow(response, 'Não foi possível atualizar as configurações da sala');
}

export async function startGame(code: string, playerId: string, sessionSecret: string): Promise<RoomRecord> {
  const response = await fetch(`${API_URL}/rooms/${encodeURIComponent(code)}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, sessionSecret }),
  });

  return parseOrThrow(response, 'Não foi possível iniciar a partida');
}
