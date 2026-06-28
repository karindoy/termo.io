import type { Server, Socket } from 'socket.io';
import type { SingleWordMode } from '../../../application/game-modes/single-word-mode.js';
import { submitGuess } from '../../../application/use-cases/submit-guess.js';
import { guessPayloadSchema, joinPayloadSchema } from '../dto/guess-payload.js';
import { WORD_LENGTH } from '../../../domain/entities/word.js';

export function registerGameHandlers(io: Server, gameMode: SingleWordMode): void {
  io.on('connection', (socket: Socket) => {
    socket.on('room:join', (rawPayload: unknown) => {
      const parsed = joinPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit('room:error', { message: 'Payload de entrada inválido' });
        return;
      }

      const room = gameMode.getRoom();
      room.addPlayer({ playerId: parsed.data.playerId, nickname: parsed.data.nickname });

      socket.emit('room:state', {
        wordLength: WORD_LENGTH,
        players: Array.from(room.players.values()),
        attempts: room.attempts,
        solvedBy: room.solvedBy,
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
        const result = submitGuess(gameMode, parsed.data);
        io.emit('guess:result', result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        socket.emit('guess:error', { message });
      }
    });
  });
}
