import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createRoom, type CreateRoomDeps } from '../../../application/use-cases/room/create-room.js';
import type { RoomRepository } from '../../../domain/repositories/room-repository.js';
import { ROOM_CODE_PATTERN } from '../../../domain/value-objects/room-code.js';

const createRoomBodySchema = z.object({
  hostId: z.string().min(1).max(64),
  nickname: z.string().min(1).max(24),
  mode: z.enum(['round', 'fast']),
});

export interface RoomsRoutesDeps extends CreateRoomDeps {
  roomRepository: RoomRepository;
}

export async function roomsRoutes(app: FastifyInstance, deps: RoomsRoutesDeps): Promise<void> {
  app.post('/rooms', async (request, reply) => {
    const parsed = createRoomBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Dados de criação de sala inválidos' });
    }

    const record = await createRoom(deps, parsed.data);
    return reply.status(201).send(record);
  });

  app.get('/rooms/:code', async (request, reply) => {
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
}
