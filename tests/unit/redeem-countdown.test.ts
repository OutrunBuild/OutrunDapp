// @vitest-environment jsdom
// The vault's redemption countdown must keep an absolute deadline: a re-probe delivers a
// freshly dated remainingMs while the row stays mounted, and the countdown already on screen
// may not rebase (performance.md: display countdowns store the deadline, not "remaining +
// probe time"). Wall rows (client-probed) read the real clock — the probe predates the mount,
// so the snapshot must not anchor their timeline either. Fake timers make the invariants
// deterministic — the wall clock is faked too.
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RedeemCountdown } from '../../components/verse/redeem-countdown';

const DEADLINE = '2026-10-28T01:00:00Z';
/** Snapshot remaining at mount: exactly one hour to the deadline. */
const SNAPSHOT_MS = 3_600_000;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-28T00:00:00Z'));
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function render(
  remainingMs: number,
  timeBase: 'wall' | 'frozen' = 'frozen',
  onMature?: () => void,
): void {
  act(() => {
    root.render(
      createElement(RedeemCountdown, {
        maturesAt: DEADLINE,
        remainingMs,
        template: 'in {t}',
        timeBase,
        onMature,
      }),
    );
  });
}

function text(): string {
  return container.textContent ?? '';
}

describe('RedeemCountdown time base', () => {
  it('first paint renders the snapshot value without reading the clock', () => {
    render(SNAPSHOT_MS);
    expect(text()).toBe('in 01:00:00');
  });

  it('a re-probe snapshot does not rebase a countdown already on screen', () => {
    render(SNAPSHOT_MS);
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(text()).toBe('in 00:59:58');

    // The card re-read the vault after a confirmed write: the new row says ~16 minutes left,
    // but the deadline and the origin are unchanged, so the displayed value must not jump.
    render(1_000_000);
    expect(text()).toBe('in 00:59:58');

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(text()).toBe('in 00:59:57');
  });

  it('wall rows read the real clock: a probe older than the mount shows the true remaining', () => {
    // System reality: the probe ran 30s before the countdown mounts (tab navigation gap), so
    // the snapshot says 01:00:00 while the wall clock says 00:59:30 — the display follows the
    // wall clock, not the stale snapshot.
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    render(SNAPSHOT_MS, 'wall');
    expect(text()).toBe('in 00:59:30');

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(text()).toBe('in 00:59:29');

    // A re-probe snapshot (freshly dated remainingMs) must not rebase the wall timeline either.
    render(1_000_000, 'wall');
    expect(text()).toBe('in 00:59:29');
  });

  it('stops at zero and never renders a negative span', () => {
    render(SNAPSHOT_MS);
    act(() => {
      vi.advanceTimersByTime(SNAPSHOT_MS + 5_000);
    });
    expect(text()).toBe('in 00:00:00');
  });
});

describe('RedeemCountdown onMature', () => {
  it('a wall row fires onMature once when the real clock crosses the deadline', () => {
    const onMature = vi.fn();
    render(SNAPSHOT_MS, 'wall', onMature);
    act(() => {
      vi.advanceTimersByTime(SNAPSHOT_MS + 2_000);
    });
    expect(text()).toBe('in 00:00:00');
    expect(onMature).toHaveBeenCalledTimes(1);

    // Still ticking past the deadline: one instance signals one zero-crossing.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onMature).toHaveBeenCalledTimes(1);
  });

  it('a frozen (sample) row never fires onMature', () => {
    const onMature = vi.fn();
    render(SNAPSHOT_MS, 'frozen', onMature);
    act(() => {
      vi.advanceTimersByTime(SNAPSHOT_MS + 5_000);
    });
    expect(text()).toBe('in 00:00:00');
    expect(onMature).not.toHaveBeenCalled();
  });

  it('a wall row mounted past its deadline fires onMature on mount', () => {
    const onMature = vi.fn();
    // Tab re-entry: the zero-crossing happened while no row was mounted, so the fresh
    // instance must signal immediately instead of waiting for its first interval tick.
    act(() => {
      vi.advanceTimersByTime(SNAPSHOT_MS + 1_000);
    });
    render(SNAPSHOT_MS, 'wall', onMature);
    expect(text()).toBe('in 00:00:00');
    expect(onMature).toHaveBeenCalledTimes(1);
  });
});
