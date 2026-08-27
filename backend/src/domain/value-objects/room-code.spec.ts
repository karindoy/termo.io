import { describe, expect, it } from 'vitest';
import { ROOM_CODE_PATTERN, generateRoomCode } from './room-code.js';

describe('generateRoomCode', () => {
  it('produces an 8-character code from the unambiguous alphabet', () => {
    const code = generateRoomCode('A');
    expect(code).toMatch(ROOM_CODE_PATTERN);
  });

  it('never contains visually ambiguous characters', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode('A');
      expect(code).not.toMatch(/[0O1IL]/);
    }
  });

  it('generates distinct codes across many calls', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateRoomCode('A')));
    expect(codes.size).toBe(500);
  });

  it('forces the first character to the given instance tag', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateRoomCode('B')[0]).toBe('B');
    }
  });
});
