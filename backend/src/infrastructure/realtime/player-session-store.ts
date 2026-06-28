import { randomUUID } from 'node:crypto';

// playerId is broadcast to every room member (and, for public rooms, to anyone
// browsing the lobby list) — it identifies a seat, not a credential. Privileged
// actions (host controls, guesses, leaving) must instead prove possession of the
// secret issued here at join time, which is never included in any room payload.
export class PlayerSessionStore {
  private readonly secretsByRoom = new Map<string, Map<string, string>>();

  issue(code: string, playerId: string): string {
    const secret = randomUUID();
    let roomSecrets = this.secretsByRoom.get(code);
    if (!roomSecrets) {
      roomSecrets = new Map();
      this.secretsByRoom.set(code, roomSecrets);
    }
    roomSecrets.set(playerId, secret);
    return secret;
  }

  verify(code: string, playerId: string, secret: string | undefined): boolean {
    if (!secret) return false;
    return this.secretsByRoom.get(code)?.get(playerId) === secret;
  }

  clear(code: string): void {
    this.secretsByRoom.delete(code);
  }
}
