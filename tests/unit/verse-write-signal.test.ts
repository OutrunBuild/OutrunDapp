// verse-write-signal pub/sub unit tests: a confirmed verse write must reach every subscribed
// probe immediately plus a bounded settle window (the wallet-RPC read-after-write backstop),
// a newer write must supersede the previous window, teardown must drop the pending window,
// unsubscribe must stop delivery, and a notify with no listeners must not throw (pages without
// probes). Module listeners persist across tests, so every subscription is tracked and torn
// down after each test — the module only reaches its empty-set behavior on a clean slate.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { notifyVerseWrite, subscribeVerseWrites } from '@/components/global/verse-write-signal';

const offs: Array<() => void> = [];
const tracked = (fn: () => void) => {
  const off = subscribeVerseWrites(fn);
  offs.push(off);
  return off;
};

describe('verse-write-signal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    for (const off of offs.splice(0)) off();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('delivers the write immediately, then twice inside the settle window', () => {
    const first = vi.fn<() => void>();
    const second = vi.fn<() => void>();
    const offFirst = tracked(first);
    tracked(second);

    notifyVerseWrite();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(3_000);
    expect(first).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(5_000);
    expect(first).toHaveBeenCalledTimes(3);

    vi.advanceTimersByTime(60_000);
    expect(first).toHaveBeenCalledTimes(3);

    // second stays subscribed: a live listener sees the bump even after a sibling leaves.
    offFirst();
    notifyVerseWrite();
    expect(first).toHaveBeenCalledTimes(3);
    expect(second).toHaveBeenCalledTimes(4);
  });

  it('a newer write supersedes the previous window', () => {
    const listener = vi.fn<() => void>();
    tracked(listener);

    notifyVerseWrite();
    vi.advanceTimersByTime(3_000);
    expect(listener).toHaveBeenCalledTimes(2);

    // Second write at t=3s: clears the first window's pending +8s bump, schedules its own.
    notifyVerseWrite();
    expect(listener).toHaveBeenCalledTimes(3);

    vi.advanceTimersByTime(3_000);
    expect(listener).toHaveBeenCalledTimes(4);

    vi.advanceTimersByTime(5_000);
    expect(listener).toHaveBeenCalledTimes(5);

    vi.advanceTimersByTime(60_000);
    expect(listener).toHaveBeenCalledTimes(5);
  });

  it('drops the pending settle window when the last listener unsubscribes', () => {
    const leaving = vi.fn<() => void>();
    const offLeaving = tracked(leaving);

    notifyVerseWrite();
    expect(leaving).toHaveBeenCalledTimes(1);
    offLeaving();

    // A consumer arriving after teardown must not be woken by the abandoned window.
    const arriving = vi.fn<() => void>();
    tracked(arriving);
    vi.advanceTimersByTime(10_000);
    expect(arriving).not.toHaveBeenCalled();
  });

  it('unsubscribing twice is safe', () => {
    const listener = vi.fn<() => void>();
    const off = subscribeVerseWrites(listener);
    off();
    off();

    notifyVerseWrite();
    expect(listener).not.toHaveBeenCalled();
  });

  it('notify with no listeners does not throw', () => {
    expect(() => notifyVerseWrite()).not.toThrow();
  });
});
