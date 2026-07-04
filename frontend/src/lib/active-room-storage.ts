const ACTIVE_ROOM_KEY = 'termo_active_room_code';

export function getStoredRoomCode(): string | null {
  return sessionStorage.getItem(ACTIVE_ROOM_KEY);
}

export function storeRoomCode(code: string): void {
  sessionStorage.setItem(ACTIVE_ROOM_KEY, code);
}

export function clearStoredRoomCode(): void {
  sessionStorage.removeItem(ACTIVE_ROOM_KEY);
}
