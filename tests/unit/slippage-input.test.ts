// 滑点设置项校验单测（component-contract.md §25 设置层：接受域 0.01–50%）
import { describe, expect, it } from 'vitest';
import {
  DEADLINE_PRESETS,
  SLIPPAGE_MAX,
  SLIPPAGE_MIN,
  SLIPPAGE_PRESETS,
  deadlineToNumber,
  getSlippageIssue,
  isWholeMinutes,
  slippageErrorCopyKey,
  slippageToNumber,
} from '../../components/global/slippage-input';

describe('getSlippageIssue', () => {
  it('接受域内（含边界）通过：0.01 / 0.5 / 1 / 50 → null', () => {
    expect(getSlippageIssue(SLIPPAGE_MIN)).toBeNull();
    expect(getSlippageIssue(0.5)).toBeNull();
    expect(getSlippageIssue(1)).toBeNull();
    expect(getSlippageIssue(SLIPPAGE_MAX)).toBeNull();
  });

  it('低于下界报 below-min：0（零容忍必回退）与 0.001', () => {
    expect(getSlippageIssue(0)).toBe('below-min');
    expect(getSlippageIssue(0.001)).toBe('below-min');
  });

  it('超过上界报 above-max：50.0001 / 99 / 150（150 曾致最少收到转负）', () => {
    expect(getSlippageIssue(50.0001)).toBe('above-max');
    expect(getSlippageIssue(99)).toBe('above-max');
    expect(getSlippageIssue(150)).toBe('above-max');
  });

  it('非有限数按 below-min 兜底（NaN 比较恒 false，不得静默判合法）', () => {
    expect(getSlippageIssue(Number.NaN)).toBe('below-min');
    expect(getSlippageIssue(Number.POSITIVE_INFINITY)).toBe('below-min');
  });
});

describe('slippageErrorCopyKey', () => {
  it('越界类别映射到对应文案键（below-min→tooLow、above-max→tooHigh）', () => {
    expect(slippageErrorCopyKey('below-min')).toBe('slippageTooLow');
    expect(slippageErrorCopyKey('above-max')).toBe('slippageTooHigh');
  });
});

describe('isWholeMinutes / 预设档（2026-10-08 由 swap-panel 迁入）', () => {
  it('整分钟（含预设 10/20/30）通过、非整分钟与 0/负数拒绝', () => {
    for (const preset of DEADLINE_PRESETS) expect(isWholeMinutes(preset)).toBe(true);
    expect(isWholeMinutes(1.5)).toBe(false);
    expect(isWholeMinutes(0)).toBe(false);
  });

  it('预设档口径不变：滑点 0.1/0.5/1、截止 10/20/30', () => {
    expect([...SLIPPAGE_PRESETS]).toEqual([0.1, 0.5, 1]);
    expect([...DEADLINE_PRESETS]).toEqual([10, 20, 30]);
  });
});

describe('slippageToNumber / deadlineToNumber（§25 受控 string 口径，P1-1 修）', () => {
  it('正常串原样转数（含尾随小数点——键入中间态不落盘前的推导快照）', () => {
    expect(slippageToNumber('0.5')).toBe(0.5);
    expect(slippageToNumber('25')).toBe(25);
    // 留点中间态 '0.' 的推导值=0（展示层仍原样显示 '0.'，报错走 below-min）
    expect(slippageToNumber('0.')).toBe(0);
    expect(deadlineToNumber('1.5')).toBe(1.5);
  });

  it('空串/非法回退既有口径：滑点→0（零容忍报错）、截止→1 分钟', () => {
    expect(slippageToNumber('')).toBe(0);
    expect(slippageToNumber('.')).toBe(0);
    expect(deadlineToNumber('')).toBe(1);
    expect(deadlineToNumber('.')).toBe(1);
  });
});
