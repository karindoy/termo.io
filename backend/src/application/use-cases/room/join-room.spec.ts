import { describe, expect, it } from 'vitest';
import { createRoom, type CreateRoomDeps } from './create-room.js';
import { joinRoom } from './join-room.js';
import { InMemoryRoomRepository } from '../../../infrastructure/persistence/rooms/in-memory-room-repository.js';
import { GameModeRegistry } from '../../../infrastructure/realtime/game-mode-registry.js';
import { RoundMode } from '../../game-modes/round-mode.js';
import { FastMode } from '../../game-modes/fast-mode.js';
import { Word } from '../../../domain/entities/word.js';
import type { WordRepository } from '../../../domain/repositories/word-repository.js';
import { RoomNotFoundError } from '../../../domain/errors/room-not-found-error.js';
import { RoomFullError } from '../../../domain/errors/room-full-error.js';
import { MAX_PLAYERS_PER_ROOM } from '../../../domain/repositories/room-repository.js';

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

describe('joinRoom', () => {
  it('adds a new player to the roster and to the live game', async () => {
    const deps = createDeps();
    const room = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'round' });

    const { record, gameMode } = await joinRoom(deps, { code: room.code, playerId: 'p2', nickname: 'Bia' });

    expect(record.players).toEqual([
      { playerId: 'p1', nickname: 'Ana' },
      { playerId: 'p2', nickname: 'Bia' },
    ]);
    expect((gameMode as RoundMode).getRoom().players.has('p2')).toBe(true);
  });

  it('throws RoomNotFoundError for an unknown code', async () => {
    const deps = createDeps();
    await expect(joinRoom(deps, { code: 'NOPENOPE', playerId: 'p2', nickname: 'Bia' })).rejects.toThrow(
      RoomNotFoundError,
    );
  });

  it('does not double-count a reconnecting player against the room cap', async () => {
    const deps = createDeps();
    const room = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'round' });

    await joinRoom(deps, { code: room.code, playerId: 'p1', nickname: 'Ana' });

    const persisted = await deps.roomRepository.findByCode(room.code);
    expect(persisted?.players).toHaveLength(1);
  });

  it('throws RoomFullError once the room is at capacity', async () => {
    const deps = createDeps();
    const room = await createRoom(deps, { hostId: 'host', nickname: 'Host', mode: 'round' });

    for (let i = 0; i < MAX_PLAYERS_PER_ROOM - 1; i++) {
      await joinRoom(deps, { code: room.code, playerId: `extra-${i}`, nickname: `P${i}` });
    }

    await expect(joinRoom(deps, { code: room.code, playerId: 'one-too-many', nickname: 'Late' })).rejects.toThrow(
      RoomFullError,
    );
  });
});
