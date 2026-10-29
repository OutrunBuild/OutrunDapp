// Fixture schema -- per-domain Zod schemas.
// This file describes prototype/test data shapes only; production code must not import it.
import { z } from 'zod';

/** Six-chain whitelist -- 3 mainnets + 3 testnets */
export const chainIdSchema = z.union([
  z.literal(1), z.literal(8453), z.literal(56),
  z.literal(421614), z.literal(84532), z.literal(97),
]);
export const CHAIN_IDS = [1, 8453, 56, 421614, 84532, 97] as const;

/** Unsigned decimal string (shared shape for amount raw / nonce / blockNumber; semantics distinguished by the wrapping domain) */
const decimalString = z.string().regex(/^\d+(\.\d+)?$/, 'decimal-string: ^\\d+(\\.\\d+)?$');
const uintString = z.string().regex(/^\d+$/, 'non-negative integer string');

/** Amount domain: raw + decimals (bare number amounts forbidden) */
export const amountSchema = z.object({
  raw: decimalString,
  decimals: z.number().int().min(0).max(18),
});

/** Rate domain: raw + unit + scale (bps=1e-4, ppm=1e-6, ratio=native) */
export const rateSchema = z.object({
  raw: decimalString,
  unit: z.enum(['bps', 'ppm', 'ratio']),
  scale: z.number().int().min(0).max(18),
});

/** nonce / blockNumber domain: non-negative integer strings only, no decimals */
export const nonceSchema = uintString;
export const blockNumberSchema = uintString;

/** Fixed UTC ISO time (relative times / running clocks forbidden) */
export const isoTimeSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/,
  'fixed UTC ISO string with Z',
);

/** Stable ID: prefix-integer (runtime random UUIDs forbidden) */
export const idSchema = z.string().regex(/^[a-z][a-z0-9-]*-\d{3,}$/, 'stable id: prefix-NNN');

/** fixture-only address: 0x40hex and must carry the fixtureOnly flag */
export const fixtureAddressSchema = z.object({
  value: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'EVM address'),
  fixtureOnly: z.literal(true),
});

/** fixture-only tx hash: 0x64hex and must carry the fixtureOnly flag */
const fixtureTxHashSchema = z.object({
  value: z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'EVM tx hash'),
  fixtureOnly: z.literal(true),
});

/** sourceRef: repo-relative path + section/commit anchor (absolute paths forbidden / /home forbidden) */
export const sourceRefSchema = z.string().refine(
  (s) =>
    !s.startsWith('/') &&
    !s.includes('..') &&
    !s.startsWith('home') &&
    (s.includes('#') || s.includes('@') || s.includes('§')),
  'sourceRef: repo-relative path + section anchor (#…/§…/@commit)',
);

/** Scenario IDs (allowed scenario vocabulary) */
export const scenarioIdSchema = z.enum([
  'normal', 'zero-balance', 'zero-position', 'paused', 'undeployed', 'rpc-fail',
  'index-lag', 'wrong-network', 'external-eoa', 'embedded-eoa', 'user-rejected',
  'unsupported-delegation', 'tx-failure',
  'psm-stockcap-full', 'psm-reserve-depleted', 'psm-dust-quote-zero',
  'usr-rate-zero', 'usr-capped', 'usr-share-growth',
  'cdp-debt-redeem', 'cdp-partial-redeem', 'cdp-insufficient-uasset',
]);
export type ScenarioId = z.infer<typeof scenarioIdSchema>;

/** Generic record shell */
export const recordSchema = z.object({
  id: idSchema,
  scenario: z.array(scenarioIdSchema).min(1),
  sourceRef: sourceRefSchema,
});

/** chains.json */
export const chainSchema = recordSchema.extend({
  chainId: chainIdSchema,
  name: z.string(),
  env: z.enum(['mainnet', 'testnet']),
  nativeSymbol: z.string(),
});

/** assets.json */
export const assetSchema = recordSchema.extend({
  symbol: z.string(),
  name: z.string().optional(), // Token proper name (reserve=real token canonical name Ethereum/USD Coin etc.; missing=components fall back to symbol)
  kind: z.enum(['uasset', 'reserve', 'sy', 'memecoin', 'share', 'credit']),
  decimals: z.number().int().min(0).max(18),
  anchorNote: z.string().optional(), // uAsset anchor qualifier (glossary A)
  pairedUAssetId: z.string().optional(), // credit-only: paired uAsset id (one-to-one, must not be cross-used; credit maps 1:1 to its uAsset via creditOf(uAsset))
  usdPrice: z.number().positive().optional(), // uAsset USD reference price (test data; production defers to oracle/on-chain reads)
  anchorValue: z.number().positive().optional(), // sy/reserve to anchor-asset conversion sample rate at real-time value (1 sy ≈ N anchor assets -> N uAsset; samples: sy wstETH≈1.05, sy stETH=1, reserve ETH=1; sample missing=components fall back to face value 1, no slot shown)
  address: fixtureAddressSchema.optional(),
  sp: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(), // stake-manager address driving the stake-funded genesis leg (FundInput.sp); only the on-chain registry carries it, fixture snapshots have no SP
});

/** verses.json (stage enum = user-visible face of the on-chain verse state machine) */
/** Verse social links (registration-phase metadata; kind->UI icon mapping lives in the presentation layer: website=Globe/x=AtSign/telegram=Send/discord=MessageCircle; display order=website,x,discord,telegram) */
export const verseSocialSchema = z.object({
  kind: z.enum(['website', 'x', 'telegram', 'discord']),
  url: z.string().url(),
});

export const verseSchema = recordSchema.extend({
  name: z.string(),
  symbol: z.string(),
  stage: z.enum(['genesis', 'locked', 'unlocked', 'refund']),
  governanceChain: chainIdSchema,
  createdAt: isoTimeSchema, // Genesis pool creation time (fixed UTC; used for Explore sorting/display)
  participants: z.number().int().positive(), // Participating-address count snapshot (used for Explore sorting/detail page display)
  description: z.string().optional(), // One-line description (registration-phase metadata; missing=UI does not render)
  socials: z.array(verseSocialSchema).optional(), // Social links (registration-phase metadata; missing=UI does not render)
  genesis: z.object({
    minSuccessThreshold: amountSchema,
    normalRaised: amountSchema,
    leverageInterest: amountSchema, // Independent dual-metric success check (normal funds and leverage interest are each compared against the threshold)
    preorderRaised: amountSchema,
    endsAt: isoTimeSchema,
    preorderCapacityRatio: rateSchema.optional(), // Preorder capacity ratio snapshot (capacity=(normal funds + leverage debt principal)×70%×capacity ratio; on-chain read parameter, missing -> section not rendered, submit disabled)
    leverageInterestRate: rateSchema.optional(), // Leverage one-time interest rate snapshot (locked at registration, not annualized; debt allowance=interest÷rate; on-chain read parameter, missing -> section not rendered, submit disabled)
    leverageDebtCap: amountSchema.optional(), // Leverage debt cap snapshot (in uAsset; current debt=interest collected÷rate; on-chain read parameter, missing -> section not rendered, submit disabled)
    fastGenesis: z.boolean().optional(), // Fast Mode: genesis ends early once any threshold is met (off by default)
  }),
  unlock: z.object({
    unlockedAtTx: isoTimeSchema.optional(), // Actual unlock transaction time = protection-period start
  }).optional(),
  // Post-launch market activity snapshot (shared by the discovery page's locked/unlocked cards, same field set;
  // on-chain read parameters -- staking yield and treasury accounting both come from trading-fee sharing, fees in
  // uAsset go into the DAO treasury; unlock time is not in the snapshot -- derived from
  // endTime+FIXED_LOCKUP_DURATION (contract constant); missing=unlock-time row not rendered)
  livePhase: z.object({
    volume24h: amountSchema, // 24h four-pool volume snapshot (in uAsset)
    stakingApy: rateSchema, // Staking APY snapshot (ratio: 5.688=568.8%)
    treasuryFundUsd: amountSchema, // DAO treasury balance snapshot (in USD; same USD display convention as the card-header market cap)
  }).optional(),
});

/** positions.json (open-term CDP; redeem is the only debt reducer) */
export const positionSchema = recordSchema.extend({
  chainId: chainIdSchema,
  owner: fixtureAddressSchema,
  collateral: z.object({ assetId: idSchema, amount: amountSchema }),
  debt: amountSchema, // Outstanding uAsset debt
  yieldSource: z.string(), // Yield-source brand (staking participation secondary copy)
  noMaturity: z.literal(true), // Plain-language convention data anchor
  openedFor: idSchema.optional(), // Position's origin Verse (staking participation opens the position atomically in the same tx; missing=minted as standalone Genesis Staking)
});

/** psm.json */
export const psmSchema = recordSchema.extend({
  chainId: chainIdSchema,
  uAssetId: idSchema,
  reserveId: idSchema,
  tin: rateSchema,
  tout: rateSchema,
  stockCap: amountSchema,
  netMinted: amountSchema, // headroom = stockCap − netMinted
  reserveAvailable: amountSchema,
});

/** usr-vaults.json */
export const usrVaultSchema = recordSchema.extend({
  chainId: chainIdSchema,
  assetId: idSchema, // suETH/suUSD/suBNB
  usrRate: rateSchema, // 0 = inactive (18-dec point value, recorded here per the rate domain)
  accrualIndexRaw: decimalString, // 1e18 domain
  lastSettledAt: isoTimeSchema,
  capped: z.boolean(), // Cap clamp domain flag
  myShares: amountSchema.optional(), // Sample account shares (missing=0 -> Portfolio empty state)
});

/** bridge-messages.json (per-stage success/failure samples) */
export const bridgeMessageSchema = recordSchema.extend({
  fromChain: chainIdSchema,
  toChain: chainIdSchema,
  assetId: idSchema,
  amount: amountSchema,
  sentAt: isoTimeSchema,
  stage: z.enum(['sent', 'delivered', 'settled', 'stranded']), // stranded=sent but not yet landed, manually recoverable
  remainderOnSource: amountSchema.optional(), // 6-decimal remainder left on the source chain
});

/** markets.json (four pools and fee-rate states) */
const candleSchema = z.object({
  t: isoTimeSchema, o: decimalString, h: decimalString, l: decimalString, c: decimalString,
  v: decimalString.optional(), // Candle volume (uAsset-denominated sample; missing=presentation layer treats as 0)
});
export const marketSchema = recordSchema.extend({
  verseId: idSchema,
  pool: z.enum(['main', 'pol-uasset', 'pt-uasset', 'pt-pol']),
  tvl: amountSchema,
  feeState: z.enum(['normal', 'opening-decay', 'dynamic-applied', 'paused-protection']),
  // Pool dynamic fee-rate sample (dynamic fee hook: base-rate floor 1% + dynamic term; contract constants
  // FEE_BASE_BPS=100/FEE_MAX_BPS=10000; in bps, steady-state pool sample bandwidth 100-800 bps
  // (1%-8%); value source for the Flash Swap fee row); missing=slot '--'
  feeRate: z.object({ raw: decimalString, unit: z.literal('bps'), scale: z.number().int().min(0).max(4) }).optional(),
  lpShareSample: z.object({ poolShare: rateSchema, pendingFees: amountSchema }).optional(),
  candles: z.array(candleSchema).max(500).optional(), // Main-pool candle sample (1h raw granularity; 4h/1d/1w aggregated by the presentation layer)
  candlesFine: z
    .object({
      '1m': z.array(candleSchema).max(500),
      '5m': z.array(candleSchema).max(500),
      '15m': z.array(candleSchema).max(500),
    })
    .optional(), // Fine-granularity candle samples (all granularities selectable, dummy data for preview)
  volume24h: amountSchema.optional(), // 24h volume snapshot (pool dimension; missing -> UI does not render)
  apr7d: rateSchema.optional(), // Trailing 7-day fee APR sample (display-derived value; missing -> this APR section not rendered)
  lpPerQuote: rateSchema.optional(), // LP mint-rate sample: LP amount minted per 1 quote-side asset supplied (totalSupply/R_quote formula convention; drives the Add Liquidity dialog output; missing -> dialog output falls back to 0.00 on empty)
  tokenStats: z.object({ // Carried by main-pool entries only (token stats bar)
    totalSupply: amountSchema, // Memecoin total-supply snapshot
    holders: z.number().int().positive(), // Holder count snapshot
    tokenAddress: fixtureAddressSchema, // Memecoin CA (fixture sample, not impersonating a deployed address)
  }).optional(),
});

/** transactions.json (kernel batch, Type-4 first-delegation, cross-chain and plain transaction samples) */
export const transactionSchema = recordSchema.extend({
  chainId: chainIdSchema,
  kind: z.enum(['kernel-batch', 'type4-first-delegation', 'cross-chain-send', 'plain']),
  state: z.enum(['reviewing', 'awaiting-signature', 'signing', 'submitting', 'confirming', 'success', 'failure', 'user-rejected']),
  nonce: nonceSchema,
  blockNumber: blockNumberSchema.optional(),
  submittedAt: isoTimeSchema.optional(),
  errorMsg: z.string().optional(), // failure scenario: decoded error + recovery-action copy key
});

/** governance.json */
/** Treasury breakdown composition rows (treasury/unclaimed-reward multi-asset composition dialogs; the concrete
 *  composition is sample data, totals anchored to the treasuryUAsset/remainingRewards convention) */
const governanceAssetSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  amount: amountSchema, // Quantity sample (converted at the unitPrice sample)
  usdValue: amountSchema, // USD value sample
});

export const governanceSchema = recordSchema.extend({
  verseId: idSchema,
  cycleNumber: uintString,
  cycleDurationDays: z.number().int().positive(), // On-chain read display (not a fixed 90)
  cycleEndsAt: isoTimeSchema,
  finalized: z.boolean(),
  claimWindowEndsAt: isoTimeSchema.optional(),
  // -- Everything below is the DAO tab's cycle-incentive surface; all optional:
  // verses without governance data show only the DAO heading (null-not-rendered) --
  governorAddress: fixtureAddressSchema.optional(), // Governor contract address (fixture sample)
  incentivizerAddress: fixtureAddressSchema.optional(), // Cycle incentive contract address (fixture sample)
  delegates: z.number().int().positive().optional(), // Delegated-address count snapshot
  totalVotingPower: amountSchema.optional(), // Total voting power (in sMemecoin)
  myVotes: amountSchema.optional(), // Sample account's current voting power
  treasuryUAsset: amountSchema.optional(), // Treasury uAsset balance snapshot (Governor custody)
  rewardRatio: rateSchema.optional(), // Allocation ratio (initial 2500bps=25%, governance-changeable)
  cumulativeIncentivePool: amountSchema.optional(), // Cumulative incentive pool (reward ledger balance)
  treasuryAssets: z.array(governanceAssetSchema).optional(), // Current-cycle treasury composition sample (treasury breakdown dialog)
  currentCycleVotes: z.object({
    total: amountSchema, // Current-cycle total votes (recorded into the current cycle at cast time)
    mine: amountSchema, // Sample account's current-cycle votes
  }).optional(),
  lastCycle: z.object({
    number: uintString,
    treasuryUAsset: amountSchema.optional(), // Previous cycle's end-of-cycle treasury (null=pricing unavailable -> row not rendered)
    treasuryAssets: z.array(governanceAssetSchema).optional(), // Previous cycle's end-of-cycle treasury composition sample (treasury breakdown dialog)
    remainingRewards: amountSchema.optional(), // Unclaimed rewards (after the window passes, merged into the treasury without reissue; null=pricing unavailable -> row not rendered)
    unclaimedAssets: z.array(governanceAssetSchema).optional(), // Unclaimed-reward composition sample (treasury breakdown dialog)
    totalVotes: amountSchema,
    myVotes: amountSchema,
    myClaimable: amountSchema, // Sample account's previous-cycle claimable (within window)
    claimableAssets: z.array(governanceAssetSchema).optional(), // Claimable-reward composition sample (multiple tokens by voting-power share; claimable breakdown dialog)
  }).optional(),
  proposals: z.array(z.object({
    id: idSchema,
    title: z.string(),
    state: z.enum(['active', 'passed', 'defeated', 'queued', 'executed']),
    governanceTarget: z.boolean(), // true=requires supermajority
    quorumProgress: rateSchema,
    votingEndsAt: isoTimeSchema,
  })),
});

/** staking.json (Memecoin staking yield vault YieldVault samples) */
export const stakingSchema = recordSchema.extend({
  verseId: idSchema,
  vaultAddress: fixtureAddressSchema, // YieldVault contract address (fixture sample, deployed on the governance chain)
  totalStaked: amountSchema, // Total staked Memecoin (snapshot)
  assetsPerShare: rateSchema, // 1 share ≈ N Memecoin (convertToAssets includes the virtualAssets buffer)
  apy7d: rateSchema, // Trailing 7-day realized APY (share-price appreciation annualized, off-chain derived display value)
  myShares: amountSchema, // Sample account shares
  delegatee: fixtureAddressSchema, // Current delegatee (chosen at staking time, defaults to self)
  pendingRedeems: z.array(z.object({
    lockedAssets: amountSchema, // Memecoin locked at request time (value fixed at request, stops accruing, voting power lost)
    requestedAt: isoTimeSchema,
    maturesAt: isoTimeSchema, // REDEEM_DELAY ≈ 1 day; ≤ anchor=withdrawable, > anchor=waiting
  })), // ≤5 entries (MAX_REDEEM_REQUESTS); empty array=nothing pending
});

/** pol-positions.json (POL position and valuation sample) */
export const polPositionSchema = recordSchema.extend({
  verseId: idSchema,
  polAddress: fixtureAddressSchema, // POL contract address (fixture sample)
  polSupply: amountSchema, // POL total supply
  uAssetPerPol: rateSchema, // Main-pool uAsset-side amount per 1 POL (nominal value = 2× this value -- full-range simplification)
  marketPricePerPol: rateSchema, // POL/uAsset pool market price (premium or discount vs nominal value both possible; sample convention takes a typical 5-16% discount, one legacy sample at 19.8%)
  flashUserFeeRate: rateSchema, // Flash Swap user fee-rate sample (relative to the user's payment -- the pool dynamic fee is charged on the PT leg's full nominal value while the user pays only the difference, so after leverage conversion the spectrum can be <1% or far above constant magnitude; design band 0.3%-85% covering tiny to very high (realized samples 0.9%-64%); the rate = the fee the user pays, dummy data does no derivation; when too high the contract reverts with InvalidBuyCost/MaxPOLInExceeded and the trade cannot execute)
  ptPricePerPol: rateSchema, // PT/POL pool market price per 1 PT (PT trades at a discount; sample anchor PT≈0.9 POL, YT implied price=1−this value, from the "1 POL=1 PT+1 YT" identity)
  myPol: amountSchema, // Sample account's POL balance
  myPt: amountSchema, // Sample account's PT balance (from the POL split, PT-<symbol>)
  myYt: amountSchema, // Sample account's YT balance (from the split + genesis claim, YT-<symbol>)
  myMemecoin: amountSchema, // Sample account's memecoin balance in this verse (Mint POL supply-side sample, so Max works)
  myUAsset: amountSchema, // Sample account's uAsset balance (wallet-level asset, same value across verses; Mint POL supply-side sample)
  myReserve: amountSchema, // Sample account's PSM-paired reserve balance in this verse (wallet-level; Swap reserve-side supply sample; single-reserve convention simplification: each family has only one paired reserve per market verse in this repo's data)
  myLp: z.object({
    // Four-pool LP token balance samples (Remove Liquidity dialog supply side; key=pool identifier matching marketSchema.pool;
    // magnitude anchor = each side's holding × supply ratio × lpPerQuote)
    main: amountSchema,
    'pol-uasset': amountSchema,
    'pt-uasset': amountSchema,
    'pt-pol': amountSchema,
  }),
  claimableYt: amountSchema, // YT claimable after genesis ends (claimNormalYT: one-time pro rata by genesis contribution once the verse stage ≥ Locked)
  // ── Claim-center samples (claim tab; onchain builds read the wallet's own entitlements client-side —
  // fields with no public on-chain view simply render no slot in live mode) ──
  claimablePreorder: amountSchema.optional(), // Preorder memecoin claimable now (claimablePreorderMemecoin, msg.sender-scoped)
  claimedPreorder: amountSchema.optional(), // Cumulative preorder memecoin already claimed (userPreorderData.claimedMemecoin)
  preorderProgress: rateSchema.optional(), // Linear-unlock progress sample; preorderStates/vesting duration have no public view → live mode renders no progress
  claimableUAssetFee: amountSchema.optional(), // Auxiliary-pool fee share claimable, uAsset leg (claimNormalFees = acc×fund÷totalFunds − claimed)
  claimablePtFee: amountSchema.optional(), // Auxiliary-pool fee share claimable, PT leg (same formula)
  claimableLpMeme: amountSchema.optional(), // Main-pool LP fee claimable, memecoin leg (previewClaimableFees fee0/fee1)
  claimableLpUAsset: amountSchema.optional(), // Main-pool LP fee claimable, uAsset leg
  ytRedeemUAssetPerUnit: rateSchema.optional(), // uAsset redeemed per 1 YT (derived from the remaining pool recovered at settlement; locked records=pre-settlement estimate sample anchored to the unlocked magnitude ≈3-5% of uAssetPerPol, unlocked=derived sample from the remaining pool after settlement; missing -> UI does not render)
  ytRedeemMemecoinPerUnit: rateSchema.optional(), // Memecoin redeemed per 1 YT (redeemYT: settlementMemecoin × share / circulating YT; same as above)
});

/** accounts.json (per-chain wallet states + wallet-kind forms) */
export const accountRecordSchema = recordSchema.extend({
  address: fixtureAddressSchema,
  walletKind: z.enum(['external-eoa', 'embedded-eoa']),
  perChain: z.array(z.object({
    chainId: chainIdSchema,
    state: z.enum([
      'connected-eoa', 'authorization-requested', 'authorization-signed',
      'delegation-pending', 'kernel-delegated', 'unsupported-delegation',
      'delegation-replacement-pending', 'delegation-revoked',
    ]),
    implementation: z.string().optional(),
  })),
});

/** notifications.json (toast queue sample only; no notification center) */
export const notificationSchema = recordSchema.extend({
  kind: z.enum(['toast']),
  messageKey: z.string(),
  at: isoTimeSchema,
});

/** scenarios/states.json */
export const scenarioSchema = z.object({
  id: scenarioIdSchema,
  label: z.string(),
  expectation: z.string(), // Observable expectation (acceptance action -> result)
  affects: z.array(idSchema),
});

/** File container */
export const fixtureFile = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ seed: z.string(), generatedFrom: z.literal('fixtures/data/seed.json'), items: z.array(item) });

export const chainsFile = fixtureFile(chainSchema);
export const assetsFile = fixtureFile(assetSchema);
export const versesFile = fixtureFile(verseSchema);

/** participations.json (sample account's genesis participation records; used by the Portfolio refund block/sorting) */
export const participationSchema = recordSchema.extend({
  verseId: idSchema,
  owner: fixtureAddressSchema,
  kind: z.enum(['normal', 'leverage', 'preorder']),
  route: z.enum(['direct', 'stake']).optional(), // Participation route (only meaningful for kind=normal: direct/stake two paths; stake=opens a staking position in the same tx; other kinds should omit it -- not schema-enforced, the sample data carries a route on a leverage row; the leverage/preorder panels each have independent routes without this dimension)
  amount: amountSchema,
});
export const participationsFile = fixtureFile(participationSchema);
export const positionsFile = fixtureFile(positionSchema);

/** balances.json (sample account's wallet balances -- chain × asset snapshot;
 *  data source for Portfolio section (2) assets & cross-chain; values are samples, production reads on-chain values) */
export const balanceSchema = recordSchema.extend({
  chainId: chainIdSchema,
  assetId: idSchema,
  amount: amountSchema,
});
export const balancesFile = fixtureFile(balanceSchema);
export const psmFile = fixtureFile(psmSchema);
export const marketsFile = fixtureFile(marketSchema);
export const usrVaultsFile = fixtureFile(usrVaultSchema);
export const bridgeMessagesFile = fixtureFile(bridgeMessageSchema);
export const transactionsFile = fixtureFile(transactionSchema);
export const governanceFile = fixtureFile(governanceSchema);
export const stakingFile = fixtureFile(stakingSchema);
export const polPositionsFile = fixtureFile(polPositionSchema);
export const accountsFile = fixtureFile(accountRecordSchema);
export const notificationsFile = fixtureFile(notificationSchema);
export const scenariosFile = z.object({ items: z.array(scenarioSchema) });

/** yield-sources.json (staking participation source registry: source -> participable asset group) */
export const yieldSourceSchema = recordSchema.extend({
  name: z.string(),
  /** Anchor family of the source: uAsset symbol minus the U prefix (UETH/UUSD/UBNB -> ETH/USD/BNB); open only to same-family verses (a UETH verse can never offer sUSDe-like USD sources) */
  anchor: z.enum(['ETH', 'USD', 'BNB']),
  assetIds: z.array(idSchema).min(1),
});
export const yieldSourcesFile = fixtureFile(yieldSourceSchema);

/** create-config.json (create-form on-chain parameter snapshot; ranges/fees are registration-center read-value samples) */
export const createConfigSchema = recordSchema
  .extend({
    /** Allowed genesis duration range (registration-center min/maxDurationDays read-value sample) */
    minDurationDays: z.number().int().positive(),
    maxDurationDays: z.number().int().positive(),
    /** Fixed lockup: FIXED_LOCKUP_DURATION=365 days, a contract constant not a parameter */
    lockupDays: z.literal(365),
  })
  .refine((config) => config.minDurationDays < config.maxDurationDays, 'minDurationDays < maxDurationDays');
export const createConfigFile = fixtureFile(createConfigSchema);

/** referral.json (sample account's referral rebate snapshot -- /referral page; mechanism=Memeverse hook swap rebate:
 *  default rate=1000bps i.e. 10% of total fees, in-kind per-token pending/claim.
 *  The on-chain event ReferralRebateAccrued records only referrer+token+amount -- the friends detail is an indexer-convention
 *  sample; referralCode=UI short-code style slot (on-chain has no code->address registry, production mapping TBD).)
 *  Transaction-row convention: rebate = trade × fee-rate sample 0.8% (markets feeRate sample) × 10%. */
const referralAssetAmountSchema = z.object({
  assetId: idSchema,
  chainId: chainIdSchema,
  amount: amountSchema,
});
/** Asset leg within a transaction row (token + amount; chain lives on the transaction row) */
const referralTxAmtSchema = z.object({
  assetId: idSchema,
  amount: amountSchema,
});
const referralTransactionSchema = z.object({
  verseId: idSchema,
  chainId: chainIdSchema,
  /** Tx hash (abbreviated display in the UI) */
  txId: fixtureTxHashSchema,
  /** The referee of this transaction (same address as the friends list, internally consistent within the sample) */
  friend: fixtureAddressSchema,
  trade: referralTxAmtSchema,
  rebate: referralTxAmtSchema,
  at: isoTimeSchema,
});
const referralFriendSchema = z.object({
  address: fixtureAddressSchema,
  joinedAt: isoTimeSchema,
  volumeUsd: z.number().nonnegative(),
  earnedUsd: z.number().nonnegative(),
});
export const referralSchema = recordSchema.extend({
  referralCode: z.string().regex(/^[0-9A-Z]{6}$/, 'demo-style 6-char short code'),
  /** Rebate rate (bps of total fees; production reads hook referrerRebateBps(), configurable 0-3500) */
  rate: rateSchema,
  friendsCount: z.number().int().positive(),
  earned: z.array(referralAssetAmountSchema).min(1),
  pending: z.array(referralAssetAmountSchema).min(1),
  transactions: z.array(referralTransactionSchema),
  friends: z.array(referralFriendSchema),
});
export const referralFile = fixtureFile(referralSchema);

/** faucet.json (testnet faucet snapshot -- /faucet page; mechanism:
 *  claim/batchClaim has a 24h cooldown per registered token, testnet mocks three tokens (USDC/sUSDS/aUSDC,
 *  18-dec) each registered with a daily limit of 1,000,000×1e18. swap=same-chain USDC-PSM face-value conversion
 *  to UUSD (two-way 1:1 par, tin/tout rates, mint capped by stockCap) -- UUSD's only
 *  acquisition path; yield-bearing assets (sUSDS/aUSDC) do
 *  not pass through UUSD and go straight to stakeForGenesis into genesis. Balance/cooldown-remaining/headroom
 *  are sample values (cooldown snapshot remainingMs follows the vault pendingRedeems convention, wall-clock
 *  decreasing).) */
const faucetTokenSchema = z.object({
  symbol: z.string().min(2),
  name: z.string().min(3),
  decimals: z.number().int().min(0).max(18),
  /** Daily claim allowance (contract dailyLimit, one-time full mint to the claimer) */
  dailyLimit: amountSchema,
  address: fixtureAddressSchema,
  /** Cooldown remaining milliseconds sample (0=claimable; >0=ClaimTooSoon error domain, UI countdown) */
  cooldownRemainingMs: z.number().int().nonnegative(),
});
const faucetSwapSchema = z.object({
  uAssetSymbol: z.string().min(2),
  reserveSymbol: z.string().min(2),
  /** mint fee rate (PSM tin, bps) */
  feeIn: rateSchema,
  /** redeem fee rate (PSM tout, bps) */
  feeOut: rateSchema,
  /** Mint allowance headroom sample (stockCap−netMinted; null=no sample -> breakdown row slot) */
  headroom: amountSchema.nullable(),
  /** Sample account's UUSD balance (Max source for the Back to USDC direction) */
  myUAsset: amountSchema,
  /** Sample account's reserve balance (Max source for the Get UUSD direction) */
  myReserve: amountSchema,
});
export const faucetSchema = recordSchema.extend({
  chainId: chainIdSchema,
  tokens: z.array(faucetTokenSchema).min(1),
  swap: faucetSwapSchema,
});
export const faucetFile = fixtureFile(faucetSchema);
