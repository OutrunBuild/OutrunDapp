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
  kind: z.enum(['uasset', 'reserve', 'sy', 'memecoin', 'share', 'credit']),
  decimals: z.number().int().min(0).max(18),
  anchorNote: z.string().optional(), // uAsset 锚定限定语（glossary A）
  usdSample: z.number().positive().optional(), // uAsset 美元样本价（fixture 假数据，生产以预言机/链上为准）
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
  currentCycleVotes: z.object({
    total: amountSchema, // 当期总票数（cast 时刻记入当前周期——M10:337）
    mine: amountSchema, // 样本账户当期票数
  }).optional(),
  lastCycle: z.object({
    number: uintString,
    treasuryUAsset: amountSchema, // 上期期末国库
    remainingRewards: amountSchema, // 未领取滚存（窗口过后并入国库不补发——dao-governance.md:51）
    totalVotes: amountSchema,
    myVotes: amountSchema,
    myClaimable: amountSchema, // 样本账户上期可领（窗口内）
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
  marketPricePerPol: rateSchema, // POL/uAsset 池市场价（相对名义价值溢价/折价）
  myPol: amountSchema, // 样本账户 POL 余额
  claimablePol: amountSchema, // 未入池剩余可领（解锁后按比例领取——four-pools.md:25）
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
  amount: amountSchema,
});
export const participationsFile = fixtureFile(participationSchema);
export const positionsFile = fixtureFile(positionSchema);
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
    /** 每条异链跨链 fan-out 费样本（LayerZero quote；治理链本链 fee=0——SPEC-M8 §9）；无注册费 */
    remoteDeployFee: amountSchema,
    /** 报价结构 pending-manifest（memeverse-create.md §2）：样本仅示意量级 */
    quoteState: z.literal('pending-manifest'),
  })
  .refine((config) => config.minDurationDays < config.maxDurationDays, 'minDurationDays < maxDurationDays');
export const createConfigFile = fixtureFile(createConfigSchema);
