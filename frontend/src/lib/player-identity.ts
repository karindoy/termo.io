const PLAYER_ID_KEY = 'termo_player_id';
const NICKNAME_KEY = 'termo_nickname';

export function getOrCreatePlayerId(): string {
  const existing = localStorage.getItem(PLAYER_ID_KEY);
  if (existing) return existing;

  const generated = crypto.randomUUID();
  localStorage.setItem(PLAYER_ID_KEY, generated);
  return generated;
}

export function getStoredNickname(): string | null {
  return localStorage.getItem(NICKNAME_KEY);
}

export function storeNickname(nickname: string): void {
  localStorage.setItem(NICKNAME_KEY, nickname);
}
