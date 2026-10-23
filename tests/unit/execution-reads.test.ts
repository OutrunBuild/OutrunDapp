// Execution-read resolution tests: tuple-index access against stub readers (no chain).
import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';

import {
  poolSideKinds,
  readErc20Meta,
  readErc20State,
  readPoolKey,
  readSwapQuote,
  readVerseAddresses,
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
    });
  });
});

describe('erc20 reads', () => {
  it('reads meta and state', async () => {
    const reader = stubReader({ decimals: 6, balanceOf: 500n, allowance: 100n });
    await expect(readErc20Meta(reader, TOKEN_A)).resolves.toEqual({ decimals: 6 });
    await expect(readErc20State(reader, TOKEN_A, TOKEN_B, ROUTER)).resolves.toEqual({
      balance: 500n,
      allowance: 100n,
    });
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
