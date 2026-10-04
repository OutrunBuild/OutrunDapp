// 滑点设置项校验单测（component-contract.md §25 设置层：接受域 0.01–50%）
import { describe, expect, it } from 'vitest';
import {
  SLIPPAGE_MAX,
  SLIPPAGE_MIN,
  getSlippageIssue,
  slippageErrorCopyKey,
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
