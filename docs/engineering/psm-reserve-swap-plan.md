# PSM 储备腿交换：开发 → 测试 → 部署 → 双仓集成方案

状态：**已交付**（2026-10-28）。合约在 Memeverse `6f026e1` 合入，三链已局部换代部署，真实链 fork 测试双向通过。

交付实况（与下文方案对照）：
- 部署只跑 `swaprouter` 批，Router 同址 `0x416315158C6779DCbAFc14869FF55921D30DE7fa`、Lens `0x350D7b9096Ba127B22189e78953272fb708E1f80`，其余全栈仍是 nonce-4。§5 的整代换代未采用——单批重部署已足够且风险更低。
- 链上验证：BSC 真实 OSMK verse 买卖双向通过，见 `docs/architecture.md` §30。
- ABI：`v1-rc2` 落地，`deployments/*.json` 与 manifest 的地址、codehash、deploymentTx 已更新。
- 未做：Playwright 三视口 E2E 与测试网人工点选验证。

产品约束（不可协商）：**交换卡必须保持 exact-in 语义**——用户输入多少就卖多少，输出用 minOut 保护。exact-out 不作为方案。

范围：

- 改动合约仅 Memeverse 仓的 `MemeverseSwapRouter`（+ 接口 + 单测 + spec）。
- OutStake 仓零代码改动（PSM 合约、PSM 规格都不动）。
- OutrunDapp 仓：交换卡储备腿接线、报价层、批次编码、文案、登记、测试。
- 部署使用新 generation 的 256-bit 随机 nonce（见 §5.1）。

---

## 0. 决策摘要

| 项 | 结论 |
| --- | --- |
| 新函数名 | `swapExactInToReserve` |
| 卖出方向（meme → UUSD → USDC） | 新 Router 入口，一次调用内完成 swap + PSM redeem |
| 买入方向（USDC → UUSD → meme） | 不改合约；批处理里 `PSM.mint` + exact-in swap |
| PSM 地址来源 | 调用参数 + 双绑定校验，不新增 registry |
| PSM 费率呈现 | 单行合并：Router 费 + PSM 费折算到输入币口径后相加，见 §3.5 |
| ABI 版本 | 升级 `v1-rc` → `v1-rc2`（additive = MINOR），旧目录保留，见 §5.4/§5.5 |
| 部署 nonce | `18568515786604916376943872092035382219393481865447784378031251369366894803451` |

---

## 1. 命名

采用 **`swapExactInToReserve`**。

- `ExactIn` 直接对齐产品语义（输入精确、输出 minOut 保护），与前端现有 `swapExactInputCall` 同词根。
- `ToReserve` 说明输出是 PSM 绑定的储备资产（USDC），不是 uAsset；uAsset 只是中间腿。
- 不带 `Redeem`：赎回是内部实现细节，用户心智是「把 meme 换成 USDC」。
- 不带 `And`：`swapExactInAndRedeem` 读起来像两个独立操作，且没有说明输出资产。

否决的备选：`swapExactInForReserve`（介词歧义）、`swapExactInputToPsmReserve`（把中间腿写进名字）、
`swapExactInAndRedeem`（语义不完整）、`redeemSwapOutput`（不是动作主语）。

接口 natspec 一句话定义行为：*pay an exact input amount, swap it through the pool into the paired uAsset,
then redeem that uAsset through the given PSM for its bound reserve token, all in one transaction.*

---

## 2. 合约开发（Memeverse）

### 2.1 接口

文件：`src/swap/interfaces/IMemeverseSwapRouter.sol`

```solidity
function swapExactInToReserve(
    PoolKey calldata key,
    uint256 amountIn,
    uint256 minUAssetOut,
    address psm,
    address reserveToken,
    uint256 minReserveOut,
    address recipient,
    uint256 deadline,
    bytes calldata hookData
) external returns (uint256 reserveOut);
```

新增 custom error（命名对齐仓内现有风格）：`PsmUAssetMismatch(address expected, address actual)`、
`PsmReserveMismatch(address expected, address actual)`、`ReserveOutBelowMinimum(uint256 actual, uint256 minimum)`。

### 2.2 实现

文件：`src/swap/MemeverseSwapRouter.sol`

执行顺序（全部在一个交易内，中间没有用户可插入的状态）：

1. `zeroForOne` 由 `key` 与输入币种推导；输入币 = memecoin，输出币 = uAsset。若 `key` 不含本次
   verse 的 meme/uAsset 对，直接 revert（沿用 `_swap` 的 key/hook 校验）。
2. `IPSM(psm).uAsset() == uAsset`，`IPSM(psm).reserveToken() == reserveToken`。两个都校验，
   防止调用方传恶意 `psm` 吞掉 swap 输出（与 `OutrunRouter.genesisByPSM` 的双绑定口径一致）。
3. `_pullCurrency(inputCurrency, msg.sender, amountIn)`（精确拉取，无 refund 分支）。
4. 记录 uAsset `balanceOf(address(this))`，调内部 `_swap(..., recipient = address(this), amountOutMinimum = minUAssetOut, amountInMaximum = 0, payer = msg.sender, inputBudget = amountIn)`。
5. `uAssetOut = balanceOf(address(this)) - balanceBefore`。用余额差而不是 `BalanceDelta` 推算，
   天然隔离本合约此前可能存在的同类代币尘埃；余额差必须 `>= minUAssetOut`（`_swap` 已校验一次，
   这里做二次防线并用于后续授权额）。
6. `uAsset.forceApprove(psm, uAssetOut)` → `reserveOut = IPSM(psm).redeem(recipient, uAssetOut)`。
7. `require(reserveOut >= minReserveOut)`（`ReserveOutBelowMinimum`）。
8. 返回 `reserveOut`。

要点：

- `redeem` 的 `amountIn` 是**本函数内部算出的静态值**，不依赖任何跨调用动态输出；这正是 exact-in
  能原子化的原因。
- 重入：现有 Router 没有 reentrancy guard，swap 由 v4 `unlock` 保护，但新增的「持有 uAsset +
  调用外部 PSM」是新的外部交互面。给该函数加一个 transient-storage 锁（OZ `ReentrancyGuard` 或
  自建 transient lock），只保护这一个入口，不改其它函数。
- PSM 失败面全部冒泡：`StockCapExceeded`、储备不足导致的转账失败、uAsset `EnforcedPause`、
  dust 零输出 `ZeroInput`。整笔 revert，原子，无部分成交。
- 不新增事件：swap 与 PSM 各自已有事件；Router 现有代码也不发事件，保持一致。
- `amountIn == 0`、`recipient == address(0)`、`psm == address(0)` 早 revert，沿用现有零值守卫风格。

### 2.3 买入方向

不需要新合约入口。前端批处理即可：

```
approve(USDC, PSM, amountIn)
PSM.mint(to = EOA, amountIn)            // 输出确定性：面值 × (1 - tin)，floor
approve(UUSD, router, minted)
beginAccountSession(hook)
router.swap(exact-in, minted, minMemeOut)
endAccountSession(hook)
```

`PSM.mint` 的输出可以离线用 `quoteMint` 精确算出（1:1 减费、floor，无价格输入），所以后续
`swap` 的 `amountIn` 是静态值，整批原子。

### 2.4 合约测试

文件：`test/swap/` 新增 `MemeverseSwapRouterPsmReserve.t.sol`，mock 放 `test/mocks/swap/`。

必测用例：

- happy path：输入 exact-in，输出 `reserveOut == quoteRedeem(uAssetOut)`，用户 USDC 余额增量正确。
- `minUAssetOut` / `minReserveOut` 各自的 revert 边界。
- `psm.uAsset()` / `psm.reserveToken()` 不匹配 → revert（两个分支分开测）。
- PSM `stockCap` 用尽 → 整笔 revert，用户 meme 余额不变。
- PSM 储备不足 → revert。
- dust（输出 floor 为 0）→ revert `ZeroInput`。
- uAsset paused → revert。
- 重入：reserve token 带回调的 mock，验证锁生效。
- 余额隔离：Router 预置 uAsset 尘埃，本笔只赎回余额差，不碰旧余额。
- session 链路：`beginAccountSession → swapExactInToReserve → endAccountSession` 正常；未开 session 时 hook 侧照旧拒绝。
- 现有 exact-in `swap` 回归：批次形状与费用不变。

---

## 3. 前端开发（OutrunDapp）

### 3.1 选项与数据

- `components/verse/verse-trade-desk.tsx:183` 把 `getParticipationOptions(...).reserves` 传给交换卡；
  当前 `SwapPanel` 的 `reserves` 类型只有 `{ symbol; name? }`（`components/verse/swap-panel.tsx:124`），
  缺执行所需的地址与小数位。改为透传 `Asset`（onchain 构建的 `id` 就是储备地址，
  `lib/data/onchain-source.ts:816`；`decimals` 见 `:818`）。
- `swap-panel.tsx:214` 的 `unavailable: realMode || undefined` 改为按「该腿是否有接线」判定：
  uAsset↔meme 与 reserve↔meme 可用；POL/PT 在 real 构建仍保持禁用。
- `pairExecutable`（`:288`）从「只剩 uAsset↔meme」扩展为三条合法腿；选到非法腿时 CTA 仍用
  `swapPairUnavailable`。

### 3.2 报价层

文件：`components/verse/swap-live-quote.ts`、`components/global/execution-reads.ts`

- `resolveSwapQuoteContext` 的 `tokenIn` / `tokenOut` 不再写死 uAsset/memecoin，按选定腿推导；
  小数位从储备 token 读（USDC 6 位）。
- 报价分两段，共用同一轮 poll：
  - 卖出：`quoteSwap(exact-in amountIn) → uAssetOut`，再 `quoteRedeem(uAssetOut) → reserveOut`。
  - 买入：`quoteMint(amountIn) → uAssetIn`，再 `quoteSwap(exact-in uAssetIn) → memeOut`。
- `SwapQuoteValue` 增加 `uAssetOut` / `reserveOut`（或统一的 `legOut`）与 `psmFee`，`key` 里加入
  PSM 地址与储备地址，避免与 uAsset↔meme 的缓存串用。
- 点击路径复用同一套缓存（`quoteForContext`），保持现有「报价是执行会看到的值」的口径。

### 3.3 执行层

文件：`lib/web3/session-actions.ts`、`lib/web3/kernel.ts`、`components/verse/swap-panel.tsx`

- 新增 `swapExactInToReserveCall(router, input)` 编码器（selector 与新 ABI 对齐）。
- 批次组装：`buildSessionBatch`（`lib/web3/kernel.ts:75-83`）目前固定
  approvals → begin → 单个 action → end。买入方向需要 PSM mint 在 begin 之前，卖出方向需要
  action 后接 redeem（已封装进 Router，不需要额外调用）。最小改动：给 `SessionBatchParts` 增加
  `preActions?: BatchExecution[]`，插在 approvals 之后、begin 之前；`buildSessionWrite` 透传。
  不新增第二条组装管线。
- 卖出批次：`[approve(meme → router), begin, swapExactInToReserve, end]`。
- 买入批次：`[approve(USDC → PSM), psmMintCall, approve(UUSD → router), begin, swap, end]`
  （`psmMintCall` 已有，`lib/web3/session-actions.ts:738`）。
- 授权额度：卖出方向 approve 精确 `amountIn`；买入方向 approve 精确 USDC 输入与精确 minted UUSD。
  不引入 max approval。
- 外部钱包：5792 已经要求 `atomicRequired: true` 并探 atomic 能力（`lib/web3/eip5792.ts:31`、
  `lib/web3/tx-executor.ts:414-417`），复合批次不需要新增保护。

### 3.4 展示

- 输出/min received：卖出方向的 min 由 `quoteRedeem(minUAssetOut)` 推出；买入方向由 router 报价的
  `amountOutMinimum` 给出。
- Rate 行：卖出 = `reserveOut / memeIn`；买入 = `memeOut / reserveIn`。
- USD 行：储备资产按 1 USD 计（USDC），uAsset 侧沿用现有 `uAssetUsd`。
- 余额行：储备腿显示钱包 USDC 余额（现有 `trade-balances.ts` 已按 PSM 读储备余额，`components/verse/trade-balances.ts:192`）。

### 3.5 费用呈现（单行合并）

只保留现有 `Fee rate` 一行，显示「本次交易按输入计的总成本」，不新增 PSM 费行。两段费的基数不同，
但都可以用报价自身的数据折算到**输入币口径**再相加，不引入 oracle，也不读 `tin`/`tout` 的固定值
（PSM 费率可由 owner 调整，必须跟随链上真实结果）：

- 口径：所有费用最终折成**卡片输入币**（用户实际输入的那个币：卖出=meme，买入=USDC）的单位，
  再除以 `amountIn`。买入方向的池内 swap 输入币是 UUSD、不是卡片输入币，所以两段费的换算方向不同。
- Router 费：`quoteSwap` 返回完整 `SwapQuote`（`Memeverse/src/swap/interfaces/IMemeverseUniswapHook.sol:59-66`），
  前端目前只映射了前三个字段（`components/global/execution-reads.ts:225-229`），需要补读
  `estimatedLpFeeAmount`、`estimatedProtocolFeeAmount`、`protocolFeeOnInput`。exact-in 下两个金额都是
  **池输入币**单位；`protocolFeeOnInput == false` 时协议费落在输出币侧，先用
  `mulDiv(protocolFee, userInput, userNetOutput)` 折回池输入币。卖出时池输入币就是卡片输入币；
  买入时是 UUSD，再按 PSM mint 汇率 `mulDiv(routerFeeUAsset, amountIn, uAssetIn)` 折回 USDC。
- PSM 费：直接用两端报价差，天然包含当前费率与 floor：
  - 卖出：`psmFeeUAsset = uAssetOut - quoteRedeem(uAssetOut)`，按本笔 swap 平均汇率折回 meme：
    `mulDiv(psmFeeUAsset, amountIn, uAssetOut)`。
  - 买入：`psmFeeReserve = amountIn - quoteMint(amountIn)`，本身就是 USDC，无需换算。
- 合并：`totalFeeInInput = routerFeeInCardInput + psmFeeInCardInput`，行值显示
  `totalFeeInInput / amountIn`。uAsset↔meme 直连时 PSM 项为 0，行值退化为当前行为。
- 分母固定是用户输入币的 `amountIn`，语义是「这笔交易按输入计的总成本」；不要把两个百分比直接相加
  （基数不同，会低估或高估）。review 弹窗的 `fee` 字段改用同一个合并值。
- PSM `quoteMint` / `quoteRedeem` 是 1:1 减费的确定性数学，差额就是精确费用；费率变更后自动跟随。

### 3.6 失败面映射

`decodeNestedRevert`（`lib/web3/kernel.ts:98-110`）与文案补：

- `StockCapExceeded` → 「该 PSM 的发行额度已用尽」
- PSM 储备不足 → 「储备池余额不足」
- `EnforcedPause` → 复用现有 uAsset 暂停文案
- `ZeroInput`（dust）→ 「金额过小」
- `PsmUAssetMismatch` / `PsmReserveMismatch` → 归入通用错误（正常路径不会触发，说明配置漂移）

### 3.7 文案与设计登记

- `components/global/copy.ts`：新增费用行、失败文案、储备腿名称（储备行仍走 canonical name，
  `swap-panel.tsx:211`）；`swapPairUnavailable` 保留给 POL/PT。
- `components/design-system/component-contract.md` §swap：可选集、可用腿、费用行、CTA 状态、
  失败文案（按 §8.2 登记义务）。
- `docs/design-system/copy-and-i18n.md`：新增键位与中英口径。
- 改到中文文案 → `pnpm build:cjk-font` + `pnpm check:cjk-font`。
- 改到监视树 → `node scripts/write-design-artifact-manifest.mjs` + `pnpm check:freeze`。

### 3.8 前端测试

- `tests/unit/`：报价数学（两段拼接、floor、minOut）、批次形状（preActions 顺序）、
  储备腿可用性判定。
- `e2e/`：三视口视觉基线 + axe（`pnpm test:e2e`），覆盖选币弹窗里 USDC 可选、费用行、CTA 状态。
- 合约侧 Anvil fork：新 generation 部署完成后，用真实 PSM 地址跑一遍卖出/买入的 fork 测试。

---

## 4. 测试矩阵（交付前全量）

| 层 | 命令 / 内容 |
| --- | --- |
| 合约单测 | `forge test --match-path 'test/swap/*PsmReserve*'` + 全量 `forge test` |
| 合约体积 | `forge build --sizes --skip test --optimizer-runs 100000 --via-ir`（Router 仍在 EIP-170 内） |
| 合约静态检查 | 仓内 slither 基线（`script/harness/slither-baseline.json`）重跑，新增告警需登记 |
| 类型/单测/lint | `pnpm exec tsc --noEmit`、`pnpm exec vitest run`、`pnpm exec eslint` |
| 边界/架构 | `node scripts/check-fixture-boundary.mjs --source`、`node scripts/check-architecture-compliance.mjs` |
| 设计闸门 | `pnpm check:design`、`pnpm check:contrast`、`pnpm check:freeze`、`pnpm check:design-docs`、`pnpm check:cjk-font` |
| ABI/部署清单 | `node scripts/check-abi-manifest.mjs` |
| E2E | `pnpm test:e2e`（三视口 + axe） |
| 测试网冒烟 | 三链各跑：faucet 领 USDC → USDC→meme 买入 → meme→USDC 卖出；对账钱包余额与 PSM 事件 |

测试网冒烟必须记录：交易 hash、`SwapMintForUAsset` / `SwapRedeemForReserve` 事件、前后余额差、
Router 无残留 uAsset（`balanceOf(MemeverseSwapRouter)` 在交易前后不变）。

---

## 5. 部署

### 5.1 nonce

`DEPLOYMENT_NONCE = 18568515786604916376943872092035382219393481865447784378031251369366894803451`
（256-bit 随机值，`uint256` 范围内）。

要求：

- Memeverse 与 OutStake 两份 `.env` 写入**同一个十进制字符串**；三链同 broadcaster、同 nonce、
  同批次顺序（`DEPLOYMENT.md` §4 角色约束）。
- salt = `keccak256(盐名, nonce)`（`script/MemeverseScript.s.sol:323-325`），所以这一代会换掉
  **全部** CREATE3 产物地址，不只是 Router。这是换代语义，不是局部升级。唯一例外是
  `OutrunDeployer`（CREATE2、固定 nonce 1 + `OutrunDeployerV1` 盐，换代不重部署，见
  `DEPLOYMENT.md` §5）。
- 快照目录会是 `deployments/nonce-<78 位数字>/…`；`deploy.sh` 的 snapshot 会删掉其它 nonce 目录
  （`script/deploy.sh:116-118`），旧代快照不再保留，回滚依赖 git 与链上状态。

### 5.2 部署前

1. Memeverse 仓完成 Router 改动并提交，记录 commit SHA（后面 pin 用）。
2. 两份 `.env`：写新 nonce；清空上一代的地址 pin（`*_DEPLOY_MISMATCH` 是 fail-closed 的，
   留着旧值会直接拦下）；按 `DEPLOYMENT.md` §4 核对其余必填项。
3. `./fork-rehearsal.sh`（透传 `DEPLOYMENT_NONCE`）完整预演；Arbitrum Sepolia 的 fork 必须用
   归档 RPC（`DEPLOYMENT.md` §1 已知限制）。预演产出的 pin 应与真跑一致。

### 5.3 部署

```bash
cd /home/azkrale/Web3Project
DEPLOYMENT_NONCE=18568515786604916376943872092035382219393481865447784378031251369366894803451 ./deploy-all.sh
```

13 个阶段按依赖序执行（`DEPLOYMENT.md` §2）：OutrunDeployer → uAssets → predict → Memeverse 主栈 →
PoolManager → Hook → HookLens+SwapRouter → OutrunRouter → mock+PSM+USR → SY/SP → POLend 注册 →
open → bootstrap。失败用 `START_PHASE` 续跑；同 nonce 重跑是幂等的。

关键门：

- 阶段 7 的 `launcher.setMemeverseSwapRouter(新 router)` 由脚本完成，不要手工补。
- 阶段 12 `open` 之前协议不接受注册；阶段 13 才会重新注入 faucet 储备。
- 部署完成后跑 `bash verify-contracts.sh`（档位感知、幂等），再跑 `./gen-deployed-addresses.sh`
  重生成 `DEPLOYED-ADDRESSES.md`。

### 5.4 前端产物更新

1. 从**冻结构建**导出 ABI：
   `node scripts/export-abi.mjs --src <Memeverse out 目录> --list <ABI 清单> --repo memeverse`
   （清单按现有 `contracts/abi/v1-rc/manifest.json` 的 `abis` 键重建，输出到 `v1-rc2`）。
2. 三链状态扫描写入 `/tmp/outrun-deploy-full.json`（地址、tx、block、codehash、impl）。
3. 更新 `scripts/generate-deployment-artifacts.mjs` 的 `COMMITS.memeverse` 为新 SHA、核对
   `KERNEL.*` 未变，然后 `node scripts/generate-deployment-artifacts.mjs` 重生成
   `contracts/abi/v1-rc2/manifest.json` 与 `deployments/{97,84532,421614}.json`。
5. ABI 版本：按 `docs/architecture.md` §8 的既有规则升级为 `v1-rc2`。新增函数是 additive
   （SemVer 上是 MINOR），但 ABI 文件内容已经变化，不能在 `v1-rc` 原地覆盖——§8 原文要求
   「冻结后的 ABI 语义变化必须提升 ABI 版本、更新 manifest、重新部署受影响测试网实例并完成
   全量回归」，并且「生产前端保留旧 ABI 直到对应旧代理和用户交易全部完成，禁止原地覆盖 ABI 文件」。
   做法：`contracts/abi/v1-rc/` 整目录保留不动；新建 `contracts/abi/v1-rc2/` 作为完整快照
   （`MemeverseSwapRouter.json` 由新构建重新导出，其余文件原样复制），manifest 与 deployments
   的 `abiVersion` 写 `v1-rc2`。

### 5.5 ABI 版本升级的执行清单（顺手把硬编码变成参数）

现状盘点（全仓只有这些地方知道版本目录名，组件层不直接 import JSON）：

- `scripts/deployment-schema.mjs:147`、`:174`：`z.literal('v1-rc')`。
- `scripts/export-abi.mjs:92`：输出目录常量。
- `scripts/check-abi-manifest.mjs:21`、`:29`、`:130`：manifest 与 ABI 目录路径。
- `scripts/gen-subgraph-config.mjs:309`：`ABI_DIR`。
- `scripts/generate-deployment-artifacts.mjs:333`、`:405`：`abiVersion` 与 ABI sha 路径。
- `lib/web3/abis.ts`：全部 ABI import 路径（应用侧唯一入口）。
- `lib/data/repository.ts:8` 注释、`tests/unit/web3/chains.test.ts:71` fixture、相关 docs。

执行方式（一次性，之后的版本升级只改一个参数）：

1. `export-abi.mjs` 增加 `--version`（默认 `v1-rc2`）并用它拼输出目录；`check-abi-manifest.mjs`
   的 manifest/ABI 目录从 `manifest.abiVersion` 推导；`gen-subgraph-config.mjs` 与
   `generate-deployment-artifacts.mjs` 同理，不再写字面量。
2. `deployment-schema.mjs` 的 `abiVersion` 在迁移窗口用 `z.enum(['v1-rc', 'v1-rc2'])`，新写一律
   `v1-rc2`；旧代 JSON 在 git 历史里仍可校验。
3. `lib/web3/abis.ts` 的 import 一次性指向 `v1-rc2`；这是应用层唯一需要改的文件。
4. `tests/unit/web3/chains.test.ts:71` 与注释同步。
5. 跑 `node scripts/check-abi-manifest.mjs` 与全部 `check:*`。

这套做法的依据：

- **版本目录不可变**：任何 ABI 变更产生新目录，旧目录原样保留；回滚 = 切回旧目录 + 旧 deployments，
  不依赖 git 考古，也不会出现「同一版本两份不同字节」的歧义。
- **单一间接层**：只有 `lib/web3/abis.ts` 知道目录名，UI/领域层零感知；版本升级不产生跨文件 churn。
- **元数据闭环**：manifest 把 `abiVersion` ↔ 两仓 commit ↔ 每文件 sha256 ↔ deployments 的地址与
  codehash 绑在一起，`check-abi-manifest` 校验链配置与 manifest 版本一致。
- **运行时可检测**：`abiVersion` 会写进每次写入的 `manifestVersion`，并参与 Type-4 管线的 stale
  检查（`lib/web3/type4-pipeline.ts:85`）；版本漂移会让待签交易失效重建，而不是静默用错 ABI。

### 5.6 回滚

- 旧代合约仍在链上；DApp 回滚 = 回退 `deployments/*.json`、ABI、manifest 到部署前 commit，
  前端即可指向旧地址（旧 Router 仍只支持 uAsset↔meme，功能降级但可用）。
- 合约侧没有"撤销部署"手段；新代地址一旦被前端引用就是唯一入口。因此升级前先在 preview 环境
  用新地址跑一遍。

---

## 6. 双仓文档与集成清单

### 6.1 Memeverse（真源仓）

- `src/swap/interfaces/IMemeverseSwapRouter.sol`：新函数 + natspec + 错误。
- `src/swap/interfaces/IPsmReserve.sol`（新增）：只读 `uAsset()` / `reserveToken()` + `redeem(address,uint256)` 的最小 PSM 接口，避免把 OutStake 的完整 ABI 拖进来。
- `src/swap/MemeverseSwapRouter.sol`：实现 + 重入锁。
- `test/swap/MemeverseSwapRouterPsmReserve.t.sol`（新增）、`test/mocks/swap/PsmReserveMocks.sol`（新增）。
- `docs/spec/swap/swap-integration.md`：公开入口清单新增 `swapExactInToReserve`，写明 exact-in、PSM 双绑定、失败面、买入方向由调用方组合。
- `docs/spec/swap/swap-flow.md`：新增「exact-in swap + PSM redeem」资金流小节。
- `docs/implementation-map.md`：`src/swap/MemeverseSwapRouter.sol` 行的入口描述补新入口。
- `docs/spec/events.md`：不改（Router 不发业务事件；现有条目已覆盖）。
- 部署脚本不改：`swaprouter` 批自然部署新字节码；salt 随 nonce 换代。
- 记录新的冻结 commit，供 OutrunDapp 的 `source-map.md` 与 manifest 同步。

注：`docs/spec/router/router-and-user-flows.md` 属于 OutStake 仓，不在本方案改动范围。

### 6.2 OutrunDapp

- 代码：`components/verse/swap-panel.tsx`、`components/verse/swap-live-quote.ts`、
  `components/global/execution-reads.ts`、`lib/web3/session-actions.ts`、`lib/web3/kernel.ts`、
  `components/verse/trade-balances.ts`、`components/global/copy.ts`。
- 产物：`contracts/abi/v1-rc2/MemeverseSwapRouter.json`、`contracts/abi/v1-rc2/manifest.json`
  （`v1-rc/` 原样保留）、`deployments/{97,84532,421614}.json`。
- 登记：
  - `docs/page-briefs/source-map.md`：Memeverse 冻结 commit 与新增锚点（Router 行号）；
    按登记方法复核交集，OutStake commit 若非本次改动则保持不变。
  - `docs/page-briefs/verse-trade.md`：交换腿、费用、失败面、CTA 状态。
  - `docs/page-briefs/asset-flows.md`：储备腿资金流（USDC → UUSD → meme / 反向）。
  - `components/design-system/component-contract.md` §swap：可选集、可用性、费用行、失败文案。
  - `docs/design-system/copy-and-i18n.md`：新文案键。
  - `docs/architecture.md`：新增修订记录（§27），写明 ABI 新增、nonce 换代、地址全量刷新。
  - `docs/design/final-artifacts.sha256`：重生成并过 `check:freeze`。
- 如后续决定采纳 uAsset 行名称修正（当前显示 `uAsset`），属于独立文案拍板，不并入本方案。

### 6.3 OutStake

零代码、零文档改动。唯一影响：换代会让 uAsset/PSM 地址变化，属于部署事实而非规格变化；
`OutrunRouter.setPsmForUAsset` 与 `SP.setGenesisLauncher` 的接线由编排器按新代 pin 自动完成
（`DEPLOYMENT.md` §2/§6）。

---

## 7. 实施顺序与验收

1. **契约先行**：命名与签名定稿 → 接口 + 实现 + 单测在 Memeverse 通过（`forge test` 全绿）。
2. **本地联调**：OutrunDapp 用 fixture 构建跑通 UI（储备腿可选、报价、CTA、失败面），
   `pnpm exec vitest run` + `pnpm exec tsc --noEmit` + `pnpm exec eslint` 通过。
3. **fork 预演**：`./fork-rehearsal.sh` 用新 nonce 跑完整 13 阶段，输出 pin 与真跑一致。
4. **测试网部署**：`./deploy-all.sh`（§5.3）+ 验证 + 地址表重生成。
5. **产物与文档回填**：ABI/deployments/manifest、`source-map`、briefs、契约、架构修订记录、
   冻结清单。
6. **测试网冒烟**：三链买卖各一笔，余额与事件对账，Router 无残留。
7. **交付门**：`AGENTS.md` §7.2 全量命令 + Playwright 三视口/axe + `check:abi-manifest` 全绿。

验收标准（可检验）：

- 交换卡 select 里 USDC 可选，选中后报价、minReceived、费率行、CTA 全部有值且可点。
- 卖出 USDC 腿的交易在链上一次成批完成；费率行是合并后的总费率（uAsset 直连时退化为 Router 费），
  PSM 侧改费后行值自动跟随；无 UUSD 残渣。
- 买入 USDC 腿的批次按 `mint → swap` 顺序执行；`amountIn` 与 `quoteMint` 输出一致。
- PSM 额度用尽/储备不足/暂停时整笔 revert，前端显示对应文案，钱包余额不变。
- `contracts/abi/v1-rc2/` 是完整快照且 `v1-rc/` 未被改动；manifest 与三链 deployments 的
  `abiVersion` 一致，`check-abi-manifest` 通过。
- `source-map.md`、ABI manifest、deployments、component-contract 与新代地址一致。

---

## 8. Memeverse harness 交接（合约段的执行入口）

合约改动必须走 Memeverse 仓的 `script/harness/gate.sh`。已完成的预编辑分类：

```bash
cd /home/azkrale/Web3Project/Memeverse
bash script/harness/gate.sh --classify-only --planned-files \
  src/swap/interfaces/IMemeverseSwapRouter.sol \
  src/swap/interfaces/IPsmReserve.sol \
  src/swap/MemeverseSwapRouter.sol \
  test/swap/MemeverseSwapRouterPsmReserve.t.sol \
  test/mocks/swap/PsmReserveMocks.sol \
  docs/spec/swap/swap-integration.md \
  docs/spec/swap/swap-flow.md \
  docs/implementation-map.md
```

结果：`change_class=prod-semantic`、`surface_sensitivity=sensitive`、`structural_escalation=true`、
`doc_round_required=true`、`orchestration_profile=full-review`、`verification_profile=fast`，
writer = `process-implementer` + `solidity-implementer`，
reviewers = `logic-reviewer` + `security-reviewer` + `refinement-reviewer`，
`requires_spec_authorization_evidence=true`。

授权证据（按 main-session-contract 记录）：

1. 授权来源：用户在本会话中的直接指令（exact-in 不可协商、USDC 走 PSM 一层）+ 本方案；
2. 选定的 spec 文件：`docs/spec/swap/swap-integration.md`、`docs/spec/swap/swap-flow.md`、
   `docs/implementation-map.md`；
3. 覆盖的行为：新增 `swapExactInToReserve` 入口、exact-in 语义、PSM 双绑定校验、余额差隔离、
   失败面与无新事件——均为本方案已列出的行为，不新增产品语义。

执行顺序（harness 强制，不能跳）：

1. 文档轮：`process-implementer` 改上述三个 doc → `spec-reviewer` 审；
2. 代码写：`solidity-implementer` 改接口/实现/测试/mock；
3. 代码审：`logic-reviewer` → `security-reviewer` → `refinement-reviewer`（refinement 的输入必须用
   `review-package.sh --files` 生成并通过 `validate-refinement-review.sh`）；
4. 验证：`bash script/harness/gate.sh --changed-files <实际改动集>`，Solidity 需带
   `GATE_DIFF_BASE` 或临时 diff 文件；`coverage_required_full_ci` / `slither_required_full_ci` 均为 true。

已知阻塞：本会话的 ZCode 进程以 OutrunDapp 为根目录，Agent 工具解析不到 Memeverse 仓
`.zcode/agents/` 下的项目角色（`process-implementer` 等），而 main-session-contract 禁止主会话
自行编写 `full-review` 改动。合约段需在**以 `/home/azkrale/Web3Project/Memeverse` 为根**的
Claude Code / Codex 会话（或 Memeverse 根目录启动的 ZCode 会话）里跑，上面的分类可以直接复用。
