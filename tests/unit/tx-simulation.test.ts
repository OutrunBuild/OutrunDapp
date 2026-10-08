// 交易签名模拟驱动单测（component-contract §8：T4 签名 →≈1.6s→ T5 上链确认 →≈1.2s→
// T6 已确认；卸载清挂起定时器；onConfirmed 承载注册流开弹窗差异）——2026-10-08 两处
// 内联复制收敛为共享 hook 的配测，先例=amount-format/slippage-input 收敛配测
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

  it('T4→T5→T6 按契约时序推进，onConfirmed 抵 T6 恰调一次', () => {
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

  it('onConfirmed 可选：参与流（无回调）推进到 T6 不抛', () => {
    const { result } = renderHook(() => useTxSimulation());
    act(() => {
      result.current.beginSigning();
    });
    act(() => {
      vi.advanceTimersByTime(2800);
    });
    expect(result.current.txState).toBe('confirmed');
  });

  it('resetTx 回 idle 且不清挂起定时器（与收敛前两处内联实现同语义；运行期由「修改钮仅 idle 渲染」护栏兜底）', () => {
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

  it('卸载清挂起定时器：无残留计时、定时器回调不再触发', () => {
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
