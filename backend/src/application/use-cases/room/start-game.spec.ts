import { describe, expect, it, vi } from 'vitest';
import { createRoom, type CreateRoomDeps } from './create-room.js';
import { joinRoom } from './join-room.js';
import { startGame } from './start-game.js';
import { InMemoryRoomRepository } from '../../../infrastructure/persistence/rooms/in-memory-room-repository.js';
import { GameModeRegistry } from '../../../infrastructure/realtime/game-mode-registry.js';
import { ChampionshipMode } from '../../game-modes/championship-mode.js';
import { RaceMode } from '../../game-modes/race-mode.js';
import { Word } from '../../../domain/entities/word.js';
import type { WordRepository } from '../../../domain/repositories/word-repository.js';
import { RoomNotFoundError } from '../../../domain/errors/room-not-found-error.js';
import { UnauthorizedHostActionError } from '../../../domain/errors/unauthorized-host-action-error.js';
import { RoomAlreadyStartedError } from '../../../domain/errors/room-already-started-error.js';
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

describe('startGame', () => {
  it('starts the underlying ChampionshipMode and flips the room to in-progress', async () => {
    const deps = createDeps();
    const room = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'championship' });
    const onRoundStarted = vi.fn();
    deps.championshipRegistry.get(room.code)!.on('round:started', onRoundStarted);

    const record = await startGame(deps, { code: room.code, playerId: 'p1' });

    expect(record.status).toBe('in-progress');
    expect(onRoundStarted).toHaveBeenCalled();
  });

  it('registers players who joined during the lobby into a RaceMode race once started', async () => {
    const deps = createDeps();
    const room = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'race' });
    await joinRoom(deps, { code: room.code, playerId: 'p2', nickname: 'Bia' });

    await startGame(deps, { code: room.code, playerId: 'p1' });

    const gameMode = deps.raceRegistry.get(room.code)!;
    expect(gameMode.getGame().hasPlayer('p1')).toBe(true);
    expect(gameMode.getGame().hasPlayer('p2')).toBe(true);
  });

  it('throws UnauthorizedHostActionError for a non-host caller', async () => {
    const deps = createDeps();
    const room = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'championship' });

    await expect(startGame(deps, { code: room.code, playerId: 'p2' })).rejects.toThrow(UnauthorizedHostActionError);
  });

  it('throws RoomAlreadyStartedError when started twice', async () => {
    const deps = createDeps();
    const room = await createRoom(deps, { hostId: 'p1', nickname: 'Ana', mode: 'championship' });
    await startGame(deps, { code: room.code, playerId: 'p1' });

    await expect(startGame(deps, { code: room.code, playerId: 'p1' })).rejects.toThrow(RoomAlreadyStartedError);
  });

  it('throws RoomNotFoundError for an unknown code', async () => {
    const deps = createDeps();
    await expect(startGame(deps, { code: 'NOPENOPE', playerId: 'p1' })).rejects.toThrow(RoomNotFoundError);
  });
});
