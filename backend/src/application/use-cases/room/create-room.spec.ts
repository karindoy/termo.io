import { describe, expect, it } from 'vitest';
import { createRoom, type CreateRoomDeps } from './create-room.js';
import { InMemoryRoomRepository } from '../../../infrastructure/persistence/rooms/in-memory-room-repository.js';
import { GameModeRegistry } from '../../../infrastructure/realtime/game-mode-registry.js';
import { ChampionshipMode } from '../../game-modes/championship-mode.js';
import { RaceMode } from '../../game-modes/race-mode.js';
import { Word } from '../../../domain/entities/word.js';
import type { WordRepository } from '../../../domain/repositories/word-repository.js';
import { ROOM_CODE_PATTERN } from '../../../domain/value-objects/room-code.js';

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

describe('createRoom', () => {
  it('generates a valid room code and persists a RoomRecord with the host as the only player', async () => {
    const deps = createDeps();

    const record = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'championship' });

    expect(record.code).toMatch(ROOM_CODE_PATTERN);
    expect(record.hostId).toBe('p1');
    expect(record.players).toEqual([{ playerId: 'p1', nickname: 'Ana' }]);

    const persisted = await deps.roomRepository.findByCode(record.code);
    expect(persisted).toEqual(record);
  });

  it('registers and starts a ChampionshipMode instance for mode "championship"', async () => {
    const deps = createDeps();

    const record = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'championship' });

    const gameMode = deps.championshipRegistry.get(record.code);
    expect(gameMode).toBeInstanceOf(ChampionshipMode);
    expect(deps.raceRegistry.get(record.code)).toBeUndefined();
  });

  it('registers and starts a RaceMode instance for mode "race"', async () => {
    const deps = createDeps();

    const record = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'race' });

    const gameMode = deps.raceRegistry.get(record.code);
    expect(gameMode).toBeInstanceOf(RaceMode);
    expect(deps.championshipRegistry.get(record.code)).toBeUndefined();
  });
});
