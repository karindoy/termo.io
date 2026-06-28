import { Redis } from 'ioredis';
import { env } from '../../config/env.js';

export function createRedisClient(): Redis {
  return new Redis(env.redisUrl);
}
