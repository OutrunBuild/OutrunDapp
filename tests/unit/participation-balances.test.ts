// 创世参与表单 Balance/Max 的余额口径：balances.json 按符号跨链合计；
// 快照无行的符号（USDT、sy 资产）不出现在表内 → 面板槽位态（-- + Max 禁用）
import { describe, expect, it } from 'vitest';

import { getFixtureWalletBalances } from '../../lib/data/fixture-repository';

describe('getFixtureWalletBalances：符号跨链合计', () => {
  const balances = getFixtureWalletBalances();

  it('uAsset 多链行相加（UETH = 6 + 2.5 + 1；017 补充 2 真人量级样本）', () => {
    expect(balances.UETH).toBe(9.5);
  });

  it('credit 与储备同样入表（跨链合计）', () => {
    expect(balances['UETH(Credit)']).toBe(1.4);
    expect(balances.USDC).toBe(2500);
    expect(balances.ETH).toBe(0.9);
  });

  it('快照无行的符号缺席（USDT / sy 资产 → 槽位态）', () => {
    expect(balances.USDT).toBeUndefined();
    expect(balances.sUSDe).toBeUndefined();
    expect(balances.wstETH).toBeUndefined();
  });
});
