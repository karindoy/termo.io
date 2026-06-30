import { describe, expect, it } from 'vitest';
import { createRoom, type CreateRoomDeps } from './create-room.js';
import { joinRoom } from './join-room.js';
import { InMemoryRoomRepository } from '../../../infrastructure/persistence/rooms/in-memory-room-repository.js';
import { GameModeRegistry } from '../../../infrastructure/realtime/game-mode-registry.js';
import { ChampionshipMode } from '../../game-modes/championship-mode.js';
import { RaceMode } from '../../game-modes/race-mode.js';
import { Word } from '../../../domain/entities/word.js';
import type { WordRepository } from '../../../domain/repositories/word-repository.js';
import { RoomNotFoundError } from '../../../domain/errors/room-not-found-error.js';
import { RoomFullError } from '../../../domain/errors/room-full-error.js';
import { MAX_PLAYERS_PER_ROOM } from '../../../domain/repositories/room-repository.js';
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

describe('joinRoom', () => {
  it('adds a new player to the roster and to the live game', async () => {
    const deps = createDeps();
    const room = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'championship' });

    const { record, gameMode } = await joinRoom(deps, { code: room.code, playerId: 'p2', nickname: 'Bia' });

    expect(record.players).toEqual([
      { playerId: 'p1', nickname: 'Ana' },
      { playerId: 'p2', nickname: 'Bia' },
    ]);
    expect((gameMode as ChampionshipMode).getRoom().players.has('p2')).toBe(true);
  });

  it('throws RoomNotFoundError for an unknown code', async () => {
    const deps = createDeps();
    await expect(joinRoom(deps, { code: 'NOPENOPE', playerId: 'p2', nickname: 'Bia' })).rejects.toThrow(
      RoomNotFoundError,
    );
  });

  it('does not double-count a reconnecting player against the room cap', async () => {
    const deps = createDeps();
    const room = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'championship' });

    await joinRoom(deps, { code: room.code, playerId: 'p1', nickname: 'Ana' });

    const persisted = await deps.roomRepository.findByCode(room.code);
    expect(persisted?.players).toHaveLength(1);
  });

  it('throws RoomFullError once the room is at capacity', async () => {
    const deps = createDeps();
    const room = await createRoom(deps, { hostId: 'host', nickname: 'Host', mode: 'championship' });

    for (let i = 0; i < MAX_PLAYERS_PER_ROOM - 1; i++) {
      await joinRoom(deps, { code: room.code, playerId: `extra-${i}`, nickname: `P${i}` });
    }

    await expect(joinRoom(deps, { code: room.code, playerId: 'one-too-many', nickname: 'Late' })).rejects.toThrow(
      RoomFullError,
    );
  });

  it('removes the player from a previously joined room when joining a different one', async () => {
    const deps = createDeps();
    const roomA = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'championship' });
    await joinRoom(deps, { code: roomA.code, playerId: 'p2', nickname: 'Bia' });
    const roomB = await createRoom(deps, { hostId: 'p3', nickname: 'Cia', mode: 'championship' });

    const { previousRoom } = await joinRoom(deps, { code: roomB.code, playerId: 'p2', nickname: 'Bia' });

    expect(previousRoom?.code).toBe(roomA.code);
    expect(previousRoom?.deleted).toBe(false);
    const persistedA = await deps.roomRepository.findByCode(roomA.code);
    expect(persistedA?.players).toEqual([{ playerId: 'p1', nickname: 'Ana' }]);
    const persistedB = await deps.roomRepository.findByCode(roomB.code);
    expect(persistedB?.players).toEqual([
      { playerId: 'p3', nickname: 'Cia' },
      { playerId: 'p2', nickname: 'Bia' },
    ]);
  });

  it('deletes the previous room when the switching player was its last occupant', async () => {
    const deps = createDeps();
    const roomA = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'championship' });
    const roomB = await createRoom(deps, { hostId: 'p2', nickname: 'Bia', mode: 'championship' });

    const { previousRoom } = await joinRoom(deps, { code: roomB.code, playerId: 'p1', nickname: 'Ana' });

    expect(previousRoom?.deleted).toBe(true);
    expect(await deps.roomRepository.findByCode(roomA.code)).toBeNull();
    expect(deps.championshipRegistry.get(roomA.code)).toBeUndefined();
  });

  it('does not evict the player when rejoining the same room (reconnect)', async () => {
    const deps = createDeps();
    const room = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'championship' });

    const { previousRoom } = await joinRoom(deps, { code: room.code, playerId: 'p1', nickname: 'Ana' });

    expect(previousRoom).toBeNull();
  });
});
