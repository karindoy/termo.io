import type { Namespace, Socket } from 'socket.io';
import type { RoundMode } from '../../../application/game-modes/round-mode.js';
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

export function registerRoundModeHandlers(
  io: Namespace,
  registry: GameModeRegistry<RoundMode>,
  joinRoomDeps: JoinRoomDeps,
  hostMigrationTracker: HostMigrationTracker,
): void {
  registry.on('register', (code: string, gameMode: RoundMode) => bindBroadcast(io, registry, code, gameMode));

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
      const gameMode = result.gameMode as RoundMode;

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

      socket.emit('room:state', {
        ...gameMode.currentRoundSnapshot(),
        players: Array.from(room.players.values()),
        scores: Object.fromEntries(game.scores),
        attempts: game.currentRound.attempts,
        solvedBy: game.currentRound.solvedBy,
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
        const roundSequence = gameMode.getGame().roundSequenceNumber;
        const result = submitGuess(gameMode, parsed.data);
        io.to(parsed.data.code).emit('guess:result', { ...result, roundSequence });
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

function bindBroadcast(io: Namespace, registry: GameModeRegistry<RoundMode>, code: string, gameMode: RoundMode): void {
  gameMode.on('round:started', (snapshot) => io.to(snapshot.roomId).emit('round:started', snapshot));
  gameMode.on('word:resolved', (result) => io.to(result.roomId).emit('word:resolved', result));
  gameMode.on('tiebreak:started', (payload) => io.to(payload.roomId).emit('tiebreak:started', payload));
  gameMode.on('game:finished', (payload) => {
    io.to(payload.roomId).emit('game:finished', payload);
    registry.remove(code);
  });
}
