import type { Namespace, Socket } from 'socket.io';
import type { RoundMode } from '../../../application/game-modes/round-mode.js';
import { submitGuess } from '../../../application/use-cases/submit-guess.js';
import { joinRoom, type JoinRoomDeps } from '../../../application/use-cases/room/join-room.js';
import type { GameModeRegistry } from '../../../infrastructure/realtime/game-mode-registry.js';
import { guessPayloadSchema, joinPayloadSchema } from '../dto/guess-payload.js';

export function registerRoundModeHandlers(
  io: Namespace,
  registry: GameModeRegistry<RoundMode>,
  joinRoomDeps: JoinRoomDeps,
): void {
  registry.on('register', (code: string, gameMode: RoundMode) => bindBroadcast(io, registry, code, gameMode));

  io.on('connection', (socket: Socket) => {
    socket.on('room:join', async (rawPayload: unknown) => {
      const parsed = joinPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit('room:error', { message: 'Payload de entrada inválido' });
        return;
      }

      let gameMode: RoundMode;
      try {
        const result = await joinRoom(joinRoomDeps, parsed.data);
        gameMode = result.gameMode as RoundMode;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        socket.emit('room:error', { message });
        return;
      }

      socket.join(parsed.data.code);
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
