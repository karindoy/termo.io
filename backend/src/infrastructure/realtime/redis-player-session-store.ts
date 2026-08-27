import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { PlayerSessionStore } from './player-session-store.js';

// Mirrors ROOM_TTL_SECONDS in redis-room-repository.ts so a session never outlives
// the room record it authenticates against, and vice versa.
const SESSION_TTL_SECONDS = 6 * 60 * 60;

function sessionKey(code: string): string {
  return `session:${code}`;
}

export class RedisPlayerSessionStore implements PlayerSessionStore {
  constructor(private readonly redis: Redis) {}

  async issue(code: string, playerId: string): Promise<string> {
    const secret = randomUUID();
    const key = sessionKey(code);
    await this.redis.hset(key, playerId, secret);
    await this.redis.expire(key, SESSION_TTL_SECONDS);
    return secret;
  }

  async verify(code: string, playerId: string, secret: string | undefined): Promise<boolean> {
    if (!secret) return false;
    const stored = await this.redis.hget(sessionKey(code), playerId);
    return stored === secret;
  }

  async clear(code: string): Promise<void> {
    await this.redis.del(sessionKey(code));
  }
}
