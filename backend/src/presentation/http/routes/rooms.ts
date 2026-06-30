import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createRoom, type CreateRoomDeps } from '../../../application/use-cases/room/create-room.js';
import { listPublicRooms, type ListPublicRoomsDeps } from '../../../application/use-cases/room/list-public-rooms.js';
import {
  updateRoomSettings,
  type UpdateRoomSettingsDeps,
} from '../../../application/use-cases/room/update-room-settings.js';
import { startGame, type StartGameDeps } from '../../../application/use-cases/room/start-game.js';
import type { RoomRepository } from '../../../domain/repositories/room-repository.js';
import { ROOM_CODE_PATTERN } from '../../../domain/value-objects/room-code.js';
import { RoomNotFoundError } from '../../../domain/errors/room-not-found-error.js';
import { RoomFullError } from '../../../domain/errors/room-full-error.js';
import { RoomAlreadyStartedError } from '../../../domain/errors/room-already-started-error.js';
import { UnauthorizedHostActionError } from '../../../domain/errors/unauthorized-host-action-error.js';
import { InvalidRoomSettingsError } from '../../../domain/errors/invalid-room-settings-error.js';
import type { PlayerSessionStore } from '../../../infrastructure/realtime/player-session-store.js';

const roomSettingsBodySchema = z.object({
  wordCount: z.number().int().optional(),
  maxAttempts: z.number().int().optional(),
  timeLimitMs: z.number().int().optional(),
});

const createRoomBodySchema = z.object({
  hostId: z.string().min(1).max(64),
  nickname: z.string().min(1).max(24),
  mode: z.enum(['championship', 'race']),
  isPublic: z.boolean().optional(),
  settings: roomSettingsBodySchema.optional(),
});

const updateSettingsBodySchema = z.object({
  playerId: z.string().min(1).max(64),
  sessionSecret: z.string().min(1).max(64),
  settings: roomSettingsBodySchema,
});

const startGameBodySchema = z.object({
  playerId: z.string().min(1).max(64),
  sessionSecret: z.string().min(1).max(64),
});

export interface RoomsRoutesDeps extends CreateRoomDeps, ListPublicRoomsDeps, UpdateRoomSettingsDeps, StartGameDeps {
  roomRepository: RoomRepository;
  sessionStore: PlayerSessionStore;
}

function sendDomainError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof RoomNotFoundError) return reply.status(404).send({ message: error.message });
  if (error instanceof UnauthorizedHostActionError) return reply.status(403).send({ message: error.message });
  if (error instanceof RoomAlreadyStartedError) return reply.status(409).send({ message: error.message });
  if (error instanceof RoomFullError) return reply.status(409).send({ message: error.message });
  if (error instanceof InvalidRoomSettingsError) return reply.status(400).send({ message: error.message });
  throw error;
}

export async function roomsRoutes(app: FastifyInstance, deps: RoomsRoutesDeps): Promise<void> {
  app.post('/rooms', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = createRoomBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Dados de criação de sala inválidos' });
    }

    try {
      const record = await createRoom(deps, parsed.data);
      return reply.status(201).send(record);
    } catch (error) {
      return sendDomainError(reply, error);
    }
  });

  app.get('/rooms', async (_request, reply) => {
    const rooms = await listPublicRooms(deps);
    // playerId identifies a seat, not a secret — but there is no reason an
    // unauthenticated browse list needs to hand it out for every room either.
    const sanitized = rooms.map((room) => ({
      ...room,
      players: room.players.map((player) => ({ nickname: player.nickname })),
    }));
    return reply.send(sanitized);
  });

  app.get('/rooms/:code', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const code = (request.params as { code: string }).code;
    if (!ROOM_CODE_PATTERN.test(code)) {
      return reply.status(400).send({ message: 'Código de sala inválido' });
    }

    const record = await deps.roomRepository.findByCode(code);
    if (!record) {
      return reply.status(404).send({ message: `Sala "${code}" não encontrada` });
    }

    return reply.send(record);
  });

  app.patch('/rooms/:code/settings', async (request, reply) => {
    const code = (request.params as { code: string }).code;
    const parsed = updateSettingsBodySchema.safeParse(request.body);
    if (!ROOM_CODE_PATTERN.test(code) || !parsed.success) {
      return reply.status(400).send({ message: 'Dados de atualização de sala inválidos' });
    }
    if (!deps.sessionStore.verify(code, parsed.data.playerId, parsed.data.sessionSecret)) {
      return reply.status(401).send({ message: 'Sessão inválida — entre na sala novamente' });
    }

    try {
      const record = await updateRoomSettings(deps, { code, ...parsed.data });
      return reply.send(record);
    } catch (error) {
      return sendDomainError(reply, error);
    }
  });

  app.post('/rooms/:code/start', async (request, reply) => {
    const code = (request.params as { code: string }).code;
    const parsed = startGameBodySchema.safeParse(request.body);
    if (!ROOM_CODE_PATTERN.test(code) || !parsed.success) {
      return reply.status(400).send({ message: 'Dados de início de partida inválidos' });
    }
    if (!deps.sessionStore.verify(code, parsed.data.playerId, parsed.data.sessionSecret)) {
      return reply.status(401).send({ message: 'Sessão inválida — entre na sala novamente' });
    }

    try {
      const record = await startGame(deps, { code, ...parsed.data });
      return reply.send(record);
    } catch (error) {
      return sendDomainError(reply, error);
    }
  });
}
