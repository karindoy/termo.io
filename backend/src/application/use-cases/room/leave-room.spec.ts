import { describe, expect, it } from 'vitest';
import { createRoom, type CreateRoomDeps } from './create-room.js';
import { joinRoom } from './join-room.js';
import { leaveRoom } from './leave-room.js';
import { InMemoryRoomRepository } from '../../../infrastructure/persistence/rooms/in-memory-room-repository.js';
import { GameModeRegistry } from '../../../infrastructure/realtime/game-mode-registry.js';
import { ChampionshipMode } from '../../game-modes/championship-mode.js';
import { RaceMode } from '../../game-modes/race-mode.js';
import { Word } from '../../../domain/entities/word.js';
import type { WordRepository } from '../../../domain/repositories/word-repository.js';
import { RoomNotFoundError } from '../../../domain/errors/room-not-found-error.js';
import { PlayerSessionStore } from '../../../infrastructure/realtime/player-session-store.js';

class FixedWordRepository implements WordRepository {
  getRandomWord(): Word {
    return Word.create('TERMO');
  }

  isValidGuess(): boolean {
    return true;
  }
}

function createDeps(): CreateRoomDeps & { sessionStore: PlayerSessionStore } {
  return {
    roomRepository: new InMemoryRoomRepository(),
    wordRepository: new FixedWordRepository(),
    championshipRegistry: new GameModeRegistry<ChampionshipMode>(),
    raceRegistry: new GameModeRegistry<RaceMode>(),
    sessionStore: new PlayerSessionStore(),
  };
}

describe('leaveRoom', () => {
  it('removes the player from the roster', async () => {
    const deps = createDeps();
    const room = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'championship' });
    await joinRoom(deps, { code: room.code, playerId: 'p2', nickname: 'Bia' });

    const { record, hostMigratedTo } = await leaveRoom(deps, { code: room.code, playerId: 'p2' });

    expect(record?.players).toEqual([{ playerId: 'p1', nickname: 'Ana' }]);
    expect(hostMigratedTo).toBeNull();
  });

  it('migrates the host to the next remaining player when the host leaves', async () => {
    const deps = createDeps();
    const room = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'championship' });
    await joinRoom(deps, { code: room.code, playerId: 'p2', nickname: 'Bia' });

    const { record, hostMigratedTo } = await leaveRoom(deps, { code: room.code, playerId: 'p1' });

    expect(hostMigratedTo).toBe('p2');
    expect(record?.hostId).toBe('p2');
    expect(record?.players).toEqual([{ playerId: 'p2', nickname: 'Bia' }]);
  });

  it('deletes the room once the last player leaves', async () => {
    const deps = createDeps();
    const room = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'championship' });

    const { record, hostMigratedTo, deleted } = await leaveRoom(deps, { code: room.code, playerId: 'p1' });

    expect(hostMigratedTo).toBeNull();
    expect(record).toBeNull();
    expect(deleted).toBe(true);
    expect(await deps.roomRepository.findByCode(room.code)).toBeNull();
    expect(deps.championshipRegistry.get(room.code)).toBeUndefined();
  });

  it('throws RoomNotFoundError for an unknown code', async () => {
    const deps = createDeps();
    await expect(leaveRoom(deps, { code: 'NOPENOPE', playerId: 'p1' })).rejects.toThrow(RoomNotFoundError);
  });
});
