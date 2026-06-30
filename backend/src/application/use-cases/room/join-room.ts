import { MAX_PLAYERS_PER_ROOM, type RoomRecord, type RoomRepository } from '../../../domain/repositories/room-repository.js';
import { RoomNotFoundError } from '../../../domain/errors/room-not-found-error.js';
import { RoomFullError } from '../../../domain/errors/room-full-error.js';
import { RoomAlreadyStartedError } from '../../../domain/errors/room-already-started-error.js';
import type { GameMode } from '../../game-modes/game-mode.js';
import type { ChampionshipMode } from '../../game-modes/championship-mode.js';
import type { RaceMode } from '../../game-modes/race-mode.js';
import type { GameModeRegistry } from '../../../infrastructure/realtime/game-mode-registry.js';

export interface JoinRoomDeps {
  roomRepository: RoomRepository;
  championshipRegistry: GameModeRegistry<ChampionshipMode>;
  raceRegistry: GameModeRegistry<RaceMode>;
}

export interface JoinRoomInput {
  code: string;
  playerId: string;
  nickname: string;
}

export interface JoinRoomResult {
  record: RoomRecord;
  gameMode: GameMode;
}

export async function joinRoom(deps: JoinRoomDeps, input: JoinRoomInput): Promise<JoinRoomResult> {
  const record = await deps.roomRepository.findByCode(input.code);
  if (!record) {
    throw new RoomNotFoundError(`Sala "${input.code}" não encontrada`);
  }

  const alreadyJoined = record.players.some((player) => player.playerId === input.playerId);
  if (!alreadyJoined) {
    if (record.status !== 'lobby') {
      throw new RoomAlreadyStartedError(`Sala "${input.code}" já foi iniciada`);
    }
    if (record.players.length >= MAX_PLAYERS_PER_ROOM) {
      throw new RoomFullError(`Sala "${input.code}" está cheia`);
    }
  }

  const registry = record.mode === 'championship' ? deps.championshipRegistry : deps.raceRegistry;
  const gameMode = registry.get(record.code);
  if (!gameMode) {
    throw new RoomNotFoundError(`Sala "${input.code}" não encontrada`);
  }

  gameMode.joinPlayer(input.playerId, input.nickname);

  if (!alreadyJoined) {
    record.players.push({ playerId: input.playerId, nickname: input.nickname });
    await deps.roomRepository.save(record);
  }

  return { record, gameMode };
}
