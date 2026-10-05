// 创世参与表单 Balance/Max 的余额口径：balances.json 按符号跨链合计；
// 快照无行的符号（USDT、sy 资产）不出现在表内 → 面板槽位态（-- + Max 禁用）
import { describe, expect, it } from 'vitest';

import { getFixtureWalletBalances } from '../../lib/data/fixture-repository';

describe('getFixtureWalletBalances：符号跨链合计', () => {
  const balances = getFixtureWalletBalances();

  it('uAsset 多链行相加（UETH = 80000 + 40000 + 5000）', () => {
    expect(balances.UETH).toBe(125000);
  });

  it('credit 与储备同样入表（跨链合计）', () => {
    expect(balances['UETH(Credit)']).toBe(1200);
    expect(balances.USDC).toBe(30000);
    expect(balances.ETH).toBe(12.5);
  });

  it('快照无行的符号缺席（USDT / sy 资产 → 槽位态）', () => {
    expect(balances.USDT).toBeUndefined();
    expect(balances.sUSDe).toBeUndefined();
    expect(balances.wstETH).toBeUndefined();
  });
});
