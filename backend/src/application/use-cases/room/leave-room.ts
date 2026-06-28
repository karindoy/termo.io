import type { RoomRecord, RoomRepository } from '../../../domain/repositories/room-repository.js';
import { RoomNotFoundError } from '../../../domain/errors/room-not-found-error.js';

export interface LeaveRoomDeps {
  roomRepository: RoomRepository;
}

export interface LeaveRoomInput {
  code: string;
  playerId: string;
}

export interface LeaveRoomResult {
  record: RoomRecord;
  hostMigratedTo: string | null;
}

export async function leaveRoom(deps: LeaveRoomDeps, input: LeaveRoomInput): Promise<LeaveRoomResult> {
  const record = await deps.roomRepository.findByCode(input.code);
  if (!record) {
    throw new RoomNotFoundError(`Sala "${input.code}" não encontrada`);
  }

  record.players = record.players.filter((player) => player.playerId !== input.playerId);

  let hostMigratedTo: string | null = null;
  if (record.hostId === input.playerId && record.players.length > 0) {
    hostMigratedTo = record.players[0]!.playerId;
    record.hostId = hostMigratedTo;
  }

  await deps.roomRepository.save(record);
  return { record, hostMigratedTo };
}
