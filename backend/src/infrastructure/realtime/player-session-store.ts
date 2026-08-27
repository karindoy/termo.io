import { randomUUID } from 'node:crypto';

// playerId is broadcast to every room member (and, for public rooms, to anyone
// browsing the lobby list) — it identifies a seat, not a credential. Privileged
// actions (host controls, guesses, leaving) must instead prove possession of the
// secret issued here at join time, which is never included in any room payload.
export interface PlayerSessionStore {
  issue(code: string, playerId: string): Promise<string>;
  verify(code: string, playerId: string, secret: string | undefined): Promise<boolean>;
  clear(code: string): Promise<void>;
}

export class InMemoryPlayerSessionStore implements PlayerSessionStore {
  private readonly secretsByRoom = new Map<string, Map<string, string>>();

  async issue(code: string, playerId: string): Promise<string> {
    const secret = randomUUID();
    let roomSecrets = this.secretsByRoom.get(code);
    if (!roomSecrets) {
      roomSecrets = new Map();
      this.secretsByRoom.set(code, roomSecrets);
    }
    roomSecrets.set(playerId, secret);
    return secret;
  }

  async verify(code: string, playerId: string, secret: string | undefined): Promise<boolean> {
    if (!secret) return false;
    return this.secretsByRoom.get(code)?.get(playerId) === secret;
  }

  async clear(code: string): Promise<void> {
    this.secretsByRoom.delete(code);
  }
}
