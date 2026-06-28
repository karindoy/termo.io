import Fastify from 'fastify';
import { Server } from 'socket.io';
import { env } from './infrastructure/config/env.js';
import { healthRoute } from './presentation/http/routes/health.js';
import { registerGameHandlers } from './presentation/sockets/handlers/register-game-handlers.js';
import { InMemoryWordRepository } from './infrastructure/persistence/words/in-memory-word-repository.js';
import { SingleWordMode } from './application/game-modes/single-word-mode.js';

async function main(): Promise<void> {
  const app = Fastify({ logger: true });
  await app.register(healthRoute);
  await app.ready();

  const io = new Server(app.server, {
    cors: { origin: env.corsOrigin },
  });

  const wordRepository = new InMemoryWordRepository();
  const gameMode = new SingleWordMode('room-1', wordRepository);
  gameMode.start();

  registerGameHandlers(io, gameMode);

  await app.listen({ port: env.port, host: '0.0.0.0' });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
