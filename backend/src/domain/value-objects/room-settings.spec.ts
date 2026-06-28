import { describe, expect, it } from 'vitest';
import { createRoomSettings } from './room-settings.js';
import { InvalidRoomSettingsError } from '../errors/invalid-room-settings-error.js';

describe('createRoomSettings', () => {
  it('fills in Phase 2 defaults when nothing is provided', () => {
    expect(createRoomSettings()).toEqual({ wordCount: 5, maxAttempts: 6, timeLimitMs: 300_000 });
  });

  it('overrides only the provided fields', () => {
    expect(createRoomSettings({ wordCount: 3 })).toEqual({ wordCount: 3, maxAttempts: 6, timeLimitMs: 300_000 });
  });

  it.each([
    { wordCount: 0 },
    { wordCount: 16 },
    { maxAttempts: 0 },
    { maxAttempts: 11 },
    { timeLimitMs: 29_999 },
    { timeLimitMs: 900_001 },
  ])('rejects out-of-bounds settings %j', (override) => {
    expect(() => createRoomSettings(override)).toThrow(InvalidRoomSettingsError);
  });

  it('accepts the boundary values', () => {
    expect(() => createRoomSettings({ wordCount: 1, maxAttempts: 1, timeLimitMs: 30_000 })).not.toThrow();
    expect(() => createRoomSettings({ wordCount: 15, maxAttempts: 10, timeLimitMs: 900_000 })).not.toThrow();
  });
});
