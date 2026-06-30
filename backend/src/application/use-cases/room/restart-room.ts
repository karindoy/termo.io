import type { RoomRecord, RoomRepository } from '../../../domain/repositories/room-repository.js';
import type { WordRepository } from '../../../domain/repositories/word-repository.js';
import { RoomNotFoundError } from '../../../domain/errors/room-not-found-error.js';
import { UnauthorizedHostActionError } from '../../../domain/errors/unauthorized-host-action-error.js';
import { ChampionshipMode } from '../../game-modes/championship-mode.js';
import { RaceMode } from '../../game-modes/race-mode.js';
import type { GameModeRegistry } from '../../../infrastructure/realtime/game-mode-registry.js';

export interface RestartRoomDeps {
  roomRepository: RoomRepository;
  wordRepository: WordRepository;
  championshipRegistry: GameModeRegistry<ChampionshipMode>;
  raceRegistry: GameModeRegistry<RaceMode>;
}

export interface RestartRoomInput {
  code: string;
  playerId: string;
}

export async function restartRoom(deps: RestartRoomDeps, input: RestartRoomInput): Promise<{ record: RoomRecord; gameMode: ChampionshipMode | RaceMode }> {
  const record = await deps.roomRepository.findByCode(input.code);
  if (!record) throw new RoomNotFoundError(`Sala "${input.code}" não encontrada`);
  if (record.hostId !== input.playerId) throw new UnauthorizedHostActionError('Somente o host pode reiniciar a partida');

  if (record.mode === 'championship') {
    const gameMode = new ChampionshipMode(record.code, deps.wordRepository, {
      wordCount: record.settings.wordCount,
      maxAttempts: record.settings.maxAttempts,
      timeLimitMs: record.settings.timeLimitMs,
    });
    for (const player of record.players) {
      gameMode.joinPlayer(player.playerId, player.nickname);
    }
    deps.championshipRegistry.register(record.code, gameMode);
    gameMode.start();
    record.status = 'in-progress';
    await deps.roomRepository.save(record);
    return { record, gameMode };
  } else {
    const gameMode = new RaceMode(record.code, deps.wordRepository, {
      wordCount: record.settings.wordCount,
      timeLimitMs: record.settings.timeLimitMs,
    });
    for (const player of record.players) {
      gameMode.joinPlayer(player.playerId, player.nickname);
    }
    deps.raceRegistry.register(record.code, gameMode);
    gameMode.start();
    record.status = 'in-progress';
    await deps.roomRepository.save(record);
    return { record, gameMode };
  }
}
