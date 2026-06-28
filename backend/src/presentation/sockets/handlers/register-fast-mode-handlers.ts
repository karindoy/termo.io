import type { Namespace, Socket } from 'socket.io';
import type { FastMode } from '../../../application/game-modes/fast-mode.js';
import { submitGuess } from '../../../application/use-cases/submit-guess.js';
import { guessPayloadSchema, joinPayloadSchema } from '../dto/guess-payload.js';

export function registerFastModeHandlers(io: Namespace, gameMode: FastMode): void {
  gameMode.on('race:started', (config) => io.emit('race:started', config));
  gameMode.on('player:word-started', (snapshot) => io.emit('player:word-started', snapshot));
  gameMode.on('player:word-resolved', (result) => io.emit('player:word-resolved', result));
  gameMode.on('race:finished', (payload) => io.emit('race:finished', payload));

  io.on('connection', (socket: Socket) => {
    socket.on('room:join', (rawPayload: unknown) => {
      const parsed = joinPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit('room:error', { message: 'Payload de entrada inválido' });
        return;
      }

      gameMode.joinPlayer(parsed.data.playerId, parsed.data.nickname);
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

      io.emit('room:players', Array.from(room.players.values()));
    });

    socket.on('guess:submit', (rawPayload: unknown) => {
      const parsed = guessPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit('guess:error', { message: 'Palpite inválido' });
        return;
      }

      try {
        const wordIndex = gameMode.getGame().wordIndexFor(parsed.data.playerId);
        const result = submitGuess(gameMode, parsed.data);
        io.emit('guess:result', { ...result, wordIndex });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        socket.emit('guess:error', { message });
      }
    });
  });
}
