import type { RoomRecord, RoomRepository } from '../../../domain/repositories/room-repository.js';
import { RoomNotFoundError } from '../../../domain/errors/room-not-found-error.js';
import { UnauthorizedHostActionError } from '../../../domain/errors/unauthorized-host-action-error.js';
import { RoomAlreadyStartedError } from '../../../domain/errors/room-already-started-error.js';
import type { RoundMode } from '../../game-modes/round-mode.js';
import type { FastMode } from '../../game-modes/fast-mode.js';
import type { GameModeRegistry } from '../../../infrastructure/realtime/game-mode-registry.js';

export interface StartGameDeps {
  roomRepository: RoomRepository;
  roundRegistry: GameModeRegistry<RoundMode>;
  fastRegistry: GameModeRegistry<FastMode>;
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

  if (record.mode === 'round') {
    const gameMode = deps.roundRegistry.get(record.code);
    if (!gameMode) throw new RoomNotFoundError(`Sala "${input.code}" não encontrada`);
    gameMode.start();
  } else {
    const gameMode = deps.fastRegistry.get(record.code);
    if (!gameMode) throw new RoomNotFoundError(`Sala "${input.code}" não encontrada`);
    gameMode.start();
  }

  record.status = 'in-progress';
  await deps.roomRepository.save(record);
  return record;
}
