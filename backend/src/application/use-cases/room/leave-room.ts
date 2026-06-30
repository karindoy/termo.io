import type { RoomRecord, RoomRepository } from '../../../domain/repositories/room-repository.js';
import { RoomNotFoundError } from '../../../domain/errors/room-not-found-error.js';
import type { ChampionshipMode } from '../../game-modes/championship-mode.js';
import type { RaceMode } from '../../game-modes/race-mode.js';
import type { GameModeRegistry } from '../../../infrastructure/realtime/game-mode-registry.js';
import type { PlayerSessionStore } from '../../../infrastructure/realtime/player-session-store.js';

export interface LeaveRoomDeps {
  roomRepository: RoomRepository;
  championshipRegistry: GameModeRegistry<ChampionshipMode>;
  raceRegistry: GameModeRegistry<RaceMode>;
  sessionStore: PlayerSessionStore;
}

export interface LeaveRoomInput {
  code: string;
  playerId: string;
}

export interface LeaveRoomResult {
  code: string;
  /** null once the room has been deleted, i.e. the leaving player was the last one in it. */
  record: RoomRecord | null;
  hostMigratedTo: string | null;
  deleted: boolean;
}

export async function leaveRoom(deps: LeaveRoomDeps, input: LeaveRoomInput): Promise<LeaveRoomResult> {
  const record = await deps.roomRepository.findByCode(input.code);
  if (!record) {
    throw new RoomNotFoundError(`Sala "${input.code}" não encontrada`);
  }

  record.players = record.players.filter((player) => player.playerId !== input.playerId);
  await deps.roomRepository.clearActiveRoomForPlayer(input.playerId);

  if (record.players.length === 0) {
    await deps.roomRepository.delete(input.code);
    const registry = record.mode === 'championship' ? deps.championshipRegistry : deps.raceRegistry;
    registry.remove(input.code);
    deps.sessionStore.clear(input.code);
    return { code: input.code, record: null, hostMigratedTo: null, deleted: true };
  }

  let hostMigratedTo: string | null = null;
  if (record.hostId === input.playerId) {
    hostMigratedTo = record.players[0]!.playerId;
    record.hostId = hostMigratedTo;
  }

  await deps.roomRepository.save(record);
  return { code: input.code, record, hostMigratedTo, deleted: false };
}
