// Neutral ViewModel types shared by the fixture mode (fixture-repository) and onchain mode (RPC/Graph)
// data paths. Zero-dependency leaf: importing fixtures/** or fixture-repository here is forbidden
// (fixture-boundary-contract); both sides re-export or implement these shapes so pages never see
// raw ABI tuples (architecture.md §4).
export type SourceRecord = { id: string; sourceRef: string };

export type FixtureCreateConfig = {
  /** Allowed genesis duration range (center min/maxDurationDays read-value sample) */
  minDurationDays: number;
  maxDurationDays: number;
  /** Fixed lockup: unlockTime = endTime + 365 days (FIXED_LOCKUP_DURATION contract constant, not a registration parameter) */
  lockupDays: number;
  /** Cross-chain fan-out fee sample per remote chain (in governance-chain native asset; fee=0 for hub-chain targets); no registration fee */
  remoteDeployFee: number;
  /** LayerZero send fee sample for origin-chain -> registration-hub-chain when registering from a remote chain (quoteRegister;
   *  same-chain origin=0); sample scenario assumption = governance chain is the registration hub chain */
  remoteSendFee: number;
  sourceRef: string;
};

export type FixtureReferralAssetAmount = {
  assetId: string;
  symbol: string;
  chainId: number;
  chainName: string;
  amount: number;
  /** Sample-price conversion; no sample price=null (the ≈$ row is not rendered) */
  usd: number | null;
};

export type FixtureReferralTransaction = {
  txId: string;
  friendAddress: string;
  chainId: number;
  chainName: string;
  rebate: { symbol: string; amount: number; usd: number | null };
  at: string;
};

export type FixtureReferralFriend = {
  address: string;
  joinedAt: string;
  volumeUsd: number;
  earnedUsd: number;
};

export type FixtureReferral = {
  /** Link owner=sample account (owner is not in referral.json, derived from accounts to prevent drift between the two) */
  owner: string;
  referralCode: string;
  /** Rebate rate (percentage of total fees; onchain mode reads hook referrerRebateBps()) */
  ratePercent: number;
  /** Cumulative earned USD (sum of earned × usdSample; rows without a sample price count as 0) */
  totalEarnedUsd: number;
  /** Claimable USD (same convention) */
  pendingUsd: number;
  friendsCount: number;
  earned: FixtureReferralAssetAmount[];
  pending: FixtureReferralAssetAmount[];
  transactions: FixtureReferralTransaction[];
  friends: FixtureReferralFriend[];
};

export type FixtureFaucetToken = {
  symbol: string;
  name: string;
  /** Daily claim allowance (contract dailyLimit, one-time full mint) */
  dailyLimit: number;
  /** Cooldown remaining milliseconds sample (0=claimable; >0=ClaimTooSoon error domain).
   *  null=unreadable on-chain (Faucet getter exposes no per-user lastClaimed; 2026-10-14 user
   *  ruling: null renders no cooldown slot, claimable set comes from claim() probes) */
  cooldownRemainingMs: number | null;
};

export type FixtureFaucet = {
  chainId: number;
  chainName: string;
  tokens: FixtureFaucetToken[];
  swap: {
    uAssetSymbol: string;
    reserveSymbol: string;
    /** mint fee rate (ratio, 10bps->0.001) */
    feeIn: number;
    /** redeem fee rate (ratio) */
    feeOut: number;
    /** Mint allowance headroom (stockCap−netMinted sample); null=slot */
    headroom: number | null;
    /** Sample account's UUSD balance (Max source for the Back to USDC direction) */
    myUAsset: number;
    /** Sample account's reserve balance (Max source for the Get UUSD direction) */
    myReserve: number;
  };
};
