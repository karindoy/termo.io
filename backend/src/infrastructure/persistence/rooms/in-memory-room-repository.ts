import type { RoomRecord, RoomRepository } from '../../../domain/repositories/room-repository.js';

export class InMemoryRoomRepository implements RoomRepository {
  private readonly rooms = new Map<string, RoomRecord>();
  private readonly activeRoomByPlayer = new Map<string, string>();

  async create(record: RoomRecord): Promise<void> {
    this.rooms.set(record.code, structuredClone(record));
  }

  async findByCode(code: string): Promise<RoomRecord | null> {
    const record = this.rooms.get(code);
    return record ? structuredClone(record) : null;
  }

  async save(record: RoomRecord): Promise<void> {
    this.rooms.set(record.code, structuredClone(record));
  }

  async delete(code: string): Promise<void> {
    this.rooms.delete(code);
  }

  async listPublicLobbies(): Promise<RoomRecord[]> {
    return Array.from(this.rooms.values())
      .filter((record) => record.isPublic && record.status === 'lobby')
      .map((record) => structuredClone(record));
  }

  async findActiveRoomCodeForPlayer(playerId: string): Promise<string | null> {
    return this.activeRoomByPlayer.get(playerId) ?? null;
  }

  async setActiveRoomForPlayer(playerId: string, code: string): Promise<void> {
    this.activeRoomByPlayer.set(playerId, code);
  }

  async clearActiveRoomForPlayer(playerId: string): Promise<void> {
    this.activeRoomByPlayer.delete(playerId);
  }
}
