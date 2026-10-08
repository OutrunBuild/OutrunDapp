// Fixture schema — 分域 Zod schema（阶段 2 步骤 9）
// 规则源：architecture §1/§4/§5/§9/§10/§15；runbook 步骤 9 数值域约定。
// 本文件只描述原型/测试数据形状；生产代码禁止导入（见 fixture-boundary-contract）。
import { z } from 'zod';

/** 六链白名单（architecture §5）——主网 3 + 测试网 3 */
export const chainIdSchema = z.union([
  z.literal(1), z.literal(8453), z.literal(56),
  z.literal(11155111), z.literal(84532), z.literal(97),
]);
export const CHAIN_IDS = [1, 8453, 56, 11155111, 84532, 97] as const;

/** 无符号十进制字符串（金额 raw / nonce / blockNumber 共用形状，语义由包装域区分） */
const decimalString = z.string().regex(/^\d+(\.\d+)?$/, 'decimal-string: ^\\d+(\\.\\d+)?$');
const uintString = z.string().regex(/^\d+$/, 'non-negative integer string');

/** 金额域：raw + decimals（禁止裸 number 金额） */
export const amountSchema = z.object({
  raw: decimalString,
  decimals: z.number().int().min(0).max(18),
});

/** 比率域：raw + unit + scale（bps=1e-4, ppm=1e-6, ratio=原生） */
export const rateSchema = z.object({
  raw: decimalString,
  unit: z.enum(['bps', 'ppm', 'ratio']),
  scale: z.number().int().min(0).max(18),
});

/** nonce / blockNumber 域：仅非负整数字符串，无 decimals */
export const nonceSchema = uintString;
export const blockNumberSchema = uintString;

/** 固定 UTC ISO 时间（禁相对时间/运行时钟） */
export const isoTimeSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/,
  'fixed UTC ISO string with Z',
);

/** 稳定 ID：前缀-整数（禁止运行时随机 UUID） */
export const idSchema = z.string().regex(/^[a-z][a-z0-9-]*-\d{3,}$/, 'stable id: prefix-NNN');

/** fixture 专用地址：0x40hex 且必须带 fixtureOnly 标记 */
export const fixtureAddressSchema = z.object({
  value: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'EVM address'),
  fixtureOnly: z.literal(true),
});

/** fixture 专用交易哈希：0x64hex 且必须带 fixtureOnly 标记 */
const fixtureTxHashSchema = z.object({
  value: z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'EVM tx hash'),
  fixtureOnly: z.literal(true),
});

/** sourceRef：仓库相对路径 + 章节/commit 锚（禁绝对路径/禁 /home） */
export const sourceRefSchema = z.string().refine(
  (s) =>
    !s.startsWith('/') &&
    !s.includes('..') &&
    !s.startsWith('home') &&
    (s.includes('#') || s.includes('@') || s.includes('§')),
  'sourceRef: repo-relative path + section anchor (#…/§…/@commit)',
);

/** 场景 ID（runbook 步骤 9 必含 + 基线新增面） */
export const scenarioIdSchema = z.enum([
  'normal', 'zero-balance', 'zero-position', 'paused', 'undeployed', 'rpc-fail',
  'index-lag', 'wrong-network', 'external-eoa', 'embedded-eoa', 'user-rejected',
  'unsupported-delegation', 'tx-failure',
  'psm-stockcap-full', 'psm-reserve-depleted', 'psm-dust-quote-zero',
  'usr-rate-zero', 'usr-capped', 'usr-share-growth',
  'cdp-debt-redeem', 'cdp-partial-redeem', 'cdp-insufficient-uasset',
]);
export type ScenarioId = z.infer<typeof scenarioIdSchema>;

/** 通用记录外壳 */
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
  name: z.string().optional(), // 代币本名（储备=真实代币 canonical 名 Ethereum/USD Coin 等；缺失=组件回退 symbol，2026-09-27 Swap 选择弹窗行名）
  kind: z.enum(['uasset', 'reserve', 'sy', 'memecoin', 'share', 'credit']),
  decimals: z.number().int().min(0).max(18),
  anchorNote: z.string().optional(), // uAsset 锚定限定语（glossary A）
  pairedUAssetId: z.string().optional(), // credit 专用：配对 uAsset id（一对一，不得跨用——OB:memeverse/genesis-credit.md:17；合约 creditOf(uAsset)）
  usdSample: z.number().positive().optional(), // uAsset 美元样本价（fixture 假数据，生产以预言机/链上为准）
  anchorValue: z.number().positive().optional(), // sy 资产按实时价值折算锚资产样本率（1 枚 sy ≈ N 锚资产→N uAsset，OB:outstake/uasset.md:21；wstETH≈1.05 样本 :48；样本缺失=组件兜底面值 1，不显槽位——用户裁定 2026-09-25）
  address: fixtureAddressSchema.optional(),
});

/** verses.json（阶段枚举=SPEC-M9 状态机的用户可见面） */
/** verse 社交链接（注册期元数据；kind→UI 图标映射在展示层：website=Globe/x=AtSign/telegram=Send/discord=MessageCircle；展示顺序=website,x,discord,telegram） */
export const verseSocialSchema = z.object({
  kind: z.enum(['website', 'x', 'telegram', 'discord']),
  url: z.string().url(),
});

export const verseSchema = recordSchema.extend({
  name: z.string(),
  symbol: z.string(),
  stage: z.enum(['genesis', 'locked', 'unlocked', 'refund']),
  governanceChain: chainIdSchema,
  createdAt: isoTimeSchema, // 创世池创建时间（固定 UTC；Explore 排序/展示用）
  participants: z.number().int().positive(), // 参与地址数快照（Explore 排序/详情页展示用）
  description: z.string().optional(), // 一句话描述（注册期元数据；缺失=UI 不渲染）
  socials: z.array(verseSocialSchema).optional(), // 社交链接（注册期元数据；缺失=UI 不渲染）
  projectedMarketCap: amountSchema.optional(), // 预计市值快照（uAsset 计；注册参数——读链参数，缺失=UI 不渲染）
  genesis: z.object({
    minSuccessThreshold: amountSchema,
    normalRaised: amountSchema,
    leverageInterest: amountSchema, // 双口径独立判定（lifecycle.md:35-49）
    preorderRaised: amountSchema,
    endsAt: isoTimeSchema,
    preorderCapacityRatio: rateSchema.optional(), // 预购容量比例快照（容量=(普通资金+杠杆债务本金)×70%×容量比例——glossary；读链参数，缺失=UI 显槽位）
    leverageInterestRate: rateSchema.optional(), // 杠杆一次性利率快照（注册时锁定、非年化；债务额度=利息÷利率——polend.md；读链参数，缺失=UI 显槽位）
    leverageDebtCap: amountSchema.optional(), // 杠杆债务上限快照（uAsset 计；现债务=已收利息÷利率——POLend LeveragedDebtInfo；读链参数，缺失=UI 显槽位）
    fastGenesis: z.boolean().optional(), // Fast Mode：任一门槛达标即提前结束创世（memeverse-create.md §2；默认关闭）
  }),
  unlock: z.object({
    unlockedAtTx: isoTimeSchema.optional(), // 实际解锁交易时间=保护期起点（genesis.md:52）
  }).optional(),
  // 上线后市场活跃快照（发现页锁定中/已解锁卡共用同一字段集，2026-09-23 用户裁定两阶段卡内容一致；
  // 读链参数——机制口径 OB:memeverse/memecoin-staking.md（质押收益与国库入账均来自交易费分成）、
  // OB:memeverse/dao-governance.md（uAsset 计费用入 DAO 国库）；解锁时间不入快照——由
  // endTime+FIXED_LOCKUP_DURATION 推导（合约常量）；缺失=UI 显 unavailable 槽位）
  livePhase: z.object({
    volume24h: amountSchema, // 24h 四池交易量快照（uAsset 计）
    stakingApy: rateSchema, // 质押年化快照（ratio：5.688=568.8%）
    treasuryFundUsd: amountSchema, // DAO 国库余额快照（美元计——卡头市值美元口径先例 2026-09-23）
  }).optional(),
});

/** positions.json（open-term CDP；redeem 唯一减借——SPEC-S2 L50） */
export const positionSchema = recordSchema.extend({
  chainId: chainIdSchema,
  owner: fixtureAddressSchema,
  collateral: z.object({ assetId: idSchema, amount: amountSchema }),
  debt: amountSchema, // 未偿 uAsset 债务
  yieldSource: z.string(), // 生息来源品牌（质押参与副文案）
  noMaturity: z.literal(true), // 大白话口径数据锚（PD-09）
  openedFor: idSchema.optional(), // 仓位来源 Verse（质押参与同笔交易原子开仓——PD-01/PD-03；缺失=独立 Genesis Staking 铸造，2026-10-02 用户裁定展示来源）
});

/** psm.json */
export const psmSchema = recordSchema.extend({
  chainId: chainIdSchema,
  uAssetId: idSchema,
  reserveId: idSchema,
  tin: rateSchema,
  tout: rateSchema,
  stockCap: amountSchema,
  netMinted: amountSchema, // headroom = stockCap − netMinted（SPEC-S8 §3）
  reserveAvailable: amountSchema,
});

/** usr-vaults.json */
export const usrVaultSchema = recordSchema.extend({
  chainId: chainIdSchema,
  assetId: idSchema, // suETH/suUSD/suBNB
  usrRate: rateSchema, // 0 = 未激活（SPEC-S9：18-dec 点值，此处按 rate 域记）
  accrualIndexRaw: decimalString, // 1e18 域
  lastSettledAt: isoTimeSchema,
  capped: z.boolean(), // 封顶钳制域标记
  myShares: amountSchema.optional(), // 样本账户份额（2026-10-02 用户裁定造样本；缺失=0→Portfolio 空态）
});

/** bridge-messages.json（三阶段各自成败——OB omnichain.md:31-43） */
export const bridgeMessageSchema = recordSchema.extend({
  fromChain: chainIdSchema,
  toChain: chainIdSchema,
  assetId: idSchema,
  amount: amountSchema,
  sentAt: isoTimeSchema,
  stage: z.enum(['sent', 'delivered', 'settled', 'stranded']), // stranded=已发出未落位，可手动恢复
  remainderOnSource: amountSchema.optional(), // 6 位小数余数留源链
});

/** markets.json（四池与费率状态——SPEC-M5/M14） */
const candleSchema = z.object({
  t: isoTimeSchema, o: decimalString, h: decimalString, l: decimalString, c: decimalString,
  v: decimalString.optional(), // 蜡烛成交量（uAsset 计价样本；缺失=展示层按 0 处理）
});
export const marketSchema = recordSchema.extend({
  verseId: idSchema,
  pool: z.enum(['main', 'pol-uasset', 'pt-uasset', 'pt-pol']),
  tvl: amountSchema,
  feeState: z.enum(['normal', 'opening-decay', 'dynamic-applied', 'paused-protection']),
  // 池动态费率样本（dynamic fee hook——OB:memeverse/hook.md 基础费率下限 1%+动态项、合约 FEE_BASE_BPS=100/FEE_MAX_BPS=10000——DynamicFeeMath.sol:41-42；bps 计，稳态池样本带宽 100–800 bps（1%–8%）——gen-market-fee.mjs；
  // 2026-09-28 用户裁定造数看原型效果（Flash Swap 费率行数值源）；缺失=槽位 '--'
  feeRate: z.object({ raw: decimalString, unit: z.literal('bps'), scale: z.number().int().min(0).max(4) }).optional(),
  lpShareSample: z.object({ poolShare: rateSchema, pendingFees: amountSchema }).optional(),
  candles: z.array(candleSchema).max(500).optional(), // 主池 K 线样本（1h 原始粒度；4h/1d/1w 由展示层聚合）
  candlesFine: z
    .object({
      '1m': z.array(candleSchema).max(500),
      '5m': z.array(candleSchema).max(500),
      '15m': z.array(candleSchema).max(500),
    })
    .optional(), // 细粒度蜡烛样本（2026-09-23 用户裁定：全部粒度可选、假数据看效果）
  volume24h: amountSchema.optional(), // 24h 成交量快照（池维度；缺失=UI 显「以链上读值为准」槽位）
  apr7d: rateSchema.optional(), // 近 7 日费率年化样本（展示推导值；缺失=槽位）
  lpPerQuote: rateSchema.optional(), // LP 铸得率样本：每供给 1 quote 侧资产铸得 LP 数量（totalSupply/R_quote v2 式口径；Add Liquidity 弹窗输出推导，2026-09-27；缺失=槽位）
  tokenStats: z.object({ // 仅主池条目携带（代币统计条——R-06）
    totalSupply: amountSchema, // Memecoin 总供应快照
    holders: z.number().int().positive(), // 持有人数快照
    tokenAddress: fixtureAddressSchema, // Memecoin CA（fixture 样本，不冒充部署地址）
  }).optional(),
});

/** transactions.json（A7–A12 + Type-4/跨链类型） */
export const transactionSchema = recordSchema.extend({
  chainId: chainIdSchema,
  kind: z.enum(['kernel-batch', 'type4-first-delegation', 'cross-chain-send', 'plain']),
  state: z.enum(['reviewing', 'awaiting-signature', 'signing', 'submitting', 'confirming', 'success', 'failure', 'user-rejected']),
  nonce: nonceSchema,
  blockNumber: blockNumberSchema.optional(),
  submittedAt: isoTimeSchema.optional(),
  errorMsg: z.string().optional(), // failure 场景：解码后错误+恢复动作文案键
});

/** governance.json */
/** 资金明细构成行（2026-09-26 参照 demo.outrun.build/memeverse/26：国库/未领取奖励多资产
 *  构成弹窗；具体构成无真源=S 级样本，总额锚 treasuryUAsset/remainingRewards 口径） */
const governanceAssetSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  amount: amountSchema, // 数量样本（按 unitPrice 样本换算）
  usdValue: amountSchema, // 美元值样本
});

export const governanceSchema = recordSchema.extend({
  verseId: idSchema,
  cycleNumber: uintString,
  cycleDurationDays: z.number().int().positive(), // 读链显示（PD-09/C4——非固定 90）
  cycleEndsAt: isoTimeSchema,
  finalized: z.boolean(),
  claimWindowEndsAt: isoTimeSchema.optional(),
  // —— 以下为 DAO 标签周期激励面（2026-09-23 四标签详情页）；全部可选：无治理数据的 verse 显示槽位 ——
  governorAddress: fixtureAddressSchema.optional(), // Governor 合约地址（fixture 样本）
  incentivizerAddress: fixtureAddressSchema.optional(), // 周期激励合约地址（fixture 样本）
  delegates: z.number().int().positive().optional(), // 已委托地址数快照
  totalVotingPower: amountSchema.optional(), // 总票权（sMemecoin 计）
  myVotes: amountSchema.optional(), // 样本账户当前票权
  treasuryUAsset: amountSchema.optional(), // 国库 uAsset 余额快照（Governor 托管）
  rewardRatio: rateSchema.optional(), // 划拨比例（初始 2500bps=25%，治理可改——M10:332-333）
  cumulativeIncentivePool: amountSchema.optional(), // 累计激励池（reward ledger 余额）
  treasuryAssets: z.array(governanceAssetSchema).optional(), // 当期国库构成样本（资金明细弹窗）
  currentCycleVotes: z.object({
    total: amountSchema, // 当期总票数（cast 时刻记入当前周期——M10:337）
    mine: amountSchema, // 样本账户当期票数
  }).optional(),
  lastCycle: z.object({
    number: uintString,
    treasuryUAsset: amountSchema, // 上期期末国库
    treasuryAssets: z.array(governanceAssetSchema).optional(), // 上期期末国库构成样本（资金明细弹窗）
    remainingRewards: amountSchema, // 未领取奖励（窗口过后并入国库不补发——dao-governance.md:51）
    unclaimedAssets: z.array(governanceAssetSchema).optional(), // 未领取奖励构成样本（资金明细弹窗）
    totalVotes: amountSchema,
    myVotes: amountSchema,
    myClaimable: amountSchema, // 样本账户上期可领（窗口内）
    claimableAssets: z.array(governanceAssetSchema).optional(), // 可领奖励构成样本（多 token 按票权份额——GovernanceCycleIncentivizerUpgradeable.sol:199；可领明细弹窗）
  }).optional(),
  proposals: z.array(z.object({
    id: idSchema,
    title: z.string(),
    state: z.enum(['active', 'passed', 'defeated', 'queued', 'executed']),
    governanceTarget: z.boolean(), // true=需超级多数
    quorumProgress: rateSchema,
    votingEndsAt: isoTimeSchema,
  })),
});

/** staking.json（Memecoin 质押收益库 YieldVault——SPEC-M10 §6 + OB memecoin-staking.md；2026-09-23 四标签详情页） */
export const stakingSchema = recordSchema.extend({
  verseId: idSchema,
  vaultAddress: fixtureAddressSchema, // YieldVault 合约地址（fixture 样本，部署在治理链）
  totalStaked: amountSchema, // 总质押 Memecoin（快照）
  assetsPerShare: rateSchema, // 1 份额 ≈ N Memecoin（convertToAssets 含 virtualAssets 缓冲）
  apy7d: rateSchema, // 近 7 日实绩年化（份额价涨幅年化，链下推导展示值）
  myShares: amountSchema, // 样本账户份额
  delegatee: fixtureAddressSchema, // 当前委托对象（Q9：质押时选定，默认自己）
  pendingRedeems: z.array(z.object({
    lockedAssets: amountSchema, // 申请时锁定的 Memecoin（申请即固定价值、停增值、票权消失）
    requestedAt: isoTimeSchema,
    maturesAt: isoTimeSchema, // REDEEM_DELAY ≈ 1 天；≤ anchor=可提取，> anchor=等待中
  })), // ≤5 笔（MAX_REDEEM_REQUESTS）；空数组=无待执行
});

/** pol-positions.json（POL 持仓与估值样本——SPEC-M14 + polend/pt-yt-splitter.md §4 名义价值；2026-09-23） */
export const polPositionSchema = recordSchema.extend({
  verseId: idSchema,
  polAddress: fixtureAddressSchema, // POL 合约地址（fixture 样本）
  polSupply: amountSchema, // POL 总供应
  uAssetPerPol: rateSchema, // 每 1 POL 对应主池 uAsset 侧数量（名义价值 = 2× 此值——全范围简化）
  marketPricePerPol: rateSchema, // POL/uAsset 池市场价（相对名义价值溢价/折价皆可——pol-splitter.md；样本口径取典型折价 5–16%，2026-09-24 用户裁定）
  flashUserFeeRate: rateSchema, // Flash Swap 用户手续费率样本（相对用户支付额——池动态费按 PT 全腿名义收取、用户只付差额，杠杆换算后谱系可 <1% 也可远超常量级；带宽 0.3%–85% 覆盖极小到极高——gen-pol-flash-fee.mjs，2026-09-28 用户裁定：费率=用户付的手续费、假数据不做推导；过高时合约 InvalidBuyCost/MaxPOLInExceeded 回滚无法成交）
  ptPricePerPol: rateSchema, // 每 1 PT 的 PT/POL 池市场价（PT 折价交易——pol-splitter.md:44；样本锚=yt-flash-swap.md 示例 PT≈0.9 POL，YT 隐含价=1−此值——yt-flash-swap.md「1 POL=1 PT+1 YT」；2026-09-27 Swap 代币选择）
  myPol: amountSchema, // 样本账户 POL 余额
  myPt: amountSchema, // 样本账户 PT 余额（POL 拆分所得，PT-<symbol>——POLSplitterUpgradeable.sol:225）
  myYt: amountSchema, // 样本账户 YT 余额（拆分所得 + 创世领取，YT-<symbol>——POLSplitterUpgradeable.sol:226）
  myMemecoin: amountSchema, // 样本账户本 verse memecoin 余额（Mint POL 供给侧样本，2026-09-24 用户裁定造样本使 Max 可用）
  myUAsset: amountSchema, // 样本账户 uAsset 余额（钱包级资产，各 verse 同值；Mint POL 供给侧样本）
  myReserve: amountSchema, // 样本账户本 verse PSM 配对储备余额（钱包级；Swap 储备侧供给样本——2026-09-28 用户裁定造数，gen-pol-my-reserve.mjs；单储备口径简化：本仓 market verse 每族仅一配对储备）
  myLp: z.object({
    // 四池 LP 代币余额样本（Remove Liquidity 弹窗供给侧，2026-09-27；键=池标识同 marketSchema.pool；
    // 量级锚=各侧持仓 × 供给比例 × lpPerQuote——gen-pol-my-lp.mjs 幂等生成）
    main: amountSchema,
    'pol-uasset': amountSchema,
    'pt-uasset': amountSchema,
    'pt-pol': amountSchema,
  }),
  claimableYt: amountSchema, // 创世结束后可领 YT（claimNormalYT：Stage≥Locked 一次性按创世出资比例——MemeverseSettlementImpl.sol:88；2026-09-23 用户裁定 Claim POL 不存在，删除该字段）
  ytRedeemUAssetPerUnit: rateSchema.optional(), // 每 1 YT 赎回摊得 uAsset（结算回收剩余池派生——POLSplitterUpgradeable.sol:404；locked 记录=结算预估样本（2026-09-28 用户裁定造数看原型效果，gen-pol-yt-uasset-leg.mjs 锚 unlocked 量级 ≈uAssetPerPol 3–5%），unlocked=结算后剩余池派生样本；缺失→「以链上读值为准」槽位）
  ytRedeemMemecoinPerUnit: rateSchema.optional(), // 每 1 YT 赎回摊得 memecoin（redeemYT：settlementMemecoin×份额/流通 YT——POLSplitterUpgradeable.sol:405；同上）
});

/** accounts.json（§6.2 九态 + §11.2 形态） */
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

/** notifications.json（v1=toast 队列样本；通知中心延后——决议 007） */
export const notificationSchema = recordSchema.extend({
  kind: z.enum(['toast']),
  messageKey: z.string(),
  at: isoTimeSchema,
});

/** scenarios/states.json */
export const scenarioSchema = z.object({
  id: scenarioIdSchema,
  label: z.string(),
  expectation: z.string(), // 可观察期望（验收动作→结果）
  affects: z.array(idSchema),
});

/** 文件容器 */
export const fixtureFile = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ seed: z.string(), generatedFrom: z.literal('fixtures/data/seed.json'), items: z.array(item) });

export const chainsFile = fixtureFile(chainSchema);
export const assetsFile = fixtureFile(assetSchema);
export const versesFile = fixtureFile(verseSchema);

/** participations.json（样本账户的创世参与记录；Portfolio 退款区块/排序用） */
export const participationSchema = recordSchema.extend({
  verseId: idSchema,
  owner: fixtureAddressSchema,
  kind: z.enum(['normal', 'leverage', 'preorder']),
  route: z.enum(['direct', 'stake']).optional(), // 参与路径（仅 kind=normal：PD-01 直接/质押两门；质押=同笔交易开出 OutStake 仓位；杠杆/预购面板各自独立路径无此维）
  amount: amountSchema,
});
export const participationsFile = fixtureFile(participationSchema);
export const positionsFile = fixtureFile(positionSchema);

/** balances.json（样本账户钱包余额——链×资产快照，2026-10-02 用户裁定造样本；
 *  Portfolio ②区资产与跨链数据源；数值为样本，生产以链上读值为准） */
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

/** yield-sources.json（质押参与来源 registry：来源→可参与资产组；样本口径=OutrunBook vision.md 协议清单 + 用户裁定 2026-09-22 映射） */
export const yieldSourceSchema = recordSchema.extend({
  name: z.string(),
  /** 来源锚定族：uAsset 符号去掉 U 前缀（UETH/UUSD/UBNB→ETH/USD/BNB）；只对本族 Verse 开放（用户裁定 2026-09-22：UETH verse 不可能出现 sUSDe 类 USD 来源） */
  anchor: z.enum(['ETH', 'USD', 'BNB']),
  assetIds: z.array(idSchema).min(1),
});
export const yieldSourcesFile = fixtureFile(yieldSourceSchema);

/** create-config.json（创建表单读链参数快照——R-04；区间/费用为注册中心读值样本） */
export const createConfigSchema = recordSchema
  .extend({
    /** 创世时长允许区间（center min/maxDurationDays 读值样本；demo 先例 1–3 天） */
    minDurationDays: z.number().int().positive(),
    maxDurationDays: z.number().int().positive(),
    /** 固定锁定期：FIXED_LOCKUP_DURATION=365 days，合约常量非参数（config-matrix §3:83） */
    lockupDays: z.literal(365),
    /** 每条异链跨链 fan-out 费样本（LayerZero quote；中心链目标 fee=0——SPEC-M8 §9）；无注册费 */
    remoteDeployFee: amountSchema,
    /** 异链发起注册时 发起链→注册中心链 的 LayerZero 发送费样本（RegistrarOmnichain quoteRegister；
     *  同链发起=0）。治理链=注册中心链为样本场景假设（deployment.md §8 中心链归属[未知]） */
    remoteSendFee: amountSchema,
  })
  .refine((config) => config.minDurationDays < config.maxDurationDays, 'minDurationDays < maxDurationDays');
export const createConfigFile = fixtureFile(createConfigSchema);

/** referral.json（样本账户推荐返佣快照——/referral，R-12；机制=Memeverse hook swap 返佣
 *  source-map M5/M14/M15：默认 rate=1000bps 即总手续费 10%、in-kind 逐币 pending/claim。
 *  链上事件 ReferralRebateAccrued 只记 referrer+币种+金额——friends 明细为索引器口径
 *  样本（2026-10-07 用户裁定保留）；referralCode=UI 短码样式位（demo 样式，链上无
 *  code→地址注册表，生产映射方案待定，同日用户裁定）。）
 *  交易行口径：rebate = trade × 费率样本 0.8%（markets feeRate 样本）× 10%。 */
const referralAssetAmountSchema = z.object({
  assetId: idSchema,
  chainId: chainIdSchema,
  amount: amountSchema,
});
/** 交易行内资产腿（币种+数量；链在交易行上） */
const referralTxAmtSchema = z.object({
  assetId: idSchema,
  amount: amountSchema,
});
const referralTransactionSchema = z.object({
  verseId: idSchema,
  chainId: chainIdSchema,
  /** 交易哈希（界面缩略显示；2026-10-07 用户裁定参照重设计） */
  txId: fixtureTxHashSchema,
  /** 该笔交易的被推荐人（与 friends 列表同址，样本内部自洽） */
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
  /** 返佣率（占总手续费 bps；生产读 hook referrerRebateBps()，0–3500 可配） */
  rate: rateSchema,
  friendsCount: z.number().int().positive(),
  earned: z.array(referralAssetAmountSchema).min(1),
  pending: z.array(referralAssetAmountSchema).min(1),
  transactions: z.array(referralTransactionSchema),
  friends: z.array(referralFriendSchema),
});
export const referralFile = fixtureFile(referralSchema);
