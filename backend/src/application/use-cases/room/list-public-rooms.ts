import type { RoomRecord, RoomRepository } from '../../../domain/repositories/room-repository.js';

export interface ListPublicRoomsDeps {
  roomRepository: RoomRepository;
}

export async function listPublicRooms(deps: ListPublicRoomsDeps): Promise<RoomRecord[]> {
  return deps.roomRepository.listPublicLobbies();
}
