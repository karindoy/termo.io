import Fastify from 'fastify';
import { Server } from 'socket.io';
import { env } from './infrastructure/config/env.js';
import { healthRoute } from './presentation/http/routes/health.js';
import { roomsRoutes } from './presentation/http/routes/rooms.js';
import { registerRoundModeHandlers } from './presentation/sockets/handlers/register-round-mode-handlers.js';
import { registerFastModeHandlers } from './presentation/sockets/handlers/register-fast-mode-handlers.js';
import { InMemoryWordRepository } from './infrastructure/persistence/words/in-memory-word-repository.js';
import { createRedisClient } from './infrastructure/persistence/redis/redis-client.js';
import { RedisRoomRepository } from './infrastructure/persistence/redis/redis-room-repository.js';
import { GameModeRegistry } from './infrastructure/realtime/game-mode-registry.js';
import type { RoundMode } from './application/game-modes/round-mode.js';
import type { FastMode } from './application/game-modes/fast-mode.js';
import cors from '@fastify/cors';

async function main(): Promise<void> {
  const app = Fastify({ logger: true });

  const wordRepository = new InMemoryWordRepository();
  const redis = createRedisClient();
  const roomRepository = new RedisRoomRepository(redis);
  const roundRegistry = new GameModeRegistry<RoundMode>();
  const fastRegistry = new GameModeRegistry<FastMode>();

  const roomDeps = { roomRepository, wordRepository, roundRegistry, fastRegistry };

  await app.register(healthRoute);
  await app.register((instance) => roomsRoutes(instance, roomDeps));
  await app.register(cors, {
    origin: true,
  });
  await app.ready();

  const io = new Server(app.server, {
    cors: { origin: env.corsOrigin },
  });

  registerRoundModeHandlers(io.of('/round'), roundRegistry, roomDeps);
  registerFastModeHandlers(io.of('/fast'), fastRegistry, roomDeps);

  await app.listen({ port: env.port, host: '0.0.0.0' });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
