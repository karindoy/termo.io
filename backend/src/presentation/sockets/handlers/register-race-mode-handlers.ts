import type { Namespace, Socket } from 'socket.io';
import type { RaceMode } from '../../../application/game-modes/race-mode.js';
import { submitGuess } from '../../../application/use-cases/submit-guess.js';
import { joinRoom, type JoinRoomDeps } from '../../../application/use-cases/room/join-room.js';
import { leaveRoom } from '../../../application/use-cases/room/leave-room.js';
import { updateRoomSettings } from '../../../application/use-cases/room/update-room-settings.js';
import { startGame } from '../../../application/use-cases/room/start-game.js';
import { restartRoom, type RestartRoomDeps } from '../../../application/use-cases/room/restart-room.js';
import { migrateHost } from '../../../application/use-cases/room/migrate-host.js';
import type { GameModeRegistry } from '../../../infrastructure/realtime/game-mode-registry.js';
import type { HostMigrationTracker } from '../../../infrastructure/realtime/host-migration-tracker.js';
import type { PlayerSessionStore } from '../../../infrastructure/realtime/player-session-store.js';
import {
  guessPayloadSchema,
  joinPayloadSchema,
  restartPayloadSchema,
  roomMembershipPayloadSchema,
  updateSettingsPayloadSchema,
} from '../dto/guess-payload.js';
import { redactAttempt } from '../dto/redact-attempt.js';
import { RoomNotFoundError } from '../../../domain/errors/room-not-found-error.js';

export function registerRaceModeHandlers(
  io: Namespace,
  registry: GameModeRegistry<RaceMode>,
  joinRoomDeps: JoinRoomDeps,
  hostMigrationTracker: HostMigrationTracker,
  sessionStore: PlayerSessionStore,
  restartRoomDeps: RestartRoomDeps,
): void {
  registry.on('register', (code: string, gameMode: RaceMode) => bindBroadcast(io, registry, sessionStore, code, gameMode));

  io.on('connection', (socket: Socket) => {
    let joinedCode: string | null = null;
    let joinedPlayerId: string | null = null;

    function rejectUnauthorized(code: string, playerId: string, sessionSecret: string, errorEvent: string): boolean {
      if (sessionStore.verify(code, playerId, sessionSecret)) return false;
      socket.emit(errorEvent, { message: 'Sessão inválida — entre na sala novamente' });
      return true;
    }

    socket.on('room:join', async (rawPayload: unknown) => {
      const parsed = joinPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit('room:error', { message: 'Payload de entrada inválido' });
        return;
      }

      let result;
      try {
        result = await joinRoom(joinRoomDeps, parsed.data);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        const code = error instanceof RoomNotFoundError ? 'ROOM_NOT_FOUND' : undefined;
        socket.emit('room:error', { message, ...(code && { code }) });
        return;
      }

      const { record, previousRoom } = result;
      const gameMode = result.gameMode as RaceMode;

      if (previousRoom) {
        socket.leave(previousRoom.code);
        if (previousRoom.record) {
          io.to(previousRoom.code).emit('lobby:state', previousRoom.record);
          if (previousRoom.hostMigratedTo) {
            hostMigrationTracker.cancel(previousRoom.code);
            io.to(previousRoom.code).emit('host:migrated', { code: previousRoom.code, hostId: previousRoom.hostMigratedTo });
          }
        }
      }

      socket.join(parsed.data.code);
      joinedCode = parsed.data.code;
      joinedPlayerId = parsed.data.playerId;
      if (record.hostId === parsed.data.playerId) {
        hostMigrationTracker.cancel(parsed.data.code);
      }

      const sessionSecret = sessionStore.issue(parsed.data.code, parsed.data.playerId);
      socket.emit('room:session', { sessionSecret });

      if (record.status === 'lobby') {
        io.to(parsed.data.code).emit('lobby:state', record);
        return;
      }

      const room = gameMode.getRoom();
      const game = gameMode.getGame();
      const playerIds = Array.from(room.players.keys());

      socket.emit('room:state', {
        ...gameMode.configSnapshot(),
        players: Array.from(room.players.values()),
        progress: game.progressSummary(),
        attemptsByPlayer: Object.fromEntries(
          playerIds.map((id) => [
            id,
            id === parsed.data.playerId ? game.attemptsFor(id) : game.attemptsFor(id).map(redactAttempt),
          ]),
        ),
        phase: game.phase,
        winnerId: game.winnerId,
      });

      io.to(parsed.data.code).emit('room:players', Array.from(room.players.values()));
    });

    socket.on('room:leave', async (rawPayload: unknown) => {
      const parsed = roomMembershipPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit('room:error', { message: 'Payload de saída inválido' });
        return;
      }
      if (rejectUnauthorized(parsed.data.code, parsed.data.playerId, parsed.data.sessionSecret, 'room:error')) return;

      try {
        const { record, hostMigratedTo } = await leaveRoom(joinRoomDeps, parsed.data);
        socket.leave(parsed.data.code);
        if (record) {
          io.to(parsed.data.code).emit('lobby:state', record);
          if (hostMigratedTo) {
            hostMigrationTracker.cancel(parsed.data.code);
            io.to(parsed.data.code).emit('host:migrated', { code: parsed.data.code, hostId: hostMigratedTo });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        socket.emit('room:error', { message });
      }
    });

    socket.on('room:settings:update', async (rawPayload: unknown) => {
      const parsed = updateSettingsPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit('room:error', { message: 'Configurações inválidas' });
        return;
      }
      if (rejectUnauthorized(parsed.data.code, parsed.data.playerId, parsed.data.sessionSecret, 'room:error')) return;

      try {
        const record = await updateRoomSettings(joinRoomDeps, parsed.data);
        io.to(parsed.data.code).emit('lobby:state', record);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        socket.emit('room:error', { message });
      }
    });

    socket.on('room:start', async (rawPayload: unknown) => {
      const parsed = roomMembershipPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit('room:error', { message: 'Payload de início inválido' });
        return;
      }
      if (rejectUnauthorized(parsed.data.code, parsed.data.playerId, parsed.data.sessionSecret, 'room:error')) return;

      try {
        const record = await startGame(joinRoomDeps, parsed.data);
        io.to(parsed.data.code).emit('game:start', record);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        socket.emit('room:error', { message });
      }
    });

    socket.on('room:restart', async (rawPayload: unknown) => {
      const parsed = restartPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit('room:error', { message: 'Payload de reinício inválido' });
        return;
      }

      try {
        const { gameMode } = await restartRoom(restartRoomDeps, parsed.data);
        const raceMode = gameMode as RaceMode;
        const room = raceMode.getRoom();
        const game = raceMode.getGame();
        const playerIds = Array.from(room.players.keys());
        io.to(parsed.data.code).emit('room:state', {
          ...raceMode.configSnapshot(),
          players: Array.from(room.players.values()),
          progress: game.progressSummary(),
          attemptsByPlayer: Object.fromEntries(playerIds.map((id) => [id, []])),
          phase: game.phase,
          winnerId: game.winnerId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        socket.emit('room:error', { message });
      }
    });

    socket.on('guess:submit', (rawPayload: unknown) => {
      const parsed = guessPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit('guess:error', { message: 'Palpite inválido' });
        return;
      }
      if (rejectUnauthorized(parsed.data.code, parsed.data.playerId, parsed.data.sessionSecret, 'guess:error')) return;

      const gameMode = registry.get(parsed.data.code);
      if (!gameMode) {
        socket.emit('guess:error', { message: `Sala "${parsed.data.code}" não encontrada` });
        return;
      }

      try {
        const wordIndex = gameMode.getGame().wordIndexFor(parsed.data.playerId);
        const result = submitGuess(gameMode, parsed.data);
        socket.emit('guess:result', { ...result, wordIndex });
        socket.to(parsed.data.code).emit('guess:result', {
          ...result,
          attempt: redactAttempt(result.attempt),
          wordIndex,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        socket.emit('guess:error', { message });
      }
    });

    socket.on('disconnect', async () => {
      const code = joinedCode;
      const playerId = joinedPlayerId;
      if (!code || !playerId) return;

      const record = await joinRoomDeps.roomRepository.findByCode(code);
      if (!record) return;

      if (record.status === 'lobby') {
        try {
          const result = await leaveRoom(joinRoomDeps, { code, playerId });
          if (!result.deleted && result.record) {
            io.to(code).emit('lobby:state', result.record);
            if (result.hostMigratedTo) {
              hostMigrationTracker.cancel(code);
              io.to(code).emit('host:migrated', { code, hostId: result.hostMigratedTo });
            }
          }
        } catch {
          // Room already gone — nothing to do
        }
      } else if (record.hostId === playerId) {
        hostMigrationTracker.onHostDisconnected(code, async () => {
          const result = await migrateHost(joinRoomDeps, { code });
          if (result.newHostId) {
            io.to(code).emit('host:migrated', { code, hostId: result.newHostId });
            io.to(code).emit('lobby:state', result.record);
          }
        });
      }
    });
  });
}

function bindBroadcast(
  io: Namespace,
  registry: GameModeRegistry<RaceMode>,
  sessionStore: PlayerSessionStore,
  code: string,
  gameMode: RaceMode,
): void {
  gameMode.on('race:started', (config) => io.to(config.roomId).emit('race:started', config));
  gameMode.on('player:word-started', (snapshot) => io.to(snapshot.roomId).emit('player:word-started', snapshot));
  gameMode.on('player:word-resolved', (result) => io.to(result.roomId).emit('player:word-resolved', result));
  gameMode.on('race:finished', (payload) => {
    io.to(payload.roomId).emit('race:finished', payload);
    registry.remove(code);
    sessionStore.clear(code);
  });
}
