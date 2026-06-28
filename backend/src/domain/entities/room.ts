export interface Player {
  playerId: string;
  nickname: string;
}

export class Room {
  readonly players = new Map<string, Player>();

  constructor(readonly id: string) {}

  addPlayer(player: Player): void {
    this.players.set(player.playerId, player);
  }
}
