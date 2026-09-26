// 四池交易对符号口径（2026-09-23 用户裁定 + 合约真源）：
// POL/PT 是品类，实际 ERC20 symbol = `POL-<MEME>` / `PT-<MEME>`
// （Memeverse/src/verse/MemeverseLaunchImpl.sol:117-119、Memeverse/src/polend/POLSplitterUpgradeable.sol:225）
import { describe, expect, it } from 'vitest';

import { getPrototypeVerseTrade } from '../../lib/data/prototype-repository';

describe('四池交易对符号：品类前缀 + verse symbol', () => {
  it('locked verse（verse-002 / PEPE2）四池对符号带 MEME 后缀', () => {
    const trade = getPrototypeVerseTrade('verse-002');
    if (!trade) throw new Error('verse-002 fixture 缺 markets');
    const pairs = trade.pools.map((pool) => `${pool.baseSymbol}/${pool.quoteSymbol}`);
    expect(pairs).toContain('PEPE2/UETH');
    expect(pairs).toContain('POL-PEPE2/UETH');
    expect(pairs).toContain('PT-PEPE2/UETH');
    expect(pairs).toContain('PT-PEPE2/POL-PEPE2');
  });

  it('unlocked verse（verse-003 / WOJAK）同口径', () => {
    const trade = getPrototypeVerseTrade('verse-003');
    if (!trade) throw new Error('verse-003 fixture 缺 markets');
    for (const pool of trade.pools) {
      if (pool.pool === 'main') continue;
      expect(pool.baseSymbol.startsWith('POL-WOJAK') || pool.baseSymbol.startsWith('PT-WOJAK')).toBe(true);
    }
    const ptPol = trade.pools.find((pool) => pool.pool === 'pt-pol');
    expect(ptPol).toMatchObject({ baseSymbol: 'PT-WOJAK', quoteSymbol: 'POL-WOJAK' });
  });
});
