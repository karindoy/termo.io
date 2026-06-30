import { describe, expect, it } from 'vitest';
import { createRoom, type CreateRoomDeps } from './create-room.js';
import { startGame } from './start-game.js';
import { updateRoomSettings } from './update-room-settings.js';
import { InMemoryRoomRepository } from '../../../infrastructure/persistence/rooms/in-memory-room-repository.js';
import { GameModeRegistry } from '../../../infrastructure/realtime/game-mode-registry.js';
import { ChampionshipMode } from '../../game-modes/championship-mode.js';
import { RaceMode } from '../../game-modes/race-mode.js';
import { Word } from '../../../domain/entities/word.js';
import type { WordRepository } from '../../../domain/repositories/word-repository.js';
import { RoomNotFoundError } from '../../../domain/errors/room-not-found-error.js';
import { UnauthorizedHostActionError } from '../../../domain/errors/unauthorized-host-action-error.js';
import { RoomAlreadyStartedError } from '../../../domain/errors/room-already-started-error.js';
import { InvalidRoomSettingsError } from '../../../domain/errors/invalid-room-settings-error.js';

class FixedWordRepository implements WordRepository {
  getRandomWord(): Word {
    return Word.create('TERMO');
  }

  isValidGuess(): boolean {
    return true;
  }
}

function createDeps(): CreateRoomDeps {
  return {
    roomRepository: new InMemoryRoomRepository(),
    wordRepository: new FixedWordRepository(),
    championshipRegistry: new GameModeRegistry<ChampionshipMode>(),
    raceRegistry: new GameModeRegistry<RaceMode>(),
  };
}

describe('updateRoomSettings', () => {
  it('lets the host change settings while the room is in the lobby', async () => {
    const deps = createDeps();
    const room = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'championship' });

    const record = await updateRoomSettings(deps, { code: room.code, playerId: 'p1', settings: { wordCount: 3 } });

    expect(record.settings).toEqual({ wordCount: 3, maxAttempts: 6, timeLimitMs: 300_000 });
    const persisted = await deps.roomRepository.findByCode(room.code);
    expect(persisted?.settings.wordCount).toBe(3);
  });

  it('throws UnauthorizedHostActionError for a non-host caller', async () => {
    const deps = createDeps();
    const room = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'championship' });

    await expect(
      updateRoomSettings(deps, { code: room.code, playerId: 'p2', settings: { wordCount: 3 } }),
    ).rejects.toThrow(UnauthorizedHostActionError);
  });

  it('throws RoomAlreadyStartedError once the game has started', async () => {
    const deps = createDeps();
    const room = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'championship' });
    await startGame(deps, { code: room.code, playerId: 'p1' });

    await expect(
      updateRoomSettings(deps, { code: room.code, playerId: 'p1', settings: { wordCount: 3 } }),
    ).rejects.toThrow(RoomAlreadyStartedError);
  });

  it('throws InvalidRoomSettingsError for out-of-bounds settings', async () => {
    const deps = createDeps();
    const room = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'championship' });

    await expect(
      updateRoomSettings(deps, { code: room.code, playerId: 'p1', settings: { wordCount: 16 } }),
    ).rejects.toThrow(InvalidRoomSettingsError);
  });

  it('throws RoomNotFoundError for an unknown code', async () => {
    const deps = createDeps();
    await expect(
      updateRoomSettings(deps, { code: 'NOPENOPE', playerId: 'p1', settings: { wordCount: 3 } }),
    ).rejects.toThrow(RoomNotFoundError);
  });
});
