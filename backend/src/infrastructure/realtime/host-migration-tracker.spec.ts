import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HostMigrationTracker } from './host-migration-tracker.js';

describe('HostMigrationTracker', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('calls onLapse after the 30s grace period if not cancelled', () => {
    const tracker = new HostMigrationTracker();
    const onLapse = vi.fn();

    tracker.onHostDisconnected('ABCDEFGH', onLapse);
    expect(tracker.isPending('ABCDEFGH')).toBe(true);

    vi.advanceTimersByTime(30_000);

    expect(onLapse).toHaveBeenCalledOnce();
    expect(tracker.isPending('ABCDEFGH')).toBe(false);
  });

  it('does not call onLapse if cancelled before the grace period elapses', () => {
    const tracker = new HostMigrationTracker();
    const onLapse = vi.fn();

    tracker.onHostDisconnected('ABCDEFGH', onLapse);
    tracker.cancel('ABCDEFGH');
    vi.advanceTimersByTime(30_000);

    expect(onLapse).not.toHaveBeenCalled();
  });

  it('tracks multiple rooms independently', () => {
    const tracker = new HostMigrationTracker();
    const onLapseA = vi.fn();
    const onLapseB = vi.fn();

    tracker.onHostDisconnected('ROOMAAAA', onLapseA);
    tracker.onHostDisconnected('ROOMBBBB', onLapseB);
    tracker.cancel('ROOMAAAA');

    vi.advanceTimersByTime(30_000);

    expect(onLapseA).not.toHaveBeenCalled();
    expect(onLapseB).toHaveBeenCalledOnce();
  });
});
