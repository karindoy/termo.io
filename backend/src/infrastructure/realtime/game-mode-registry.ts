import { EventEmitter } from 'node:events';
import type { GameMode } from '../../application/game-modes/game-mode.js';

// Emits 'register' on registration so socket broadcasting can be wired per-instance without create-room.ts depending on Socket.IO.
export class GameModeRegistry<T extends GameMode> extends EventEmitter {
  private readonly instances = new Map<string, T>();

  register(code: string, instance: T): void {
    this.instances.set(code, instance);
    this.emit('register', code, instance);
  }

  get(code: string): T | undefined {
    return this.instances.get(code);
  }

  remove(code: string): void {
    this.instances.delete(code);
  }
}
