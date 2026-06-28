import type { Namespace, Socket } from 'socket.io';
import type { RoundMode } from '../../../application/game-modes/round-mode.js';
import { submitGuess } from '../../../application/use-cases/submit-guess.js';
import { guessPayloadSchema, joinPayloadSchema } from '../dto/guess-payload.js';

export function registerRoundModeHandlers(io: Namespace, gameMode: RoundMode): void {
  gameMode.on('round:started', (snapshot) => io.emit('round:started', snapshot));
  gameMode.on('word:resolved', (result) => io.emit('word:resolved', result));
  gameMode.on('tiebreak:started', (payload) => io.emit('tiebreak:started', payload));
  gameMode.on('game:finished', (payload) => io.emit('game:finished', payload));

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

      socket.emit('room:state', {
        ...gameMode.currentRoundSnapshot(),
        players: Array.from(room.players.values()),
        scores: Object.fromEntries(game.scores),
        attempts: game.currentRound.attempts,
        solvedBy: game.currentRound.solvedBy,
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
        const roundSequence = gameMode.getGame().roundSequenceNumber;
        const result = submitGuess(gameMode, parsed.data);
        io.emit('guess:result', { ...result, roundSequence });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        socket.emit('guess:error', { message });
      }
    });
  });
}
