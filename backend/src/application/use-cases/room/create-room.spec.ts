import { describe, expect, it } from 'vitest';
import { createRoom, type CreateRoomDeps } from './create-room.js';
import { InMemoryRoomRepository } from '../../../infrastructure/persistence/rooms/in-memory-room-repository.js';
import { GameModeRegistry } from '../../../infrastructure/realtime/game-mode-registry.js';
import { RoundMode } from '../../game-modes/round-mode.js';
import { FastMode } from '../../game-modes/fast-mode.js';
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
    roundRegistry: new GameModeRegistry<RoundMode>(),
    fastRegistry: new GameModeRegistry<FastMode>(),
  };
}

describe('createRoom', () => {
  it('generates a valid room code and persists a RoomRecord with the host as the only player', async () => {
    const deps = createDeps();

    const record = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'round' });

    expect(record.code).toMatch(ROOM_CODE_PATTERN);
    expect(record.hostId).toBe('p1');
    expect(record.players).toEqual([{ playerId: 'p1', nickname: 'Ana' }]);

    const persisted = await deps.roomRepository.findByCode(record.code);
    expect(persisted).toEqual(record);
  });

  it('registers and starts a RoundMode instance for mode "round"', async () => {
    const deps = createDeps();

    const record = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'round' });

    const gameMode = deps.roundRegistry.get(record.code);
    expect(gameMode).toBeInstanceOf(RoundMode);
    expect(deps.fastRegistry.get(record.code)).toBeUndefined();
  });

  it('registers and starts a FastMode instance for mode "fast"', async () => {
    const deps = createDeps();

    const record = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'fast' });

    const gameMode = deps.fastRegistry.get(record.code);
    expect(gameMode).toBeInstanceOf(FastMode);
    expect(deps.roundRegistry.get(record.code)).toBeUndefined();
  });
});
