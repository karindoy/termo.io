import type { Namespace, Socket } from 'socket.io';
import type { FastMode } from '../../../application/game-modes/fast-mode.js';
import { submitGuess } from '../../../application/use-cases/submit-guess.js';
import { joinRoom, type JoinRoomDeps } from '../../../application/use-cases/room/join-room.js';
import { leaveRoom } from '../../../application/use-cases/room/leave-room.js';
import { updateRoomSettings } from '../../../application/use-cases/room/update-room-settings.js';
import { startGame } from '../../../application/use-cases/room/start-game.js';
import { migrateHost } from '../../../application/use-cases/room/migrate-host.js';
import type { GameModeRegistry } from '../../../infrastructure/realtime/game-mode-registry.js';
import type { HostMigrationTracker } from '../../../infrastructure/realtime/host-migration-tracker.js';
import {
  guessPayloadSchema,
  joinPayloadSchema,
  roomMembershipPayloadSchema,
  updateSettingsPayloadSchema,
} from '../dto/guess-payload.js';

export function registerFastModeHandlers(
  io: Namespace,
  registry: GameModeRegistry<FastMode>,
  joinRoomDeps: JoinRoomDeps,
  hostMigrationTracker: HostMigrationTracker,
): void {
  registry.on('register', (code: string, gameMode: FastMode) => bindBroadcast(io, registry, code, gameMode));

  io.on('connection', (socket: Socket) => {
    let joinedCode: string | null = null;
    let joinedPlayerId: string | null = null;

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
        socket.emit('room:error', { message });
        return;
      }

      const { record } = result;
      const gameMode = result.gameMode as FastMode;

      socket.join(parsed.data.code);
      joinedCode = parsed.data.code;
      joinedPlayerId = parsed.data.playerId;
      if (record.hostId === parsed.data.playerId) {
        hostMigrationTracker.cancel(parsed.data.code);
      }

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
        attemptsByPlayer: Object.fromEntries(playerIds.map((id) => [id, game.attemptsFor(id)])),
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

      try {
        const { record, hostMigratedTo } = await leaveRoom(joinRoomDeps, parsed.data);
        socket.leave(parsed.data.code);
        io.to(parsed.data.code).emit('lobby:state', record);
        if (hostMigratedTo) {
          hostMigrationTracker.cancel(parsed.data.code);
          io.to(parsed.data.code).emit('host:migrated', { code: parsed.data.code, hostId: hostMigratedTo });
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

      try {
        const record = await startGame(joinRoomDeps, parsed.data);
        io.to(parsed.data.code).emit('game:start', record);
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

      const gameMode = registry.get(parsed.data.code);
      if (!gameMode) {
        socket.emit('guess:error', { message: `Sala "${parsed.data.code}" não encontrada` });
        return;
      }

      try {
        const wordIndex = gameMode.getGame().wordIndexFor(parsed.data.playerId);
        const result = submitGuess(gameMode, parsed.data);
        io.to(parsed.data.code).emit('guess:result', { ...result, wordIndex });
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
      if (!record || record.hostId !== playerId) return;

      hostMigrationTracker.onHostDisconnected(code, async () => {
        const result = await migrateHost(joinRoomDeps, { code });
        if (result.newHostId) {
          io.to(code).emit('host:migrated', { code, hostId: result.newHostId });
          io.to(code).emit('lobby:state', result.record);
        }
      });
    });
  });
}

function bindBroadcast(io: Namespace, registry: GameModeRegistry<FastMode>, code: string, gameMode: FastMode): void {
  gameMode.on('race:started', (config) => io.to(config.roomId).emit('race:started', config));
  gameMode.on('player:word-started', (snapshot) => io.to(snapshot.roomId).emit('player:word-started', snapshot));
  gameMode.on('player:word-resolved', (result) => io.to(result.roomId).emit('player:word-resolved', result));
  gameMode.on('race:finished', (payload) => {
    io.to(payload.roomId).emit('race:finished', payload);
    registry.remove(code);
  });
}
