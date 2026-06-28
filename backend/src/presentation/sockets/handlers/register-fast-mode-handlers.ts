import type { Namespace, Socket } from 'socket.io';
import type { FastMode } from '../../../application/game-modes/fast-mode.js';
import { submitGuess } from '../../../application/use-cases/submit-guess.js';
import { joinRoom, type JoinRoomDeps } from '../../../application/use-cases/room/join-room.js';
import type { GameModeRegistry } from '../../../infrastructure/realtime/game-mode-registry.js';
import { guessPayloadSchema, joinPayloadSchema } from '../dto/guess-payload.js';

export function registerFastModeHandlers(
  io: Namespace,
  registry: GameModeRegistry<FastMode>,
  joinRoomDeps: JoinRoomDeps,
): void {
  registry.on('register', (code: string, gameMode: FastMode) => bindBroadcast(io, registry, code, gameMode));

  io.on('connection', (socket: Socket) => {
    socket.on('room:join', async (rawPayload: unknown) => {
      const parsed = joinPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit('room:error', { message: 'Payload de entrada inválido' });
        return;
      }

      let gameMode: FastMode;
      try {
        const result = await joinRoom(joinRoomDeps, parsed.data);
        gameMode = result.gameMode as FastMode;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        socket.emit('room:error', { message });
        return;
      }

      socket.join(parsed.data.code);
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
