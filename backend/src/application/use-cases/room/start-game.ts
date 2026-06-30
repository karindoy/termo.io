import type { RoomRecord, RoomRepository } from '../../../domain/repositories/room-repository.js';
import { RoomNotFoundError } from '../../../domain/errors/room-not-found-error.js';
import { UnauthorizedHostActionError } from '../../../domain/errors/unauthorized-host-action-error.js';
import { RoomAlreadyStartedError } from '../../../domain/errors/room-already-started-error.js';
import type { ChampionshipMode } from '../../game-modes/championship-mode.js';
import type { RaceMode } from '../../game-modes/race-mode.js';
import type { GameModeRegistry } from '../../../infrastructure/realtime/game-mode-registry.js';

export interface StartGameDeps {
  roomRepository: RoomRepository;
  championshipRegistry: GameModeRegistry<ChampionshipMode>;
  raceRegistry: GameModeRegistry<RaceMode>;
}

export interface StartGameInput {
  code: string;
  playerId: string;
}

export async function startGame(deps: StartGameDeps, input: StartGameInput): Promise<RoomRecord> {
  const record = await deps.roomRepository.findByCode(input.code);
  if (!record) {
    throw new RoomNotFoundError(`Sala "${input.code}" não encontrada`);
  }
  if (record.hostId !== input.playerId) {
    throw new UnauthorizedHostActionError('Somente o host pode iniciar a partida');
  }
  if (record.status !== 'lobby') {
    throw new RoomAlreadyStartedError(`Sala "${input.code}" já foi iniciada`);
  }

  if (record.mode === 'championship') {
    const gameMode = deps.championshipRegistry.get(record.code);
    if (!gameMode) throw new RoomNotFoundError(`Sala "${input.code}" não encontrada`);
    gameMode.start();
  } else {
    const gameMode = deps.raceRegistry.get(record.code);
    if (!gameMode) throw new RoomNotFoundError(`Sala "${input.code}" não encontrada`);
    gameMode.start();
  }

  record.status = 'in-progress';
  await deps.roomRepository.save(record);
  return record;
}
