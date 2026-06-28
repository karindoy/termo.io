import type { Redis } from 'ioredis';
import type { RoomRecord, RoomRepository } from '../../../domain/repositories/room-repository.js';

const ROOM_TTL_SECONDS = 6 * 60 * 60;
const PUBLIC_LOBBIES_KEY = 'rooms:public-lobbies';

function roomKey(code: string): string {
  return `room:${code}`;
}

export class RedisRoomRepository implements RoomRepository {
  constructor(private readonly redis: Redis) {}

  async create(record: RoomRecord): Promise<void> {
    await this.redis.set(roomKey(record.code), JSON.stringify(record), 'EX', ROOM_TTL_SECONDS);
    await this.syncPublicLobbyMembership(record);
  }

  async findByCode(code: string): Promise<RoomRecord | null> {
    const raw = await this.redis.get(roomKey(code));
    return raw ? (JSON.parse(raw) as RoomRecord) : null;
  }

  async save(record: RoomRecord): Promise<void> {
    await this.redis.set(roomKey(record.code), JSON.stringify(record), 'KEEPTTL');
    await this.syncPublicLobbyMembership(record);
  }

  async listPublicLobbies(): Promise<RoomRecord[]> {
    const codes = await this.redis.smembers(PUBLIC_LOBBIES_KEY);
    const records: RoomRecord[] = [];

    for (const code of codes) {
      const record = await this.findByCode(code);
      if (record && record.isPublic && record.status === 'lobby') {
        records.push(record);
      } else {
        await this.redis.srem(PUBLIC_LOBBIES_KEY, code);
      }
    }

    return records;
  }

  private async syncPublicLobbyMembership(record: RoomRecord): Promise<void> {
    if (record.isPublic && record.status === 'lobby') {
      await this.redis.sadd(PUBLIC_LOBBIES_KEY, record.code);
    } else {
      await this.redis.srem(PUBLIC_LOBBIES_KEY, record.code);
    }
  }
}
