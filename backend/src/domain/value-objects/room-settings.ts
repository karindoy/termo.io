import { InvalidRoomSettingsError } from '../errors/invalid-room-settings-error.js';

export interface RoomSettings {
  wordCount: number;
  maxAttempts: number;
  timeLimitMs: number;
}

const DEFAULT_SETTINGS: RoomSettings = {
  wordCount: 5,
  maxAttempts: 6,
  timeLimitMs: 5 * 60 * 1000,
};

const BOUNDS = {
  wordCount: { min: 1, max: 15 },
  maxAttempts: { min: 1, max: 10 },
  timeLimitMs: { min: 30 * 1000, max: 15 * 60 * 1000 },
};

export function createRoomSettings(input: Partial<RoomSettings> = {}): RoomSettings {
  const settings: RoomSettings = { ...DEFAULT_SETTINGS, ...input };

  for (const key of Object.keys(BOUNDS) as (keyof RoomSettings)[]) {
    const { min, max } = BOUNDS[key];
    if (settings[key] < min || settings[key] > max) {
      throw new InvalidRoomSettingsError(`"${key}" deve estar entre ${min} e ${max}`);
    }
  }

  return settings;
}
