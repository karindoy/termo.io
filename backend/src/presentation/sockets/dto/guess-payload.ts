import { z } from 'zod';
import { ROOM_CODE_PATTERN } from '../../../domain/value-objects/room-code.js';

const roomCodeSchema = z.string().regex(ROOM_CODE_PATTERN);

export const guessPayloadSchema = z.object({
  code: roomCodeSchema,
  playerId: z.string().min(1).max(64),
  nickname: z.string().min(1).max(24),
  guess: z.string().min(5).max(5),
});

export type GuessPayload = z.infer<typeof guessPayloadSchema>;

export const joinPayloadSchema = z.object({
  code: roomCodeSchema,
  playerId: z.string().min(1).max(64),
  nickname: z.string().min(1).max(24),
});

export type JoinPayload = z.infer<typeof joinPayloadSchema>;

export const roomMembershipPayloadSchema = z.object({
  code: roomCodeSchema,
  playerId: z.string().min(1).max(64),
});

export type RoomMembershipPayload = z.infer<typeof roomMembershipPayloadSchema>;

export const updateSettingsPayloadSchema = z.object({
  code: roomCodeSchema,
  playerId: z.string().min(1).max(64),
  settings: z.object({
    wordCount: z.number().int().optional(),
    maxAttempts: z.number().int().optional(),
    timeLimitMs: z.number().int().optional(),
  }),
});

export type UpdateSettingsPayload = z.infer<typeof updateSettingsPayloadSchema>;
