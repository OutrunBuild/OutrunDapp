// Transaction-signature simulation driver unit tests: T4 signing →≈1.6s→ T5
// on-chain confirming →≈1.2s→ T6 confirmed; unmount clears pending timers;
// onConfirmed carries the register-flow dialog-open difference. This is the
// companion test of the shared hook that replaced two inline copies.
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useTxSimulation } from '../../components/global/tx-simulation';

describe('useTxSimulation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('T4->T5->T6 advance on the contract timing, onConfirmed fires exactly once at T6', () => {
    const onConfirmed = vi.fn();
    const { result } = renderHook(() => useTxSimulation(onConfirmed));

    expect(result.current.txState).toBe('idle');
    act(() => {
      result.current.beginSigning();
    });
    expect(result.current.txState).toBe('signing');
    expect(onConfirmed).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1599);
    });
    expect(result.current.txState).toBe('signing');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.txState).toBe('confirming');
    expect(onConfirmed).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(result.current.txState).toBe('confirmed');
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it('onConfirmed optional: participation flow (no callback) advances to T6 without throwing', () => {
    const { result } = renderHook(() => useTxSimulation());
    act(() => {
      result.current.beginSigning();
    });
    act(() => {
      vi.advanceTimersByTime(2800);
    });
    expect(result.current.txState).toBe('confirmed');
  });

  // Consolidation history: same semantics as the two pre-consolidation inline
  // copies; runtime guarded by modify-button-rendered-only-at-idle.
  it('resetTx returns to idle without clearing pending timers (signing timer still fires)', () => {
    const { result } = renderHook(() => useTxSimulation());
    act(() => {
      result.current.beginSigning();
    });
    act(() => {
      result.current.resetTx();
    });
    expect(result.current.txState).toBe('idle');
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(result.current.txState).toBe('confirming');
  });

  it('unmount clears pending timers: no timers left, timer callbacks never fire', () => {
    const onConfirmed = vi.fn();
    const { result, unmount } = renderHook(() => useTxSimulation(onConfirmed));
    act(() => {
      result.current.beginSigning();
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onConfirmed).not.toHaveBeenCalled();
  });
});
