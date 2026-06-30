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
  listPublicLobbies(): Promise<RoomRecord[]>;
}
