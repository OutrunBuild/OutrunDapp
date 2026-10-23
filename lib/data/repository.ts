// Onchain data repository (contract read layer, §9.1 direct-RPC list) -- the real-data side of the
// OUTRUN_DATA_SOURCE=onchain mode; serves testnets now and mainnets after their deployment round.
// Only returns real data sources or structured unavailable states; never falls back to prototype
// data. Raw contract returns map to domain ViewModels before anything downstream sees them
// (architecture.md §4); the forbidden-word list is enforced literally by the onchain-resolver
// token rule in scripts/check-fixture-boundary.mjs (none of the listed words may appear here).
//
// RPC facts come from the frozen ABI set (contracts/abi/v1-rc) + deployments/{chainId}.json
// addresses via lib/web3; the RpcPort seam is the interface-level mock point for unit tests
// (§11.1: mock the RPC edge, never the domain mapping rules).
import type { Abi } from 'viem';
import {
  getChainConfig,
  TESTNET_CHAIN_IDS,
  type OutrunChainConfig,
  type ResolvedChain,
} from '../web3/chains';
import { getPublicClient } from '../web3/public-client';
import { createViemRpcPort } from '../web3/viem-rpc-port';
import type { ContractCallSpec, ReceiptView, RpcPort } from '../web3/rpc-port';
import {
  erc20ReadAbi,
  faucetAbi,
  hookAbi,
  hookLensAbi,
  launcherAbi,
  polendAbi,
  psmAbi,
  registrationCenterAbi,
  stakingPositionAbi,
  usrVaultAbi,
} from '../web3/abis';

export type DataUnavailable =
  | { reason: 'undeployed'; detail: string } // Structured undeployed (zero addresses/placeholders forbidden)
  | { reason: 'rpc-error'; detail: string }
  | { reason: 'not-configured'; detail: string };

export type DataResult<T> =
  { status: 'ok'; data: T } | ({ status: 'unavailable' } & DataUnavailable);

const unavailable = <T>(reason: DataUnavailable['reason'], detail: string): DataResult<T> => ({
  status: 'unavailable',
  reason,
  detail,
});
const ok = <T>(data: T): DataResult<T> => ({ status: 'ok', data });
const spec = (
  address: string,
  abi: Abi,
  functionName: string,
  args?: readonly unknown[],
  account?: string,
): ContractCallSpec => ({
  address,
  abi,
  functionName,
  ...(args ? { args } : {}),
  ...(account ? { account } : {}),
});

// ---------------------------------------------------------------------------
// §9.1 ViewModels (already-mapped contract reads; pages never see ABI tuples)
// ---------------------------------------------------------------------------

export type AccountStateView = {
  address: string;
  nativeBalance: bigint;
  nonce: number;
  /** EIP-7702 delegation state read from eth_getCode (§6.5 detection order) */
  delegation: 'eoa' | 'kernel-delegated' | 'unsupported-delegation' | 'contract';
};

export type TokenBalanceView = {
  address: string;
  symbol: string;
  decimals: number;
  balance: bigint;
};

export type AllowanceView = { token: string; spender: string; amount: bigint };

export type FaucetTokenView = {
  address: string;
  symbol: string;
  name: string;
  dailyLimit: bigint;
  /** claim() probe outcome; null = probe skipped (no account given) */
  claimable: boolean | null;
};

export type FaucetStatusView = {
  chainId: number;
  faucet: string;
  /** Tokens the faucet actually serves (tokenInfos dailyLimit > 0) */
  tokens: FaucetTokenView[];
  swap: {
    psm: string;
    uAsset: string;
    reserve: string;
    /** mint fee as 18-dec point value (1e18 = 100%; OutrunPSMUpgradeable tin) */
    tinWad: bigint;
    /** redeem fee as 18-dec point value (1e18 = 100%; OutrunPSMUpgradeable tout) */
    toutWad: bigint;
    /** stockCap − netUAssetMinted, clamped at 0 */
    headroom: bigint;
    /** account-scoped balances; null when no account was given */
    myUAsset: bigint | null;
    myReserve: bigint | null;
  };
};

export type ReferralSnapshotView = {
  /** referrerRebateBps / 100 (1000 bps -> 10) */
  ratePercent: number;
  /** in-kind pending rebates per supported fee currency */
  pending: Array<{ currency: string; amount: bigint }>;
};

export type RegistrationPreviewView = {
  /** Chain hosting MemeverseRegistrationCenter (symbol gate + duration bounds live there) */
  hubChainId: number;
  /** previewRegistration == true => symbol registrable now */
  symbolAvailable: boolean;
  minDurationDays: number;
  maxDurationDays: number;
  /** FIXED_LOCKUP_DURATION contract constant (365d), not a registration parameter */
  lockupDays: number;
};

export type GenesisEntitlementsView = {
  genesisFund: bigint;
  genesisIsRefunded: boolean;
  genesisIsRedeemed: boolean;
  preorderFunds: bigint;
  preorderClaimedMemecoin: bigint;
  preorderIsRefunded: boolean;
  normalYTClaimed: boolean;
  /** msg.sender-scoped read: the account must ride on the eth_call from-address */
  claimablePreorderMemecoin: bigint;
  pendingUAssetFee: bigint;
  pendingPTFee: bigint;
};

export type VerseRuntimeView = {
  /** Launcher Stage enum: 0 Genesis / 1 Refund / 2 Locked / 3 Unlocked */
  stage: 'genesis' | 'refund' | 'locked' | 'unlocked';
  paused: boolean;
  remainingGenesisCapacity: bigint;
  remainingPreorderCapacity: bigint;
  uAsset: string;
};

/** Genesis financial params (R-04): registration-time constraints the participation UI needs —
 * preorder capacity ratio (launcher parameters, bps), min success threshold (per-uAsset fund
 * metadata), leverage lend-market rate + debt cap (POLend). Raw units; scaling is the
 * consumer's concern. */
export type VerseFinancialsView = {
  preorderCapRatioBps: bigint;
  minTotalFund: bigint;
  interestRate: bigint;
  debtCap: bigint;
};

export type PsmStateView = {
  psm: string;
  reserve: string;
  uAsset: string;
  /** mint fee as 18-dec point value (1e18 = 100%; OutrunPSMUpgradeable tin) */
  tinWad: bigint;
  /** redeem fee as 18-dec point value (1e18 = 100%; OutrunPSMUpgradeable tout) */
  toutWad: bigint;
  stockCap: bigint;
  netMinted: bigint;
};

export type UsrVaultStateView = {
  vault: string;
  asset: string;
  usrRate: bigint;
  accrualIndex: bigint;
  totalAssets: bigint;
  account?: { address: string; shares: bigint; assets: bigint };
};

export type CdpPositionView = {
  positionId: bigint;
  owner: string;
  syStaked: bigint;
  principalDebt: bigint;
  accruedInterest: bigint;
  lastRate: bigint;
};

export type SwapQuotePool = {
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: number;
  hooks: string;
};

export type SwapQuoteView = {
  feeBps: bigint;
  estimatedUserInputAmount: bigint;
  estimatedUserOutputAmount: bigint;
  estimatedProtocolFeeAmount: bigint;
  estimatedLpFeeAmount: bigint;
  protocolFeeOnInput: boolean;
};

export interface OnchainRepository {
  /** Balances/allowances/nonce/EIP-7702 code (§9.1) */
  getAccountState(chainId: number, address: string): Promise<DataResult<AccountStateView>>;
  getTokenBalances(
    chainId: number,
    address: string,
    tokens: readonly string[],
  ): Promise<DataResult<TokenBalanceView[]>>;
  getAllowances(
    chainId: number,
    owner: string,
    spender: string,
    tokens: readonly string[],
  ): Promise<DataResult<AllowanceView[]>>;
  /** RPC head block minus the chain's safeBlockLag (finalityPolicy) */
  getSafeBlockNumber(chainId: number): Promise<DataResult<number>>;
  getTransactionReceipt(chainId: number, hash: string): Promise<DataResult<ReceiptView | null>>;

  /** R-07 faucet: daily limits + claimable probes + UUSD PSM pair state */
  getFaucetStatus(chainId: number, account?: string): Promise<DataResult<FaucetStatusView>>;
  /** R-06 referral: rate + in-kind pending rebates on the chain's fee currencies */
  getReferralSnapshot(chainId: number, referrer: string): Promise<DataResult<ReferralSnapshotView>>;
  /** R-03 launch: symbol gate + duration bounds from the registration hub chain */
  getRegistrationPreview(symbol: string): Promise<DataResult<RegistrationPreviewView>>;
  /** R-04 verse: user entitlements/claim state */
  getGenesisEntitlements(
    chainId: number,
    verseId: bigint,
    account: string,
  ): Promise<DataResult<GenesisEntitlementsView>>;
  /** R-04 verse: stage/pause/capacity runtime state */
  getVerseRuntime(chainId: number, verseId: bigint): Promise<DataResult<VerseRuntimeView>>;
  /** R-04 verse: genesis financial params (preorder ratio / min success / leverage rate+cap) */
  getVerseFinancials(
    chainId: number,
    verseId: bigint,
    uAsset: string,
  ): Promise<DataResult<VerseFinancialsView>>;
  /** Rates/capacity reads (§9.1) */
  getPsmState(chainId: number, psm: string): Promise<DataResult<PsmStateView>>;
  getUsrVaultState(
    chainId: number,
    vault: string,
    account?: string,
  ): Promise<DataResult<UsrVaultStateView>>;
  /** CDP position detail on a named OutrunStakingPosition deployment (id discovery is Graph-side) */
  getCdpPosition(
    chainId: number,
    stakingPosition: string,
    positionId: bigint,
  ): Promise<DataResult<CdpPositionView>>;
  /** R-04 trade desk quote via MemeverseUniswapHookLens (pool key comes from verse metadata) */
  getSwapQuote(
    chainId: number,
    pool: SwapQuotePool,
    zeroForOne: boolean,
    amountSpecified: bigint,
    trader: string,
  ): Promise<DataResult<SwapQuoteView>>;
}

type PortResolver = (chainId: number) => RpcPort | null;
type ConfigResolver = (chainId: number) => ResolvedChain;

const STAGE_NAMES = ['genesis', 'refund', 'locked', 'unlocked'] as const;
const FIXED_LOCKUP_DAYS = 365;
/** Faucet-served mock tokens (deployment contract key convention); SY mocks are not served */
const FAUCET_TOKEN_KEY_RE = /^Mock(USDC|SUSDS|AUSDC)$/;

function contractAddress(config: OutrunChainConfig, name: string): string | undefined {
  return config.contracts.status === 'deployed' ? config.contracts.addresses[name] : undefined;
}

class RpcOnchainRepository implements OnchainRepository {
  constructor(
    private readonly portFor: PortResolver,
    private readonly configFor: ConfigResolver = getChainConfig,
  ) {}

  private chain(chainId: number): DataResult<{ port: RpcPort; config: OutrunChainConfig }> {
    const resolved = this.configFor(chainId);
    if (resolved.status !== 'ok')
      return unavailable('not-configured', `chain ${chainId}: ${resolved.reason}`);
    const port = this.portFor(chainId);
    if (!port)
      return unavailable('not-configured', `chain ${chainId} has no provisioned RPC client`);
    return ok({ port, config: resolved.config });
  }

  private requireContract(config: OutrunChainConfig, name: string): DataResult<string> {
    const address = contractAddress(config, name);
    return address
      ? ok(address)
      : unavailable(
          'undeployed',
          `contract ${name} not present in deployments/${config.chainId}.json`,
        );
  }

  /** Wrap a port call: transport failures collapse to rpc-error, never throw to callers */
  private async guard<T>(fn: () => Promise<T>): Promise<DataResult<T>> {
    try {
      return ok(await fn());
    } catch (e) {
      return unavailable('rpc-error', e instanceof Error ? e.message : String(e));
    }
  }

  async getAccountState(chainId: number, address: string): Promise<DataResult<AccountStateView>> {
    const c = this.chain(chainId);
    if (c.status !== 'ok') return c;
    const { port, config } = c.data;
    return this.guard(async () => {
      const [nativeBalance, nonce, code] = await Promise.all([
        port.getBalance(address),
        port.getTransactionCount(address),
        port.getCode(address),
      ]);
      // §6.5 detection order: empty=EOA; 0xef0100-prefixed=7702 delegation (Kernel when the suffix
      // address matches the manifest, otherwise unsupported); other non-empty=plain contract
      let delegation: AccountStateView['delegation'] = 'contract';
      if (code === '0x') delegation = 'eoa';
      else if (code.startsWith('0xef0100')) {
        const implementation = '0x' + code.slice('0xef0100'.length).padStart(40, '0');
        delegation =
          implementation.toLowerCase() === config.kernel7702Implementation.toLowerCase()
            ? 'kernel-delegated'
            : 'unsupported-delegation';
      }
      return { address, nativeBalance, nonce, delegation };
    });
  }

  async getTokenBalances(
    chainId: number,
    address: string,
    tokens: readonly string[],
  ): Promise<DataResult<TokenBalanceView[]>> {
    const c = this.chain(chainId);
    if (c.status !== 'ok') return c;
    const { port } = c.data;
    if (tokens.length === 0) return ok([]);
    return this.guard(async () => {
      const raw = await port.multicall(
        tokens.flatMap((token) => [
          spec(token, erc20ReadAbi, 'balanceOf', [address]),
          spec(token, erc20ReadAbi, 'symbol'),
          spec(token, erc20ReadAbi, 'decimals'),
        ]),
      );
      const out: TokenBalanceView[] = [];
      for (let i = 0; i < tokens.length; i++) {
        out.push({
          address: tokens[i]!,
          symbol: raw[i * 3 + 1] as string,
          decimals: raw[i * 3 + 2] as number,
          balance: raw[i * 3] as bigint,
        });
      }
      return out;
    });
  }

  async getAllowances(
    chainId: number,
    owner: string,
    spender: string,
    tokens: readonly string[],
  ): Promise<DataResult<AllowanceView[]>> {
    const c = this.chain(chainId);
    if (c.status !== 'ok') return c;
    const { port } = c.data;
    if (tokens.length === 0) return ok([]);
    return this.guard(async () => {
      const raw = await port.multicall(
        tokens.map((token) => spec(token, erc20ReadAbi, 'allowance', [owner, spender])),
      );
      return raw.map((amount, i) => ({ token: tokens[i]!, spender, amount: amount as bigint }));
    });
  }

  async getSafeBlockNumber(chainId: number): Promise<DataResult<number>> {
    const c = this.chain(chainId);
    if (c.status !== 'ok') return c;
    const { port, config } = c.data;
    const lag = config.finalityPolicy?.safeBlockLag ?? 0;
    return this.guard(async () => Number(await port.getBlockNumber()) - lag);
  }

  async getTransactionReceipt(
    chainId: number,
    hash: string,
  ): Promise<DataResult<ReceiptView | null>> {
    const c = this.chain(chainId);
    if (c.status !== 'ok') return c;
    return this.guard(() => c.data.port.getTransactionReceipt(hash));
  }

  async getFaucetStatus(chainId: number, account?: string): Promise<DataResult<FaucetStatusView>> {
    const c = this.chain(chainId);
    if (c.status !== 'ok') return c;
    const { port, config } = c.data;
    const faucet = this.requireContract(config, 'Faucet');
    if (faucet.status !== 'ok') return faucet;
    const psm = this.requireContract(config, 'OutrunPSM.UUSD');
    if (psm.status !== 'ok') return psm;
    // Candidate tokens: the chain's mock-token deployments; the faucet itself decides
    // (tokenInfos dailyLimit > 0) which of them it actually serves
    const candidates =
      config.contracts.status === 'deployed'
        ? Object.entries(config.contracts.addresses)
            .filter(([name]) => FAUCET_TOKEN_KEY_RE.test(name))
            .map(([, address]) => address)
        : [];
    return this.guard(async () => {
      const limitRaw = await port.multicall(
        candidates.map((token) => spec(faucet.data, faucetAbi, 'tokenInfos', [token])),
      );
      const served = candidates.filter((_, i) => (limitRaw[i] as bigint) > 0n);
      const limits = served.map((token) => limitRaw[candidates.indexOf(token)] as bigint);
      const metaRaw = served.length
        ? await port.multicall(
            served.flatMap((token) => [
              spec(token, erc20ReadAbi, 'symbol'),
              spec(token, erc20ReadAbi, 'name'),
            ]),
          )
        : [];
      const probes = account
        ? await Promise.all(
            served.map((token) =>
              port.probe(spec(faucet.data, faucetAbi, 'claim', [token], account)),
            ),
          )
        : null;
      const tokens: FaucetTokenView[] = served.map((token, i) => ({
        address: token,
        symbol: metaRaw[i * 2] as string,
        name: metaRaw[i * 2 + 1] as string,
        dailyLimit: limits[i]!,
        claimable: probes ? probes[i]!.ok : null,
      }));

      const psmState = (await port.multicall([
        spec(psm.data, psmAbi, 'tin'),
        spec(psm.data, psmAbi, 'tout'),
        spec(psm.data, psmAbi, 'stockCap'),
        spec(psm.data, psmAbi, 'netUAssetMinted'),
        spec(psm.data, psmAbi, 'uAsset'),
        spec(psm.data, psmAbi, 'reserveToken'),
      ])) as [bigint, bigint, bigint, bigint, string, string];
      const [tinWad, toutWad, stockCap, netMinted, uAsset, reserve] = psmState;
      const balances = account
        ? await port.multicall([
            spec(uAsset, erc20ReadAbi, 'balanceOf', [account]),
            spec(reserve, erc20ReadAbi, 'balanceOf', [account]),
          ])
        : null;
      return {
        chainId,
        faucet: faucet.data,
        tokens,
        swap: {
          psm: psm.data,
          uAsset,
          reserve,
          tinWad,
          toutWad,
          headroom: stockCap > netMinted ? stockCap - netMinted : 0n,
          myUAsset: balances ? (balances[0] as bigint) : null,
          myReserve: balances ? (balances[1] as bigint) : null,
        },
      };
    });
  }

  async getReferralSnapshot(
    chainId: number,
    referrer: string,
  ): Promise<DataResult<ReferralSnapshotView>> {
    const c = this.chain(chainId);
    if (c.status !== 'ok') return c;
    const { port, config } = c.data;
    const hook = this.requireContract(config, 'MemeverseUniswapHook');
    if (hook.status !== 'ok') return hook;
    // Fee currencies on this chain = the uAsset family deployments
    const currencies =
      config.contracts.status === 'deployed'
        ? Object.entries(config.contracts.addresses)
            .filter(([name]) => name.startsWith('UAsset.'))
            .map(([, address]) => address)
        : [];
    return this.guard(async () => {
      const raw = await port.multicall([
        spec(hook.data, hookAbi, 'referrerRebateBps'),
        ...currencies.map((currency) =>
          spec(hook.data, hookAbi, 'pendingRebateOf', [referrer, currency]),
        ),
      ]);
      const bps = raw[0] as bigint;
      return {
        ratePercent: Number(bps) / 100,
        pending: currencies.map((currency, i) => ({
          currency,
          amount: raw[i + 1] as bigint,
        })),
      };
    });
  }

  async getRegistrationPreview(symbol: string): Promise<DataResult<RegistrationPreviewView>> {
    // Symbol gate + duration bounds live on the registration hub (MemeverseRegistrationCenter);
    // remote chains only carry the omnichain registrar facade
    const hubChainId = TESTNET_CHAIN_IDS.find((id) => {
      const resolved = this.configFor(id);
      return (
        resolved.status === 'ok' &&
        contractAddress(resolved.config, 'MemeverseRegistrationCenter') !== undefined
      );
    });
    if (hubChainId === undefined)
      return unavailable('undeployed', 'no deployed MemeverseRegistrationCenter on any testnet');
    const c = this.chain(hubChainId);
    if (c.status !== 'ok') return c;
    const center = this.requireContract(c.data.config, 'MemeverseRegistrationCenter');
    if (center.status !== 'ok') return center;
    const raw = await this.guard(() =>
      c.data.port.multicall([
        spec(center.data, registrationCenterAbi, 'previewRegistration', [symbol]),
        spec(center.data, registrationCenterAbi, 'minDurationDays'),
        spec(center.data, registrationCenterAbi, 'maxDurationDays'),
      ]),
    );
    if (raw.status !== 'ok') return raw;
    const [available, minDays, maxDays] = raw.data as [boolean, bigint, bigint];
    return ok({
      hubChainId,
      symbolAvailable: available,
      minDurationDays: Number(minDays),
      maxDurationDays: Number(maxDays),
      lockupDays: FIXED_LOCKUP_DAYS,
    });
  }

  async getGenesisEntitlements(
    chainId: number,
    verseId: bigint,
    account: string,
  ): Promise<DataResult<GenesisEntitlementsView>> {
    const c = this.chain(chainId);
    if (c.status !== 'ok') return c;
    const launcher = this.requireContract(c.data.config, 'MemeverseLauncher');
    if (launcher.status !== 'ok') return launcher;
    const { port } = c.data;
    const raw = await this.guard(() =>
      port.multicall([
        spec(launcher.data, launcherAbi, 'userGenesisData', [verseId, account]),
        spec(launcher.data, launcherAbi, 'userPreorderData', [verseId, account]),
        spec(launcher.data, launcherAbi, 'normalYTClaimed', [verseId, account]),
        spec(launcher.data, launcherAbi, 'claimablePreorderMemecoin', [verseId], account),
        spec(launcher.data, launcherAbi, 'pendingAuxiliaryGovFeeStates', [verseId]),
      ]),
    );
    if (raw.status !== 'ok') return raw;
    const [genesis, preorder, ytClaimed, claimable, auxFees] = raw.data as [
      [bigint, boolean, boolean],
      [bigint, bigint, boolean],
      boolean,
      bigint,
      [bigint, bigint],
    ];
    return ok({
      genesisFund: genesis[0],
      genesisIsRefunded: genesis[1],
      genesisIsRedeemed: genesis[2],
      preorderFunds: preorder[0],
      preorderClaimedMemecoin: preorder[1],
      preorderIsRefunded: preorder[2],
      normalYTClaimed: ytClaimed,
      claimablePreorderMemecoin: claimable,
      pendingUAssetFee: auxFees[0],
      pendingPTFee: auxFees[1],
    });
  }

  async getVerseRuntime(chainId: number, verseId: bigint): Promise<DataResult<VerseRuntimeView>> {
    const c = this.chain(chainId);
    if (c.status !== 'ok') return c;
    const launcher = this.requireContract(c.data.config, 'MemeverseLauncher');
    if (launcher.status !== 'ok') return launcher;
    const { port } = c.data;
    const raw = await this.guard(() =>
      port.multicall([
        spec(launcher.data, launcherAbi, 'getStageByVerseId', [verseId]),
        spec(launcher.data, launcherAbi, 'paused'),
        spec(launcher.data, launcherAbi, 'remainingGenesisCapacity', [verseId]),
        spec(launcher.data, launcherAbi, 'previewPreorderCapacity', [verseId]),
        spec(launcher.data, launcherAbi, 'getUAssetByVerseId', [verseId]),
      ]),
    );
    if (raw.status !== 'ok') return raw;
    const [stageRaw, paused, genesisCapacity, preorderCapacity, uAsset] = raw.data as [
      number,
      boolean,
      bigint,
      bigint,
      string,
    ];
    return ok({
      stage: STAGE_NAMES[stageRaw] ?? 'locked',
      paused,
      remainingGenesisCapacity: genesisCapacity,
      remainingPreorderCapacity: preorderCapacity,
      uAsset,
    });
  }

  async getVerseFinancials(
    chainId: number,
    verseId: bigint,
    uAsset: string,
  ): Promise<DataResult<VerseFinancialsView>> {
    const c = this.chain(chainId);
    if (c.status !== 'ok') return c;
    const launcher = this.requireContract(c.data.config, 'MemeverseLauncher');
    if (launcher.status !== 'ok') return launcher;
    const polend = this.requireContract(c.data.config, 'POLend');
    if (polend.status !== 'ok') return polend;
    const { port } = c.data;
    const raw = await this.guard(() =>
      port.multicall([
        spec(launcher.data, launcherAbi, 'getLauncherParameters'),
        spec(launcher.data, launcherAbi, 'fundMetaDatas', [uAsset]),
        spec(polend.data, polendAbi, 'getLeveragedDebtInfo', [verseId]),
      ]),
    );
    if (raw.status !== 'ok') return raw;
    // viem decode shape (decodeTuple: all-named components -> object, unnamed -> array):
    // getLauncherParameters/getLeveragedDebtInfo return single named structs -> objects keyed
    // by component name; fundMetaDatas returns two unnamed outputs -> positional array.
    // LauncherParameters = {executorRewardRate, preorderCapRatio, preorderVestingDuration,
    // oftReceiveGasLimit, yieldDispatcherGasLimit}; LeveragedDebtInfo = {totalInterest,
    // totalDebt, interestRate, debtCap, remainingAdditionalInterest}; FundMetaData =
    // [minTotalFund, fundBasedAmount]
    const [params, fundMeta, debtInfo] = raw.data as [
      { preorderCapRatio: bigint },
      [bigint, bigint],
      { interestRate: bigint; debtCap: bigint },
    ];
    return ok({
      preorderCapRatioBps: params.preorderCapRatio,
      minTotalFund: fundMeta[0],
      interestRate: debtInfo.interestRate,
      debtCap: debtInfo.debtCap,
    });
  }

  async getPsmState(chainId: number, psm: string): Promise<DataResult<PsmStateView>> {
    const c = this.chain(chainId);
    if (c.status !== 'ok') return c;
    const { port } = c.data;
    const raw = await this.guard(() =>
      port.multicall([
        spec(psm, psmAbi, 'tin'),
        spec(psm, psmAbi, 'tout'),
        spec(psm, psmAbi, 'stockCap'),
        spec(psm, psmAbi, 'netUAssetMinted'),
        spec(psm, psmAbi, 'uAsset'),
        spec(psm, psmAbi, 'reserveToken'),
      ]),
    );
    if (raw.status !== 'ok') return raw;
    const [tinWad, toutWad, stockCap, netMinted, uAsset, reserve] = raw.data as [
      bigint,
      bigint,
      bigint,
      bigint,
      string,
      string,
    ];
    return ok({ psm, reserve, uAsset, tinWad, toutWad, stockCap, netMinted });
  }

  async getUsrVaultState(
    chainId: number,
    vault: string,
    account?: string,
  ): Promise<DataResult<UsrVaultStateView>> {
    const c = this.chain(chainId);
    if (c.status !== 'ok') return c;
    const { port } = c.data;
    return this.guard(async () => {
      const base = await port.multicall([
        spec(vault, usrVaultAbi, 'usrRate'),
        spec(vault, usrVaultAbi, 'accrualIndex'),
        spec(vault, usrVaultAbi, 'totalAssets'),
        spec(vault, usrVaultAbi, 'asset'),
        ...(account ? [spec(vault, usrVaultAbi, 'balanceOf', [account])] : []),
      ]);
      if (!account) {
        return {
          vault,
          asset: base[3] as string,
          usrRate: base[0] as bigint,
          accrualIndex: base[1] as bigint,
          totalAssets: base[2] as bigint,
        };
      }
      const shares = base[4] as bigint;
      const assets = (await port.call(
        spec(vault, usrVaultAbi, 'convertToAssets', [shares]),
      )) as bigint;
      return {
        vault,
        asset: base[3] as string,
        usrRate: base[0] as bigint,
        accrualIndex: base[1] as bigint,
        totalAssets: base[2] as bigint,
        account: { address: account, shares, assets },
      };
    });
  }

  async getCdpPosition(
    chainId: number,
    stakingPosition: string,
    positionId: bigint,
  ): Promise<DataResult<CdpPositionView>> {
    const c = this.chain(chainId);
    if (c.status !== 'ok') return c;
    const raw = await this.guard(() =>
      c.data.port.call(spec(stakingPosition, stakingPositionAbi, 'positions', [positionId])),
    );
    if (raw.status !== 'ok') return raw;
    const [owner, syStaked, principalDebt, accruedInterest, lastRate] = raw.data as [
      string,
      bigint,
      bigint,
      bigint,
      bigint,
    ];
    return ok({ positionId, owner, syStaked, principalDebt, accruedInterest, lastRate });
  }

  async getSwapQuote(
    chainId: number,
    pool: SwapQuotePool,
    zeroForOne: boolean,
    amountSpecified: bigint,
    trader: string,
  ): Promise<DataResult<SwapQuoteView>> {
    const c = this.chain(chainId);
    if (c.status !== 'ok') return c;
    const lens = this.requireContract(c.data.config, 'MemeverseUniswapHookLens');
    if (lens.status !== 'ok') return lens;
    const raw = await this.guard(() =>
      c.data.port.call(
        spec(lens.data, hookLensAbi, 'quoteSwap', [
          pool.hooks,
          [pool.currency0, pool.currency1, pool.fee, pool.tickSpacing, pool.hooks],
          [zeroForOne, amountSpecified, 0n],
          trader,
        ]),
      ),
    );
    if (raw.status !== 'ok') return raw;
    const [feeBps, inAmount, outAmount, protocolFee, lpFee, protocolFeeOnInput] = raw.data as [
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      boolean,
    ];
    return ok({
      feeBps,
      estimatedUserInputAmount: inAmount,
      estimatedUserOutputAmount: outAmount,
      estimatedProtocolFeeAmount: protocolFee,
      estimatedLpFeeAmount: lpFee,
      protocolFeeOnInput,
    });
  }
}

/** Lazy module singleton: one onchain repository instance per server process */
let cached: OnchainRepository | null = null;

export function getOnchainRepository(): OnchainRepository {
  return (cached ??= new RpcOnchainRepository((chainId) => {
    const client = getPublicClient(chainId);
    return client ? createViemRpcPort(client) : null;
  }));
}

/** Test seam: build a repository against injected port/config resolvers (no env dependence) */
export function buildRpcRepository(
  portFor: PortResolver,
  configFor?: ConfigResolver,
): OnchainRepository {
  return new RpcOnchainRepository(portFor, configFor);
}
