import Fastify from 'fastify';
import { Server } from 'socket.io';
import { env } from './infrastructure/config/env.js';
import { healthRoute } from './presentation/http/routes/health.js';
import { roomsRoutes } from './presentation/http/routes/rooms.js';
import { registerChampionshipModeHandlers } from './presentation/sockets/handlers/register-championship-mode-handlers.js';
import { registerRaceModeHandlers } from './presentation/sockets/handlers/register-race-mode-handlers.js';
import { InMemoryWordRepository } from './infrastructure/persistence/words/in-memory-word-repository.js';
import { createRedisClient } from './infrastructure/persistence/redis/redis-client.js';
import { RedisRoomRepository } from './infrastructure/persistence/redis/redis-room-repository.js';
import { GameModeRegistry } from './infrastructure/realtime/game-mode-registry.js';
import { HostMigrationTracker } from './infrastructure/realtime/host-migration-tracker.js';
import { PlayerSessionStore } from './infrastructure/realtime/player-session-store.js';
import type { ChampionshipMode } from './application/game-modes/championship-mode.js';
import type { RaceMode } from './application/game-modes/race-mode.js';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

async function main(): Promise<void> {
  const app = Fastify({ logger: true });

  const wordRepository = new InMemoryWordRepository();
  const redis = createRedisClient();
  const roomRepository = new RedisRoomRepository(redis);
  const championshipRegistry = new GameModeRegistry<ChampionshipMode>();
  const raceRegistry = new GameModeRegistry<RaceMode>();
  const hostMigrationTracker = new HostMigrationTracker();
  const sessionStore = new PlayerSessionStore();

  await roomRepository.clearPublicLobbies();

  const roomDeps = { roomRepository, wordRepository, championshipRegistry, raceRegistry, sessionStore };

  await app.register(helmet);
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(healthRoute);
  await app.register((instance) => roomsRoutes(instance, roomDeps));
  await app.register(cors, {
    origin: env.corsOrigin,
  });
  await app.ready();

  const io = new Server(app.server, {
    cors: { origin: env.corsOrigin },
  });

  const restartRoomDeps = { roomRepository, wordRepository, championshipRegistry, raceRegistry };
  registerChampionshipModeHandlers(io.of('/championship'), championshipRegistry, roomDeps, hostMigrationTracker, sessionStore, restartRoomDeps);
  registerRaceModeHandlers(io.of('/race'), raceRegistry, roomDeps, hostMigrationTracker, sessionStore, restartRoomDeps);

  await app.listen({ port: env.port, host: '0.0.0.0' });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
