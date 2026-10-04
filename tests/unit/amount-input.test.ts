// 金额输入清洗单测（component-contract.md §1 键盘行口径：白名单 + 多小数点折叠）
import { describe, expect, it } from 'vitest';
import { amountToInputString, sanitizeAmount } from '../../components/global/amount-input';

describe('sanitizeAmount', () => {
  it('剥离白名单外字符（粘贴 1,000,000 → 1000000）', () => {
    expect(sanitizeAmount('1,000,000')).toBe('1000000');
  });

  it('多个小数点折叠为首个点（1.2.3 → 1.23；1.2.3.4 → 1.234）', () => {
    expect(sanitizeAmount('1.2.3')).toBe('1.23');
    expect(sanitizeAmount('1.2.3.4')).toBe('1.234');
  });

  it('单个尾随点在首位后保留（1. → 1.；1.2. → 1.2）', () => {
    expect(sanitizeAmount('1.')).toBe('1.');
    expect(sanitizeAmount('1.2.')).toBe('1.2');
  });

  it('空串与纯非法输入', () => {
    expect(sanitizeAmount('')).toBe('');
    expect(sanitizeAmount('abc')).toBe('');
    expect(sanitizeAmount('.')).toBe('.');
  });

  it('合法输入原样通过', () => {
    expect(sanitizeAmount('123')).toBe('123');
    expect(sanitizeAmount('0.5')).toBe('0.5');
  });
});

describe('amountToInputString', () => {
  it('小值走十进制整串不吐科学计数法（1e-7 落到 6 位精度地面 → 0）', () => {
    expect(amountToInputString(1e-7)).toBe('0');
  });

  it('6 位精度去尾零', () => {
    expect(amountToInputString(1234.5678901)).toBe('1234.56789');
    expect(amountToInputString(5)).toBe('5');
    expect(amountToInputString(0.5)).toBe('0.5');
  });

  it('0/非有限值返回空串', () => {
    expect(amountToInputString(0)).toBe('');
    expect(amountToInputString(Number.NaN)).toBe('');
  });
});
