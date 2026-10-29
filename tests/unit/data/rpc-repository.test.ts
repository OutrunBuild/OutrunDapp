// RPC onchain-repository tests (stage 5 step 3): every method's raw-contract → ViewModel
// mapping is verified against a stub RpcPort (interface-level mock, §11.1 — the RPC edge is
// mocked, the domain mapping rules on top of it are what these tests lock). Configs come from the
// real resolveOutrunChain with stubbed ENV, so the deployment-JSON key conventions (Faucet/
// OutrunPSM.UUSD/UAsset.* /Mock* token names) are exercised against real data.
import { describe, expect, it } from 'vitest';
import { buildRpcRepository } from '../../../lib/data/repository';
import { resolveOutrunChain } from '../../../lib/web3/chains';
import type { ContractCallSpec, ReceiptView, RpcPort } from '../../../lib/web3/rpc-port';

const RPC_ENV = {
  ALCHEMY_KEY_ARB_SEPOLIA: 'k',
  INFURA_KEY_ARB_SEPOLIA: 'k',
  ALCHEMY_KEY_BASE_SEPOLIA: 'k',
  INFURA_KEY_BASE_SEPOLIA: 'k',
  ALCHEMY_KEY_BSC_TESTNET: 'k',
  INFURA_KEY_BSC_TESTNET: 'k',
};

/** Order-preserving stub port: enqueue per-functionName responses; Error values throw (call) or
 *  become probe failures */
class StubPort implements RpcPort {
  received: ContractCallSpec[] = [];
  private queue = new Map<string, unknown[]>();
  state = {
    balance: 0n,
    code: '0x',
    nonce: 0,
    blockNumber: 0,
    receipt: null as ReceiptView | null,
  };
  enqueue(fn: string, ...values: unknown[]) {
    const q = this.queue.get(fn) ?? [];
    q.push(...values);
    this.queue.set(fn, q);
  }
  private next(fn: string): unknown {
    const q = this.queue.get(fn);
    if (!q || q.length === 0) throw new Error(`stub port: no queued response for ${fn}`);
    return q.shift();
  }
  async call(s: ContractCallSpec) {
    this.received.push(s);
    const v = this.next(s.functionName);
    if (v instanceof Error) throw v;
    return v;
  }
  multicall(specs: readonly ContractCallSpec[]) {
    return Promise.all(specs.map((s) => this.call(s)));
  }
  async probe(s: ContractCallSpec) {
    this.received.push(s);
    const v = this.next(s.functionName);
    return v instanceof Error
      ? { ok: false as const, reason: v.message }
      : { ok: true as const, data: v };
  }
  async getBalance() {
    return this.state.balance;
  }
  async getCode() {
    return this.state.code;
  }
  async getTransactionCount() {
    return this.state.nonce;
  }
  async getBlockNumber() {
    return this.state.blockNumber;
  }
  async getTransactionReceipt() {
    return this.state.receipt;
  }
}

const USER = '0x1111111111111111111111111111111111111111';
const LIMIT = 1_000_000n * 10n ** 18n;

const setup = () => {
  const ports = new Map<number, StubPort>();
  const repo = buildRpcRepository(
    (chainId) => ports.get(chainId) ?? null,
    (chainId) => resolveOutrunChain(chainId, RPC_ENV),
  );
  const port = (chainId: number) => {
    const p = new StubPort();
    ports.set(chainId, p);
    return p;
  };
  return { repo, port };
};

describe('getAccountState (§9.1 balance/nonce/EIP-7702 code)', () => {
  it('maps empty code to eoa', async () => {
    const { repo, port } = setup();
    const p = port(97);
    p.state = { ...p.state, balance: 10n ** 18n, nonce: 5, code: '0x' };
    const r = await repo.getAccountState(97, USER);
    expect(r).toMatchObject({
      status: 'ok',
      data: { address: USER, nativeBalance: 10n ** 18n, nonce: 5, delegation: 'eoa' },
    });
  });

  it('maps 0xef0100+manifest address to kernel-delegated, mismatched to unsupported', async () => {
    const { repo, port } = setup();
    const p = port(97);
    const kernel = 'd6cedde84be40893d153be9d467cd6ad37875b28';
    p.state.code = '0xef0100' + kernel;
    const delegated = await repo.getAccountState(97, USER);
    expect(delegated).toMatchObject({ status: 'ok', data: { delegation: 'kernel-delegated' } });

    p.state.code = '0xef0100' + 'ab'.repeat(20);
    const unsupported = await repo.getAccountState(97, USER);
    expect(unsupported).toMatchObject({
      status: 'ok',
      data: { delegation: 'unsupported-delegation' },
    });

    p.state.code = '0xdeadbeef';
    const contract = await repo.getAccountState(97, USER);
    expect(contract).toMatchObject({ status: 'ok', data: { delegation: 'contract' } });
  });
});

describe('token balances / allowances (bounded multicall)', () => {
  it('maps balanceOf/symbol/decimals triples per token', async () => {
    const { repo, port } = setup();
    const p = port(97);
    const t1 = '0xaaaa000000000000000000000000000000000001';
    const t2 = '0xbbbb000000000000000000000000000000000002';
    p.enqueue('balanceOf', 100n, 0n);
    p.enqueue('symbol', 'UUSD', 'USDC');
    p.enqueue('decimals', 18, 18);
    const r = await repo.getTokenBalances(97, USER, [t1, t2]);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.data).toEqual([
      { address: t1, symbol: 'UUSD', decimals: 18, balance: 100n },
      { address: t2, symbol: 'USDC', decimals: 18, balance: 0n },
    ]);
    expect(p.received.find((s) => s.functionName === 'balanceOf')?.args).toEqual([USER]);
  });

  it('maps allowances per token', async () => {
    const { repo, port } = setup();
    const p = port(97);
    const spender = '0xcccc000000000000000000000000000000000003';
    p.enqueue('allowance', 50n, 0n);
    const r = await repo.getAllowances(97, USER, spender, ['0x1', '0x2']);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.data).toEqual([
      { token: '0x1', spender, amount: 50n },
      { token: '0x2', spender, amount: 0n },
    ]);
  });
});

describe('finality / receipts', () => {
  it('subtracts safeBlockLag from the head block (97: lag 15)', async () => {
    const { repo, port } = setup();
    const p = port(97);
    p.state.blockNumber = 1000;
    const r = await repo.getSafeBlockNumber(97);
    expect(r).toEqual({ status: 'ok', data: 985 });
  });

  it('maps receipt status and null', async () => {
    const { repo, port } = setup();
    const p = port(97);
    p.state.receipt = {
      status: 'success',
      blockNumber: 42,
      gasUsed: 21000n,
      from: USER,
      to: '0x2',
    };
    const okR = await repo.getTransactionReceipt(97, '0xabc');
    expect(okR).toEqual({
      status: 'ok',
      data: { status: 'success', blockNumber: 42, gasUsed: 21000n, from: USER, to: '0x2' },
    });
    p.state.receipt = null;
    const nullR = await repo.getTransactionReceipt(97, '0xabc');
    expect(nullR).toEqual({ status: 'ok', data: null });
  });
});

describe('R-07 faucet status', () => {
  it('serves only tokens with dailyLimit>0, probes claim, reads the UUSD PSM pair', async () => {
    const { repo, port } = setup();
    const p = port(97);
    // three mock tokens registered in deployments/97; the second is not served by the faucet
    p.enqueue('tokenInfos', LIMIT, 0n, LIMIT);
    p.enqueue('symbol', 'USDC', 'aUSDC');
    p.enqueue('name', 'Mock USDC', 'Mock Aave USDC');
    p.enqueue('claim', 'ok', new Error('ClaimTooSoon'));
    // PSM tin/tout are 18-dec point values (1e18 = 100%): 1e15 = 0.1%
    p.enqueue('tin', 1_000_000_000_000_000n);
    p.enqueue('tout', 1_000_000_000_000_000n);
    p.enqueue('stockCap', 100n);
    p.enqueue('netUAssetMinted', 30n);
    p.enqueue('uAsset', '0xuusd');
    p.enqueue('reserveToken', '0xusdc');
    p.enqueue('balanceOf', 7n, 8n);
    const r = await repo.getFaucetStatus(97, USER);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.data.tokens).toHaveLength(2);
    expect(r.data.tokens[0]).toMatchObject({ symbol: 'USDC', dailyLimit: LIMIT, claimable: true });
    expect(r.data.tokens[1]).toMatchObject({ symbol: 'aUSDC', claimable: false });
    expect(r.data.swap).toEqual({
      psm: r.data.swap.psm,
      uAsset: '0xuusd',
      reserve: '0xusdc',
      tinWad: 1_000_000_000_000_000n,
      toutWad: 1_000_000_000_000_000n,
      headroom: 70n,
      myUAsset: 7n,
      myReserve: 8n,
    });
  });

  it('clamps negative PSM headroom to 0 and skips account reads without an account', async () => {
    const { repo, port } = setup();
    const p = port(97);
    p.enqueue('tokenInfos', LIMIT, 0n, 0n);
    p.enqueue('symbol', 'USDC');
    p.enqueue('name', 'Mock USDC');
    p.enqueue('tin', 0n);
    p.enqueue('tout', 0n);
    p.enqueue('stockCap', 10n);
    p.enqueue('netUAssetMinted', 25n);
    p.enqueue('uAsset', '0xuusd');
    p.enqueue('reserveToken', '0xusdc');
    const r = await repo.getFaucetStatus(97);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.data.swap.headroom).toBe(0n);
    expect(r.data.swap.myUAsset).toBeNull();
    expect(r.data.tokens[0]!.claimable).toBeNull();
    expect(p.received.filter((s) => s.functionName === 'balanceOf')).toHaveLength(0);
  });
});

describe('R-06 referral snapshot', () => {
  it('reads the rate and per-uAsset pending rebates', async () => {
    const { repo, port } = setup();
    const p = port(97);
    p.enqueue('referrerRebateBps', 1000n);
    p.enqueue('pendingRebateOf', 1n, 2n, 3n);
    const r = await repo.getReferralSnapshot(97, USER);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.data.ratePercent).toBe(10);
    expect(r.data.pending).toHaveLength(3);
    expect(r.data.pending.every((row) => row.amount >= 1n && row.amount <= 3n)).toBe(true);
    const pendingSpec = p.received.find((s) => s.functionName === 'pendingRebateOf')!;
    expect(pendingSpec.args).toEqual([USER, expect.any(String)]);
  });
});

describe('R-03 registration preview', () => {
  it('routes the symbol gate to the registration hub chain', async () => {
    const { repo, port } = setup();
    const p = port(97); // 97 is the only testnet carrying MemeverseRegistrationCenter
    p.enqueue('previewRegistration', true);
    p.enqueue('minDurationDays', 3n);
    p.enqueue('maxDurationDays', 30n);
    const r = await repo.getRegistrationPreview('MOON');
    expect(r).toEqual({
      status: 'ok',
      data: {
        hubChainId: 97,
        symbolAvailable: true,
        minDurationDays: 3,
        maxDurationDays: 30,
        lockupDays: 365,
      },
    });
    const specArg = p.received.find((s) => s.functionName === 'previewRegistration')!.args;
    expect(specArg).toEqual(['MOON']);
  });
});

describe('R-04 verse entitlements and runtime', () => {
  it('maps userGenesis/userPreorder/claim state (msg.sender read carries the account)', async () => {
    const { repo, port } = setup();
    const p = port(97);
    p.enqueue('userGenesisData', [100n, false, false]);
    p.enqueue('userPreorderData', [50n, 0n, false]);
    p.enqueue('normalYTClaimed', true);
    p.enqueue('claimablePreorderMemecoin', 25n);
    p.enqueue('pendingAuxiliaryGovFeeStates', [1n, 2n]);
    const r = await repo.getGenesisEntitlements(97, 21n, USER);
    expect(r).toEqual({
      status: 'ok',
      data: {
        genesisFund: 100n,
        genesisIsRefunded: false,
        genesisIsRedeemed: false,
        preorderFunds: 50n,
        preorderClaimedMemecoin: 0n,
        preorderIsRefunded: false,
        normalYTClaimed: true,
        claimablePreorderMemecoin: 25n,
        pendingUAssetFee: 1n,
        pendingPTFee: 2n,
      },
    });
    const claimable = p.received.find((s) => s.functionName === 'claimablePreorderMemecoin')!;
    expect(claimable.account).toBe(USER);
  });

  it('getAccountGenesisFunds sums the normal leg and the on-chain leveraged conversion', async () => {
    const { repo, port } = setup();
    const p = port(97);
    p.enqueue('userGenesisData', [100n, false, false]);
    p.enqueue('getUserLeveragedDebt', 40n);
    const r = await repo.getAccountGenesisFunds(97, 21n, USER);
    expect(r).toEqual({ status: 'ok', data: 140n });
    const genesis = p.received.find((s) => s.functionName === 'userGenesisData')!;
    expect(genesis.args).toEqual([21n, USER]);
  });

  it('maps the launcher stage enum and capacity state', async () => {
    const { repo, port } = setup();
    const p = port(97);
    p.enqueue('getStageByVerseId', 2);
    p.enqueue('paused', false);
    p.enqueue('remainingGenesisCapacity', 900n);
    p.enqueue('previewPreorderCapacity', 90n);
    p.enqueue('getUAssetByVerseId', '0xuusd');
    const r = await repo.getVerseRuntime(97, 21n);
    expect(r).toEqual({
      status: 'ok',
      data: {
        stage: 'locked',
        paused: false,
        remainingGenesisCapacity: 900n,
        remainingPreorderCapacity: 90n,
        uAsset: '0xuusd',
      },
    });
  });

  it('quotes a swap through the hook lens', async () => {
    const { repo, port } = setup();
    const p = port(97);
    p.enqueue('quoteSwap', [50n, 1000n, 940n, 5n, 5n, true]);
    const pool = {
      currency0: '0x0',
      currency1: '0x1',
      fee: 3000,
      tickSpacing: 60,
      hooks: '0xhook',
    };
    const r = await repo.getSwapQuote(97, pool, true, 1000n, USER);
    expect(r).toEqual({
      status: 'ok',
      data: {
        feeBps: 50n,
        estimatedUserInputAmount: 1000n,
        estimatedUserOutputAmount: 940n,
        estimatedProtocolFeeAmount: 5n,
        estimatedLpFeeAmount: 5n,
        protocolFeeOnInput: true,
      },
    });
    const specArg = p.received.find((s) => s.functionName === 'quoteSwap')!.args;
    expect(specArg![0]).toBe('0xhook');
  });
});

describe('R-04 verse financials (preorder ratio / min success / leverage market)', () => {
  it('maps launcher parameters + fund metadata + POLend lend market (viem struct shapes)', async () => {
    const { repo, port } = setup();
    const p = port(97);
    // Named structs decode as objects (viem decodeTuple), unnamed outputs as arrays —
    // the mock returns post-decode values exactly as the port contract receives them
    // (enqueue: each argument is one call's response)
    p.enqueue('getLauncherParameters', {
      executorRewardRate: 1n,
      preorderCapRatio: 8000n,
      preorderVestingDuration: 60n,
      oftReceiveGasLimit: 300000n,
      yieldDispatcherGasLimit: 200000n,
    });
    p.enqueue('fundMetaDatas', [1000000n * 10n ** 18n, 1000n]);
    p.enqueue('getLeveragedDebtInfo', {
      totalLeveragedInterest: 0n,
      totalLeveragedDebt: 0n,
      interestRate: 2n * 10n ** 17n,
      debtCap: 2000000n * 10n ** 18n,
      remainingAdditionalInterest: 0n,
    });
    const r = await repo.getVerseFinancials(97, 21n, '0xuusd');
    expect(r).toEqual({
      status: 'ok',
      data: {
        preorderCapRatioBps: 8000n,
        minTotalFund: 1000000n * 10n ** 18n,
        interestRate: 2n * 10n ** 17n,
        debtCap: 2000000n * 10n ** 18n,
      },
    });
  });
});

describe('PSM / USR vault / CDP reads (rates & capacity)', () => {
  it('maps PSM tin/tout/stockCap/netMinted', async () => {
    const { repo, port } = setup();
    const p = port(97);
    // PSM tin/tout are 18-dec point values (1e18 = 100%): 1e15 = 0.1%
    p.enqueue('tin', 1_000_000_000_000_000n);
    p.enqueue('tout', 1_000_000_000_000_000n);
    p.enqueue('stockCap', 100n);
    p.enqueue('netUAssetMinted', 1n);
    p.enqueue('uAsset', '0xuusd');
    p.enqueue('reserveToken', '0xusdc');
    const r = await repo.getPsmState(97, '0xpsm');
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.data).toMatchObject({
      psm: '0xpsm',
      uAsset: '0xuusd',
      reserve: '0xusdc',
      tinWad: 1_000_000_000_000_000n,
      toutWad: 1_000_000_000_000_000n,
      stockCap: 100n,
    });
  });

  it('maps USR vault state with optional account holdings', async () => {
    const { repo, port } = setup();
    const p = port(97);
    p.enqueue('usrRate', 0n);
    p.enqueue('accrualIndex', 1n * 10n ** 18n);
    p.enqueue('totalAssets', 500n);
    p.enqueue('asset', '0xuusd');
    p.enqueue('balanceOf', 12n);
    p.enqueue('convertToAssets', 24n);
    const r = await repo.getUsrVaultState(97, '0xvault', USER);
    expect(r).toEqual({
      status: 'ok',
      data: {
        vault: '0xvault',
        asset: '0xuusd',
        usrRate: 0n,
        accrualIndex: 1n * 10n ** 18n,
        totalAssets: 500n,
        account: { address: USER, shares: 12n, assets: 24n },
      },
    });
  });

  it('maps a CDP position tuple', async () => {
    const { repo, port } = setup();
    const p = port(97);
    p.enqueue('positions', [USER, 100n, 80n, 2n, 0n]);
    const r = await repo.getCdpPosition(97, '0xsp', 7n);
    expect(r).toEqual({
      status: 'ok',
      data: {
        positionId: 7n,
        owner: USER,
        syStaked: 100n,
        principalDebt: 80n,
        accruedInterest: 2n,
        lastRate: 0n,
      },
    });
  });
});

describe('structured unavailable states (never throws, never falls back)', () => {
  it('not-configured when the chain has no provisioned port', async () => {
    const { repo } = setup();
    const r = await repo.getAccountState(97, USER);
    expect(r).toMatchObject({ status: 'unavailable', reason: 'not-configured' });
  });

  it('undeployed when the chain config carries no contracts (mainnet)', async () => {
    const { repo, port } = setup();
    port(1); // port provisioned, but chain 1 resolves structurally undeployed
    const r = await repo.getFaucetStatus(1, USER);
    expect(r).toMatchObject({ status: 'unavailable', reason: 'undeployed' });
  });

  it('rpc-error when the transport fails', async () => {
    const { repo, port } = setup();
    const p = port(97);
    p.enqueue('tokenInfos', new Error('transport down'));
    const r = await repo.getFaucetStatus(97, USER);
    expect(r).toMatchObject({
      status: 'unavailable',
      reason: 'rpc-error',
      detail: 'transport down',
    });
  });
});

// ---------------------------------------------------------------------------
// Governance cycle rows: the body multicall drops the previous-cycle legs when cycleId is 0,
// so treasury/rewards sit at different indices per branch. A fixed index would silently serve
// the previous cycle's timing row as this cycle's treasury.
// ---------------------------------------------------------------------------

describe('getGovernanceSnapshot (hasPrevious row indexing)', () => {
  const INCENTIVIZER = '0x3333333333333333333333333333333333333333';

  it('maps a genesis cycle (cycleId 0) with the previous-less layout', async () => {
    const { repo, port } = setup();
    const p = port(97);
    p.enqueue('currentCycleId', 0n);
    p.enqueue('CYCLE_DURATION', 86_400n);
    // body = [cycleInfo(0), getTreasuryBalances(0), getRemainingClaimableRewards]
    p.enqueue('cycleInfo', [11n, 22n, 33n]);
    p.enqueue('getTreasuryBalances', [['0xt0'], [7n]]);
    p.enqueue('getRemainingClaimableRewards', [['0xr0'], [9n]]);

    const r = await repo.getGovernanceSnapshot(97, INCENTIVIZER);
    expect(r).toMatchObject({
      status: 'ok',
      data: {
        currentCycleId: 0n,
        cycleDurationSecs: 86_400n,
        current: { startTime: 11n, endTime: 22n, totalVotes: 33n },
        previous: null,
        treasury: { tokens: ['0xt0'], balances: [7n] },
        previousTreasury: null,
        rewards: { tokens: ['0xr0'], amounts: [9n] },
      },
    });
  });

  it('shifts treasury/rewards indices when a previous cycle exists', async () => {
    const { repo, port } = setup();
    const p = port(97);
    p.enqueue('currentCycleId', 2n);
    p.enqueue('CYCLE_DURATION', 86_400n);
    // body = [cycleInfo(2), cycleInfo(1), treasury(2), treasury(1), rewards]
    p.enqueue('cycleInfo', [100n, 200n, 300n]);
    p.enqueue('cycleInfo', [10n, 20n, 30n]);
    p.enqueue('getTreasuryBalances', [['0xcur'], [5n]]);
    p.enqueue('getTreasuryBalances', [['0xprev'], [6n]]);
    p.enqueue('getRemainingClaimableRewards', [['0xrw'], [7n]]);

    const r = await repo.getGovernanceSnapshot(97, INCENTIVIZER);
    expect(r).toMatchObject({
      status: 'ok',
      data: {
        current: { startTime: 100n, endTime: 200n, totalVotes: 300n },
        previous: { startTime: 10n, endTime: 20n, totalVotes: 30n },
        treasury: { tokens: ['0xcur'], balances: [5n] },
        previousTreasury: { tokens: ['0xprev'], balances: [6n] },
        rewards: { tokens: ['0xrw'], amounts: [7n] },
      },
    });
  });
});

// ---------------------------------------------------------------------------
// Stake sources: the registry is chain-read, so an SP bound to another uAsset family must be
// filtered out; a failed anchor preview degrades that token to null instead of blocking the row.
// ---------------------------------------------------------------------------

describe('getStakeSources (family binding + preview degradation)', () => {
  const UUSD = '0x00000000000000000000000000000000000000aa';
  const UETH = '0x00000000000000000000000000000000000000bb';
  const SY_USDS = '0x00000000000000000000000000000000000000c1';
  const SY_AUSDC = '0x00000000000000000000000000000000000000c2';
  const SY_LISBNB = '0x00000000000000000000000000000000000000c3';
  const TOKEN_A = '0x00000000000000000000000000000000000000d1';
  const TOKEN_B = '0x00000000000000000000000000000000000000d2';
  const ZERO = '0x0000000000000000000000000000000000000000';

  it('keeps only the requested family and nulls a failed preview leg', async () => {
    const { repo, port } = setup();
    const p = port(97);
    // deployment order in deployments/97.json: sUSDS, aUSDC, slisBNB
    p.enqueue('uAsset', UUSD, UETH, UUSD);
    p.enqueue('SY', SY_USDS, SY_AUSDC, SY_LISBNB);
    // kept sources in deployment order: sUSDS then slisBNB (one zero placeholder dropped)
    p.enqueue('getTokensIn', [TOKEN_A, ZERO]);
    p.enqueue('getTokensIn', [TOKEN_B]);
    p.enqueue('symbol', 'USDS', 'LISBNB');
    p.enqueue('decimals', 18, 18);
    p.enqueue('previewStakeFromToken', 2n * 10n ** 18n, new Error('preview reverted'));

    const r = await repo.getStakeSources(97, UUSD);
    expect(r.status).toBe('ok');
    const rows = r.status === 'ok' ? r.data : [];
    expect(rows.map((row) => row.name)).toEqual([
      'OutrunStakingPosition.sUSDS',
      'OutrunStakingPosition.slisBNB',
    ]);
    expect(rows[0].tokens).toEqual([
      {
        address: TOKEN_A,
        symbol: 'USDS',
        decimals: 18,
        anchorValue: 2,
        previewBase: 2n * 10n ** 18n,
      },
    ]);
    expect(rows[1].tokens).toEqual([
      { address: TOKEN_B, symbol: 'LISBNB', decimals: 18, anchorValue: null, previewBase: null },
    ]);
  });
});
