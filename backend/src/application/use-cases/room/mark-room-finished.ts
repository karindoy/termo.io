import type { RoomRecord, RoomRepository } from '../../../domain/repositories/room-repository.js';
import { withRoomLock } from '../../../infrastructure/realtime/room-lock.js';

export interface MarkRoomFinishedDeps {
  roomRepository: RoomRepository;
}

export async function markRoomFinished(deps: MarkRoomFinishedDeps, code: string): Promise<RoomRecord | null> {
  return withRoomLock(code, () => markRoomFinishedLocked(deps, code));
}

async function markRoomFinishedLocked(deps: MarkRoomFinishedDeps, code: string): Promise<RoomRecord | null> {
  const record = await deps.roomRepository.findByCode(code);
  if (!record) return null;

  record.status = 'finished';
  await deps.roomRepository.save(record);
  return record;
}
