import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { submitDailyGuess, type SubmitDailyGuessDeps } from '../../../application/use-cases/daily/submit-daily-guess.js';
import {
  DAILY_GAME_MODES,
  DAILY_MODE_CONFIG,
  isDailyGameMode,
} from '../../../application/game-modes/daily-modes/daily-mode-config.js';
import { InvalidGuessError } from '../../../domain/errors/invalid-guess-error.js';
import { AttemptsExceededError } from '../../../domain/errors/attempts-exceeded-error.js';

const guessBodySchema = z.object({
  guesses: z
    .array(z.string().min(1).max(5))
    .min(1)
    .max(Math.max(...DAILY_GAME_MODES.map((mode) => DAILY_MODE_CONFIG[mode].maxAttempts))),
});

export interface DailyRoutesDeps extends SubmitDailyGuessDeps {}

function sendDomainError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof InvalidGuessError) return reply.status(400).send({ message: error.message });
  if (error instanceof AttemptsExceededError) return reply.status(409).send({ message: error.message });
  throw error;
}

export async function dailyRoutes(app: FastifyInstance, deps: DailyRoutesDeps): Promise<void> {
  app.get('/daily/:mode/config', async (request, reply) => {
    const mode = (request.params as { mode: string }).mode;
    if (!isDailyGameMode(mode)) {
      return reply.status(404).send({ message: `Modo diário "${mode}" não encontrado` });
    }
    return reply.send(DAILY_MODE_CONFIG[mode]);
  });

  app.post('/daily/:mode/guess', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const mode = (request.params as { mode: string }).mode;
    if (!isDailyGameMode(mode)) {
      return reply.status(404).send({ message: `Modo diário "${mode}" não encontrado` });
    }

    const parsed = guessBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Dados de tentativa inválidos' });
    }

    try {
      const result = submitDailyGuess(deps, { mode, guesses: parsed.data.guesses });
      return reply.send(result);
    } catch (error) {
      return sendDomainError(reply, error);
    }
  });
}
