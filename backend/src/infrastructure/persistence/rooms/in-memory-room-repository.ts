import type { RoomRecord, RoomRepository } from '../../../domain/repositories/room-repository.js';

export class InMemoryRoomRepository implements RoomRepository {
  private readonly rooms = new Map<string, RoomRecord>();

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

  async listPublicLobbies(): Promise<RoomRecord[]> {
    return Array.from(this.rooms.values())
      .filter((record) => record.isPublic && record.status === 'lobby')
      .map((record) => structuredClone(record));
  }
}
