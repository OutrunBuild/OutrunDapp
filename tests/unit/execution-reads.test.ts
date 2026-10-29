// Execution-read resolution tests: tuple-index access against stub readers (no chain).
import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';

import {
  deriveVersePreorderUsed,
  poolSideKinds,
  quoteRegistrationFanOut,
  readAllowances,
  readErc20Meta,
  readGenesisLedger,
  readGenesisParticipation,
  readPoolKey,
  readSwapQuote,
  readSwapSpotOutPerIn,
  readVerseAddresses,
  readVerseAggregates,
  resolvePoolTokens,
  type ContractReader,
} from '../../components/global/execution-reads';

const TOKEN_A = '0x3333333333333333333333333333333333333333' as Hex;
const TOKEN_B = '0x4444444444444444444444444444444444444444' as Hex;
const ROUTER = '0x5555555555555555555555555555555555555555' as Hex;

const stubReader = (routes: Record<string, unknown>): ContractReader => ({
  read: async ({ functionName }) => {
    const value = routes[functionName];
    if (value === undefined) throw new Error(`unstubbed ${functionName}`);
    return value;
  },
});

describe('readVerseAddresses', () => {
  it('picks uAsset/memecoin/pol/vault/governor by tuple index', async () => {
    const reader = stubReader({
      getMemeverseByVerseId: [
        'Name',
        'SYM',
        'uri',
        'desc',
        TOKEN_A,
        1,
        false,
        TOKEN_B,
        TOKEN_A,
        TOKEN_B,
        TOKEN_A,
        TOKEN_B,
        0n,
        0n,
        [],
      ],
    });
    await expect(readVerseAddresses(reader, ROUTER, 21n)).resolves.toEqual({
      uAsset: TOKEN_A,
      memecoin: TOKEN_B,
      pol: TOKEN_A,
      yieldVault: TOKEN_B,
      governor: TOKEN_A,
    });
  });

  it('accepts the named-object decode shape (viem named struct outputs)', async () => {
    // viem returns {field: value} in ABI declaration order when the getter's outputs are
    // named — the positional index mapping must survive both shapes (2026-10-23 incident:
    // the object shape threw 'unexpected tuple shape' on the first successful onchain read).
    const reader = stubReader({
      getMemeverseByVerseId: {
        name: 'Name',
        symbol: 'SYM',
        uri: 'uri',
        desc: 'desc',
        uAsset: TOKEN_A,
        currentStage: 1,
        flashGenesis: false,
        memecoin: TOKEN_B,
        pol: TOKEN_A,
        yieldVault: TOKEN_B,
        governor: TOKEN_A,
        incentivizer: TOKEN_B,
        endTime: 0n,
        unlockTime: 0n,
        omnichainIds: [],
      },
    });
    await expect(readVerseAddresses(reader, ROUTER, 21n)).resolves.toEqual({
      uAsset: TOKEN_A,
      memecoin: TOKEN_B,
      pol: TOKEN_A,
      yieldVault: TOKEN_B,
      governor: TOKEN_A,
    });
  });
});

describe('readGenesisLedger', () => {
  it('maps the per-kind amounts and the launcher one-shot refund flags', async () => {
    const reader = stubReader({
      // userGenesisData tuple: (genesisFund, isRefunded, isRedeemed)
      userGenesisData: [100n, true, false],
      // userPreorderData tuple: (funds, claimedMemecoin, isRefunded)
      userPreorderData: [20n, 0n, false],
      totalInterestPaid: 5n,
    });
    await expect(readGenesisLedger(reader, ROUTER, TOKEN_A, 21n, TOKEN_B)).resolves.toEqual({
      normal: 100n,
      normalRefunded: true,
      preorder: 20n,
      preorderRefunded: false,
      interest: 5n,
    });
  });

  it('accepts the named-object decode shape for the launcher tuples', async () => {
    const reader = stubReader({
      userGenesisData: { fund: 7n, isRefunded: false, isRedeemed: false },
      userPreorderData: { funds: 2n, claimedMemecoin: 0n, isRefunded: true },
      totalInterestPaid: 1n,
    });
    await expect(readGenesisLedger(reader, ROUTER, TOKEN_A, 21n, TOKEN_B)).resolves.toEqual({
      normal: 7n,
      normalRefunded: false,
      preorder: 2n,
      preorderRefunded: true,
      interest: 1n,
    });
  });
});

describe('readGenesisParticipation', () => {
  it('sums normal funds and the rate-converted leveraged debt (equivalent genesis funds)', async () => {
    const reader = stubReader({
      // userGenesisData tuple: (genesisFund, isRefunded, isRedeemed)
      userGenesisData: [100n, false, false],
      // POLend getUserLeveragedDebt: (real+credit interest) × 1e18 ÷ interestRate — rate
      // conversion happens on-chain, the client just adds the two legs.
      getUserLeveragedDebt: 25n,
    });
    await expect(readGenesisParticipation(reader, ROUTER, TOKEN_A, 21n, TOKEN_B)).resolves.toEqual(
      125n,
    );
  });

  it('decodes zero ledgers for a non-participant', async () => {
    const reader = stubReader({
      userGenesisData: [0n, false, false],
      getUserLeveragedDebt: 0n,
    });
    await expect(readGenesisParticipation(reader, ROUTER, TOKEN_A, 21n, TOKEN_B)).resolves.toEqual(
      0n,
    );
  });
});

describe('readPoolKey', () => {
  it('maps the key tuple to named fields', async () => {
    const reader = stubReader({ getHookPoolKey: [TOKEN_A, TOKEN_B, 3000, 60, ROUTER] });
    await expect(readPoolKey(reader, ROUTER, TOKEN_A, TOKEN_B)).resolves.toEqual({
      currency0: TOKEN_A,
      currency1: TOKEN_B,
      fee: 3000,
      tickSpacing: 60,
      hooks: ROUTER,
    });
  });
});

describe('readSwapQuote', () => {
  it('returns fee and user amounts by index', async () => {
    const reader = stubReader({ quoteSwap: [30n, 1000n, 990n, 5n, 3n, true] });
    const key = {
      currency0: TOKEN_A,
      currency1: TOKEN_B,
      fee: 3000,
      tickSpacing: 60,
      hooks: ROUTER,
    };
    await expect(
      readSwapQuote(
        reader,
        ROUTER,
        key,
        { zeroForOne: true, amountSpecified: -1000n, sqrtPriceLimitX96: 1n },
        TOKEN_A,
      ),
    ).resolves.toEqual({
      feeBps: 30n,
      estimatedUserInputAmount: 1000n,
      estimatedUserOutputAmount: 990n,
      estimatedProtocolFeeAmount: 5n,
      estimatedLpFeeAmount: 3n,
      protocolFeeOnInput: true,
    });
  });
});

describe('readSwapSpotOutPerIn', () => {
  const HOOK = '0x6666666666666666666666666666666666666666' as Hex;
  const key = {
    currency0: TOKEN_A,
    currency1: TOKEN_B,
    fee: 0x800000,
    tickSpacing: 200,
    hooks: HOOK,
  };
  const E18 = 10n ** 18n;

  it('derives the spot as the full-range amount ratio at the live sqrtPrice', async () => {
    const reader = stubReader({
      cachedLpTotalSupply: 1000n,
      quoteAmountsForLiquidity: [10n * E18, 200n * E18],
    });
    await expect(
      readSwapSpotOutPerIn(reader, ROUTER, HOOK, key, TOKEN_A, 18, 18),
    ).resolves.toBeCloseTo(20);
  });

  it('inverts the ratio when the input leg is currency1', async () => {
    const reader = stubReader({
      cachedLpTotalSupply: 1000n,
      quoteAmountsForLiquidity: [10n * E18, 200n * E18],
    });
    await expect(
      readSwapSpotOutPerIn(reader, ROUTER, HOOK, key, TOKEN_B, 18, 18),
    ).resolves.toBeCloseTo(0.05);
  });

  it('carries each leg through its own decimals', async () => {
    const reader = stubReader({
      cachedLpTotalSupply: 1000n,
      quoteAmountsForLiquidity: [1n * E18, 3_000_000n],
    });
    await expect(
      readSwapSpotOutPerIn(reader, ROUTER, HOOK, key, TOKEN_A, 18, 6),
    ).resolves.toBeCloseTo(3);
  });

  it('degrades to null on an empty pool — the quote itself stays usable', async () => {
    const reader = stubReader({ cachedLpTotalSupply: 0n });
    await expect(
      readSwapSpotOutPerIn(reader, ROUTER, HOOK, key, TOKEN_A, 18, 18),
    ).resolves.toBeNull();
  });

  it('degrades to null on a read error instead of failing the quote pass', async () => {
    const reader = stubReader({});
    await expect(
      readSwapSpotOutPerIn(reader, ROUTER, HOOK, key, TOKEN_A, 18, 18),
    ).resolves.toBeNull();
  });
});

describe('erc20 reads', () => {
  it('reads meta', async () => {
    const reader = stubReader({ decimals: 6 });
    await expect(readErc20Meta(reader, TOKEN_A)).resolves.toEqual({ decimals: 6 });
  });
});

describe('poolSideKinds', () => {
  it('maps the four pool ids to side kinds', () => {
    expect(poolSideKinds('main')).toEqual(['meme', 'uasset']);
    expect(poolSideKinds('pol-uasset')).toEqual(['pol', 'uasset']);
    expect(poolSideKinds('pt-uasset')).toEqual(['pt', 'uasset']);
    expect(poolSideKinds('pt-pol')).toEqual(['pt', 'pol']);
  });
});

describe('resolvePoolTokens', () => {
  const session = {
    verse: {
      uAsset: TOKEN_A,
      memecoin: TOKEN_B,
      pol: ROUTER,
      yieldVault: TOKEN_A,
      governor: TOKEN_B,
    },
    contracts: { POLSplitter: ROUTER },
  };

  it('resolves registry sides without reads', async () => {
    const reader = stubReader({});
    await expect(resolvePoolTokens(reader, session, 'main', 21n)).resolves.toEqual({
      base: TOKEN_B,
      quote: TOKEN_A,
    });
  });

  it('resolves PT via the splitter view', async () => {
    const reader = stubReader({ getPT: TOKEN_B });
    await expect(resolvePoolTokens(reader, session, 'pt-pol', 21n)).resolves.toEqual({
      base: TOKEN_B,
      quote: ROUTER,
    });
  });
});

describe('readAllowances (click-path read)', () => {
  it('reads one allowance per pull leg and never issues the display balance read', async () => {
    const calls: string[] = [];
    const reader: ContractReader = {
      read: async ({ address, functionName }) => {
        calls.push(`${functionName}:${address}`);
        // balanceOf is a display read — putting it on the click path delays the dialog
        if (functionName !== 'allowance') throw new Error(`unexpected ${functionName}`);
        return address === TOKEN_A ? 5n : 0n;
      },
    };
    const allowances = await readAllowances(reader, ROUTER, [
      { token: TOKEN_A, spender: ROUTER },
      { token: TOKEN_B, spender: ROUTER },
    ]);
    expect(allowances).toEqual([5n, 0n]);
    expect(calls).toEqual([`allowance:${TOKEN_A}`, `allowance:${TOKEN_B}`]);
  });
});

describe('readVerseAggregates (post-write probe)', () => {
  it('decodes the named-struct debt info and the two launcher reads by position', async () => {
    const reader = stubReader({
      totalNormalFunds: 3n * 10n ** 18n,
      previewPreorderCapacity: 10n ** 17n,
      // viem decodes the single named struct as an object keyed by field name
      getLauncherParameters: {
        executorRewardRate: 0n,
        preorderCapRatio: 2_500n,
        preorderVestingDuration: 0n,
      },
      getLeveragedDebtInfo: {
        totalLeveragedInterest: 10n ** 17n,
        totalLeveragedDebt: 2n * 10n ** 18n,
        interestRate: 5n * 10n ** 16n,
        debtCap: 90n * 10n ** 18n,
        remainingAdditionalInterest: 89n * 10n ** 18n,
      },
    });
    await expect(readVerseAggregates(reader, ROUTER, TOKEN_A, 21n)).resolves.toEqual({
      normalBase: 3n * 10n ** 18n,
      interestBase: 10n ** 17n,
      debtBase: 2n * 10n ** 18n,
      interestRateBase: 5n * 10n ** 16n,
      debtCapBase: 90n * 10n ** 18n,
      remainingPreorderBase: 10n ** 17n,
      preorderCapRatioBps: 2_500n,
    });
  });

  it('also accepts the positional-array decode shape', async () => {
    const reader = stubReader({
      totalNormalFunds: 0n,
      previewPreorderCapacity: 0n,
      getLauncherParameters: [0n, 0n, 0n, 0n, 0n],
      getLeveragedDebtInfo: [0n, 0n, 0n, 0n, 0n],
    });
    await expect(readVerseAggregates(reader, ROUTER, TOKEN_A, 21n)).resolves.toEqual({
      normalBase: 0n,
      interestBase: 0n,
      debtBase: 0n,
      interestRateBase: 0n,
      debtCapBase: 0n,
      remainingPreorderBase: 0n,
      preorderCapRatioBps: 0n,
    });
  });
});

describe('deriveVersePreorderUsed (chain-exact reconstruction)', () => {
  // cap = (normal + debt) × 7 × ratio ÷ 1e5; used = cap − remaining
  it('reconstructs used funds from the probe reads (5 UUSD base, 25% ratio, 0.875 cap, 0.1 used)', () => {
    const ledger = {
      normalBase: 5n * 10n ** 18n,
      debtBase: 0n,
      remainingPreorderBase: 775n * 10n ** 15n,
    };
    expect(deriveVersePreorderUsed(ledger, 2_500n)).toBe(100n * 10n ** 15n);
  });

  it('clamps to zero when the remaining read exceeds the reconstructed ceiling', () => {
    expect(
      deriveVersePreorderUsed({ normalBase: 0n, debtBase: 0n, remainingPreorderBase: 5n }, 10_000n),
    ).toBe(0n);
  });

  it('a null ratio (unread config) leaves the reconstruction to the caller', () => {
    expect(
      deriveVersePreorderUsed({ normalBase: 5n, debtBase: 0n, remainingPreorderBase: 0n }, null),
    ).toBeNull();
  });
});

describe('quoteRegistrationFanOut', () => {
  const shape = {
    name: 'Osmosis Kitty',
    symbol: 'OSMK',
    uri: '',
    desc: 'desc',
    communities: [] as string[],
    omnichainIds: [97, 421614],
    uAsset: TOKEN_A,
    flashGenesis: false,
  };

  it('keeps the total fee from quoteSend positional outputs (totalFee, fees[], eids[])', async () => {
    const reader = stubReader({
      quoteSend: [1_234n, [1_000n, 234n], [97n, 421614n]],
    });
    await expect(quoteRegistrationFanOut(reader, ROUTER, shape)).resolves.toBe(1_234n);
  });

  it('unwraps viem named-output objects by declaration order', async () => {
    const reader = stubReader({
      quoteSend: { totalFee: 55n, fees: [30n, 25n], eids: [40231n, 40245n] },
    });
    await expect(quoteRegistrationFanOut(reader, ROUTER, shape)).resolves.toBe(55n);
  });

  it('passes the target set through and encodes a non-empty fan-out message', async () => {
    let seen: { functionName: string; args?: readonly unknown[] } | null = null;
    const reader: ContractReader = {
      read: async (params) => {
        seen = params;
        return [7n, [], []];
      },
    };
    await quoteRegistrationFanOut(reader, ROUTER, shape);
    const call = seen as unknown as { functionName: string; args?: readonly unknown[] };
    expect(call.functionName).toBe('quoteSend');
    expect(call.args?.[0]).toEqual([97, 421614]);
    expect(String(call.args?.[1]).startsWith('0x')).toBe(true);
  });

  it('a failed quote degrades to null instead of a fabricated 0', async () => {
    const reader = stubReader({});
    await expect(quoteRegistrationFanOut(reader, ROUTER, shape)).resolves.toBeNull();
  });
});
