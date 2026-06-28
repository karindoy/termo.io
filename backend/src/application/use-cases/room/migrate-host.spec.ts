import { describe, expect, it } from 'vitest';
import { createRoom, type CreateRoomDeps } from './create-room.js';
import { joinRoom } from './join-room.js';
import { migrateHost } from './migrate-host.js';
import { InMemoryRoomRepository } from '../../../infrastructure/persistence/rooms/in-memory-room-repository.js';
import { GameModeRegistry } from '../../../infrastructure/realtime/game-mode-registry.js';
import { RoundMode } from '../../game-modes/round-mode.js';
import { FastMode } from '../../game-modes/fast-mode.js';
import { Word } from '../../../domain/entities/word.js';
import type { WordRepository } from '../../../domain/repositories/word-repository.js';
import { RoomNotFoundError } from '../../../domain/errors/room-not-found-error.js';

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

describe('migrateHost', () => {
  it('transfers hostId to the longest-connected remaining player', async () => {
    const deps = createDeps();
    const room = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'round' });
    await joinRoom(deps, { code: room.code, playerId: 'p2', nickname: 'Bia' });
    await joinRoom(deps, { code: room.code, playerId: 'p3', nickname: 'Cia' });

    const { record, newHostId } = await migrateHost(deps, { code: room.code });

    expect(newHostId).toBe('p2');
    expect(record.hostId).toBe('p2');
  });

  it('returns a null newHostId when the disconnected host is the only player', async () => {
    const deps = createDeps();
    const room = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'round' });

    const { newHostId } = await migrateHost(deps, { code: room.code });

    expect(newHostId).toBeNull();
  });

  it('throws RoomNotFoundError for an unknown code', async () => {
    const deps = createDeps();
    await expect(migrateHost(deps, { code: 'NOPENOPE' })).rejects.toThrow(RoomNotFoundError);
  });
});
