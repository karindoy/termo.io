import type { RoomRecord, RoomRepository } from '../../../domain/repositories/room-repository.js';
import { createRoomSettings, type RoomSettings } from '../../../domain/value-objects/room-settings.js';
import { RoomNotFoundError } from '../../../domain/errors/room-not-found-error.js';
import { UnauthorizedHostActionError } from '../../../domain/errors/unauthorized-host-action-error.js';
import { RoomAlreadyStartedError } from '../../../domain/errors/room-already-started-error.js';
import type { RoundMode } from '../../game-modes/round-mode.js';
import type { FastMode } from '../../game-modes/fast-mode.js';
import type { GameModeRegistry } from '../../../infrastructure/realtime/game-mode-registry.js';

export interface UpdateRoomSettingsDeps {
  roomRepository: RoomRepository;
  roundRegistry: GameModeRegistry<RoundMode>;
  fastRegistry: GameModeRegistry<FastMode>;
}

export interface UpdateRoomSettingsInput {
  code: string;
  playerId: string;
  settings: Partial<RoomSettings>;
}

export async function updateRoomSettings(
  deps: UpdateRoomSettingsDeps,
  input: UpdateRoomSettingsInput,
): Promise<RoomRecord> {
  const record = await deps.roomRepository.findByCode(input.code);
  if (!record) {
    throw new RoomNotFoundError(`Sala "${input.code}" não encontrada`);
  }
  if (record.hostId !== input.playerId) {
    throw new UnauthorizedHostActionError('Somente o host pode alterar as configurações da sala');
  }
  if (record.status !== 'lobby') {
    throw new RoomAlreadyStartedError(`Sala "${input.code}" já foi iniciada`);
  }

  const settings = createRoomSettings({ ...record.settings, ...input.settings });
  record.settings = settings;

  if (record.mode === 'round') {
    deps.roundRegistry
      .get(record.code)
      ?.updateOptions({ wordCount: settings.wordCount, maxAttempts: settings.maxAttempts, timeLimitMs: settings.timeLimitMs });
  } else {
    deps.fastRegistry.get(record.code)?.updateOptions({ wordCount: settings.wordCount, timeLimitMs: settings.timeLimitMs });
  }

  await deps.roomRepository.save(record);
  return record;
}
