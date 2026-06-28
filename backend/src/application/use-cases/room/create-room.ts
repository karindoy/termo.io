import { generateRoomCode } from '../../../domain/value-objects/room-code.js';
import type { RoomMode, RoomRecord, RoomRepository } from '../../../domain/repositories/room-repository.js';
import type { WordRepository } from '../../../domain/repositories/word-repository.js';
import { RoundMode } from '../../game-modes/round-mode.js';
import { FastMode } from '../../game-modes/fast-mode.js';
import type { GameModeRegistry } from '../../../infrastructure/realtime/game-mode-registry.js';
import { createRoomSettings, type RoomSettings } from '../../../domain/value-objects/room-settings.js';

const CODE_GENERATION_ATTEMPTS = 5;

export interface CreateRoomDeps {
  roomRepository: RoomRepository;
  wordRepository: WordRepository;
  roundRegistry: GameModeRegistry<RoundMode>;
  fastRegistry: GameModeRegistry<FastMode>;
}

export interface CreateRoomInput {
  hostId: string;
  nickname: string;
  mode: RoomMode;
  isPublic?: boolean;
  settings?: Partial<RoomSettings>;
}

export async function createRoom(deps: CreateRoomDeps, input: CreateRoomInput): Promise<RoomRecord> {
  const code = await generateUniqueRoomCode(deps.roomRepository);
  const settings = createRoomSettings(input.settings);

  // The game only starts once the host calls start-game; here we just stand up
  // the room shell so players can join the lobby and see each other.
  if (input.mode === 'round') {
    const gameMode = new RoundMode(code, deps.wordRepository, {
      wordCount: settings.wordCount,
      maxAttempts: settings.maxAttempts,
      timeLimitMs: settings.timeLimitMs,
    });
    gameMode.joinPlayer(input.hostId, input.nickname);
    deps.roundRegistry.register(code, gameMode);
  } else {
    const gameMode = new FastMode(code, deps.wordRepository, {
      wordCount: settings.wordCount,
      timeLimitMs: settings.timeLimitMs,
    });
    gameMode.joinPlayer(input.hostId, input.nickname);
    deps.fastRegistry.register(code, gameMode);
  }

  const record: RoomRecord = {
    code,
    mode: input.mode,
    hostId: input.hostId,
    createdAt: Date.now(),
    isPublic: input.isPublic ?? true,
    settings,
    status: 'lobby',
    players: [
      {
        playerId: input.hostId,
        nickname: input.nickname,
      },
    ],
  };

  await deps.roomRepository.create(record);
  return record;
}

async function generateUniqueRoomCode(roomRepository: RoomRepository): Promise<string> {
  for (let attempt = 0; attempt < CODE_GENERATION_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    if (!(await roomRepository.findByCode(code))) return code;
  }
  throw new Error('Não foi possível gerar um código de sala único');
}
