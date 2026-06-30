import { describe, expect, it } from 'vitest';
import { createRoom, type CreateRoomDeps } from './create-room.js';
import { startGame } from './start-game.js';
import { listPublicRooms } from './list-public-rooms.js';
import { InMemoryRoomRepository } from '../../../infrastructure/persistence/rooms/in-memory-room-repository.js';
import { GameModeRegistry } from '../../../infrastructure/realtime/game-mode-registry.js';
import { ChampionshipMode } from '../../game-modes/championship-mode.js';
import { RaceMode } from '../../game-modes/race-mode.js';
import { Word } from '../../../domain/entities/word.js';
import type { WordRepository } from '../../../domain/repositories/word-repository.js';

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

describe('listPublicRooms', () => {
  it('only lists public rooms still in their lobby', async () => {
    const deps = createDeps();
    const publicLobby = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'championship', isPublic: true });
    await createRoom(deps, { hostId: 'p2', nickname: 'Bia', mode: 'championship', isPublic: false });
    const startedPublic = await createRoom(deps, { hostId: 'p3', nickname: 'Cia', mode: 'championship', isPublic: true });
    await startGame(deps, { code: startedPublic.code, playerId: 'p3' });

    const rooms = await listPublicRooms(deps);

    expect(rooms.map((room) => room.code)).toEqual([publicLobby.code]);
  });
});
