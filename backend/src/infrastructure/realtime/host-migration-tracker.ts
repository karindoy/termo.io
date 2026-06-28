const GRACE_PERIOD_MS = 30 * 1000;

export class HostMigrationTracker {
  private readonly pending = new Map<string, NodeJS.Timeout>();

  onHostDisconnected(code: string, onLapse: () => void): void {
    this.cancel(code);
    const handle = setTimeout(() => {
      this.pending.delete(code);
      onLapse();
    }, GRACE_PERIOD_MS);
    this.pending.set(code, handle);
  }

  cancel(code: string): void {
    const handle = this.pending.get(code);
    if (handle) {
      clearTimeout(handle);
      this.pending.delete(code);
    }
  }

  isPending(code: string): boolean {
    return this.pending.has(code);
  }
}
