import Fastify from 'fastify';
import { Server } from 'socket.io';
import { env } from './infrastructure/config/env.js';
import { healthRoute } from './presentation/http/routes/health.js';
import { registerRoundModeHandlers } from './presentation/sockets/handlers/register-round-mode-handlers.js';
import { registerFastModeHandlers } from './presentation/sockets/handlers/register-fast-mode-handlers.js';
import { InMemoryWordRepository } from './infrastructure/persistence/words/in-memory-word-repository.js';
import { RoundMode } from './application/game-modes/round-mode.js';
import { FastMode } from './application/game-modes/fast-mode.js';

async function main(): Promise<void> {
  const app = Fastify({ logger: true });
  await app.register(healthRoute);
  await app.ready();

  const io = new Server(app.server, {
    cors: { origin: env.corsOrigin },
  });

  const wordRepository = new InMemoryWordRepository();

  const roundMode = new RoundMode('room-round', wordRepository);
  registerRoundModeHandlers(io.of('/round'), roundMode);
  roundMode.start();

  const fastMode = new FastMode('room-fast', wordRepository);
  registerFastModeHandlers(io.of('/fast'), fastMode);
  fastMode.start();

  await app.listen({ port: env.port, host: '0.0.0.0' });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
