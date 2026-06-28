import type { RoomRecord, RoomRepository } from '../../../domain/repositories/room-repository.js';
import { RoomNotFoundError } from '../../../domain/errors/room-not-found-error.js';

export interface MigrateHostDeps {
  roomRepository: RoomRepository;
}

export interface MigrateHostInput {
  code: string;
}

export interface MigrateHostResult {
  record: RoomRecord;
  newHostId: string | null;
}

export async function migrateHost(deps: MigrateHostDeps, input: MigrateHostInput): Promise<MigrateHostResult> {
  const record = await deps.roomRepository.findByCode(input.code);
  if (!record) {
    throw new RoomNotFoundError(`Sala "${input.code}" não encontrada`);
  }

  const nextHost = record.players.find((player) => player.playerId !== record.hostId);
  if (!nextHost) {
    return { record, newHostId: null };
  }

  record.hostId = nextHost.playerId;
  await deps.roomRepository.save(record);
  return { record, newHostId: nextHost.playerId };
}
