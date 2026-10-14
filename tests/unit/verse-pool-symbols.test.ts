// Four-pool pair symbol semantics:
// POL/PT are categories; the actual ERC20 symbol = `POL-<MEME>` / `PT-<MEME>`
// where <MEME> is the verse's memecoin symbol
import { describe, expect, it } from 'vitest';

import { getFixtureVerseTrade } from '../../lib/data/fixture-repository';

describe('four-pool pair symbols: category prefix + verse symbol', () => {
  it('locked verse (verse-002 / PEPE2) pool pair symbols carry the MEME suffix', () => {
    const trade = getFixtureVerseTrade('verse-002');
    if (!trade) throw new Error('verse-002 fixture missing markets');
    const pairs = trade.pools.map((pool) => `${pool.baseSymbol}/${pool.quoteSymbol}`);
    expect(pairs).toContain('PEPE2/UETH');
    expect(pairs).toContain('POL-PEPE2/UETH');
    expect(pairs).toContain('PT-PEPE2/UETH');
    expect(pairs).toContain('PT-PEPE2/POL-PEPE2');
  });

  it('unlocked verse (verse-003 / WOJAK) follows the same convention', () => {
    const trade = getFixtureVerseTrade('verse-003');
    if (!trade) throw new Error('verse-003 fixture missing markets');
    for (const pool of trade.pools) {
      if (pool.pool === 'main') continue;
      expect(
        pool.baseSymbol.startsWith('POL-WOJAK') || pool.baseSymbol.startsWith('PT-WOJAK'),
      ).toBe(true);
    }
    const ptPol = trade.pools.find((pool) => pool.pool === 'pt-pol');
    expect(ptPol).toMatchObject({ baseSymbol: 'PT-WOJAK', quoteSymbol: 'POL-WOJAK' });
  });
});
