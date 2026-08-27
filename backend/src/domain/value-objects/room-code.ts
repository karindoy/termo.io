import { randomBytes } from 'node:crypto';

const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const ROOM_CODE_LENGTH = 8;

export const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

// The first character is forced to instanceTag (one symbol of ROOM_CODE_ALPHABET, unique
// per backend replica) so a reverse proxy can route a room's traffic — HTTP and WebSocket
// alike — to the same instance that owns its in-process game state, purely by reading the
// code, with no shared routing table needed.
export function generateRoomCode(instanceTag: string): string {
  const bytes = randomBytes(ROOM_CODE_LENGTH - 1);
  const rest = Array.from(bytes, (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join('');
  return instanceTag + rest;
}
