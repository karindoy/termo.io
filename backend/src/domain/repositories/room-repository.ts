import type { RoomSettings } from '../value-objects/room-settings.js';

export const MAX_PLAYERS_PER_ROOM = 50;

export type RoomMode = 'championship' | 'race';
export type RoomStatus = 'lobby' | 'in-progress' | 'finished';

export interface RoomPlayer {
  playerId: string;
  nickname: string;
}

export interface RoomRecord {
  code: string;
  mode: RoomMode;
  hostId: string;
  createdAt: number;
  isPublic: boolean;
  settings: RoomSettings;
  status: RoomStatus;
  players: RoomPlayer[];
}

export interface RoomRepository {
  create(record: RoomRecord): Promise<void>;
  findByCode(code: string): Promise<RoomRecord | null>;
  save(record: RoomRecord): Promise<void>;
  delete(code: string): Promise<void>;
  listPublicLobbies(): Promise<RoomRecord[]>;
  /** Tracks which room a player currently occupies, independent of game mode, so joining a new room can evict them from a previous one. */
  findActiveRoomCodeForPlayer(playerId: string): Promise<string | null>;
  setActiveRoomForPlayer(playerId: string, code: string): Promise<void>;
  clearActiveRoomForPlayer(playerId: string): Promise<void>;
}
