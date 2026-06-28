import { z } from 'zod';

export const guessPayloadSchema = z.object({
  playerId: z.string().min(1).max(64),
  nickname: z.string().min(1).max(24),
  guess: z.string().min(5).max(5),
});

export type GuessPayload = z.infer<typeof guessPayloadSchema>;

export const joinPayloadSchema = z.object({
  playerId: z.string().min(1).max(64),
  nickname: z.string().min(1).max(24),
});

export type JoinPayload = z.infer<typeof joinPayloadSchema>;
