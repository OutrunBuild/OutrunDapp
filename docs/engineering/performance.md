# 性能纪律

从根 `AGENTS.md` §6 拆出的完整细则（刷新粒度/写后刷新/点击链路/开窗时机四条）；红线速览留在 `AGENTS.md` §6，命令与仲裁见 `AGENTS.md` §7。点击链路 RPC 问题默认先调 `vercel-react-best-practices` Skill（`AGENTS.md` §5.2）。

- **刷新粒度 = 变更作用域**：一次写操作完成后只重读该操作影响的项，禁止「清空整表 + 全量重读」。
  - 原因：未涉及的行会集体闪烁，一次操作被放大成 N 次 RPC。
  - 展示型倒计时存绝对截止时间，不存「剩余 + 探测时刻」——局部刷新会让其他行的基准漂移。
  - 全量重置只允许发生在账号 / 链 / provider 变化时。
  - 参考实现：`components/faucet/faucet-claims.tsx` 的 `probeRef`（按 symbol 合并、只重读本次领取的币种）。
- **写后刷新 = 双层管线，禁止裸 `router.refresh()`**：写确认后受影响数字的立即刷新不得依赖单独的 `router.refresh()`。
  - 原因：服务端数据走 30s/60s stale-while-revalidate 缓存（`onchain-source.ts` 的 `cachedConfig`、`graph-repository.ts` 的 `cached()`）——TTL 内当次渲染重放交易前数值，TTL 外也是先发旧值、后台 revalidation 落地后无再渲染；subgraph 聚合另叠加索引滞后。
  - **显示链口径**：创世逐链结算，聚合类显示（阈值进度表/参与面板聚合/可预购余量）跟随钱包实链（限 verse 落地集内；越集或断连回退 canonical 副本链 SSR 值）。
    - 基线 = `getVerse` 逐链行 `chainAggregates`；非 canonical 链的余量等即时值只能来自客户端探针。
    - 个人全链合计（「您的参与」）= 本链钱包 provider 读 + 兄弟链 on-demand server action（`lib/data/verse-reads.ts`）。
    - 参与地址 = omni 合计（逐链去重计数求和，跨链无身份可用）。
  - **即时层（客户端探针）**：触发 = 写确认（`tx.display === 'confirmed'`）或账号/链切换；数据源 = 钱包 provider（与 receipt 同链同源），定向重读本次写影响的项、直接更新显示位。
    - 参考实现 = `components/verse/genesis-live.tsx`（`VerseLiveProvider` + `writeNonce` 信号）与 faucet `probeRef`。
    - 确认窗口兜底：`notifyVerseWrite` 除立即 bump 外在 +3s/+8s 各补一次（`verse-write-signal.ts`）——负载均衡公共 RPC 的 read-after-write 不一致会让立即重读撞上未同步节点，而成功的 run 不重试，旧值会钉死到下一个无关触发器；新写清理旧窗口，固定爆发、非轮询。同参数探针共享在途 run（`trade-balances.ts` in-flight map），每次 bump 的成本是每读取形状一份批量读而非每挂载实例一份（同页通常两形状：带/不带 uAssetSymbol）。
    - 失败语义 = 只在钱包实链 ∈ 落地集时落值；读失败保持基线值（null 不覆盖）；账号/链/verse 变化清空（全量重置白名单点）。
  - **中央层（服务端收敛，新写面零接线）**：触发 = `use-tx-center` 见 `outcome === 'confirmed'`，统一调 server action `refreshVerseAfterWrite`（`lib/data/write-refresh.ts`，自动携带本笔 tx hash）；作用域 = `WriteSpec.writeScope` 声明 `{ kind: 'verse', chainId, verseId }`。
    - 顺序 = 先等 subgraph 索引追平写入区块（receipt 区块定位，读不到回退安全头），再失效两层缓存（`GraphRepository.invalidateVerse` + `onchain-source invalidateVerseConfig`，含磁盘 seed），预热 `getVerse` 后 `router.refresh()`。
    - 轮询必须有界：失效早了冷读会把交易前数值重新入缓存并重置 TTL。
    - 收益 = 页面全部服务端数字（进度条/参与地址/门槛/未来新增字段）一次收敛。
  - **新增写面的义务**：spec 带 `writeScope`（凡有服务端渲染依赖）+ 数值面板接探针；漏声明 scope 的面中央层兜不住。
- **点击链路 RPC 预算**：交易弹窗的点击链路禁止串行静态读与展示读。
  - 静态半（verse 元组、部署表、token decimals）在首次交互时由 `prefetchVerseSession` 预热；点击时 `getVerseSession` / `getTokenDecimals` 命中缓存（`components/global/write-session.ts`）。
  - 会话按「同落地链 + verse + account」合并：只有一个在途解析；调用必带 `chains` 允许集；会话按 provider 探到的实链缓存。
  - 5792 能力探测（`wallet_getCapabilities`，部分钱包构建上要数秒）按 provider 连接 + 链 + 账号缓存正向结果，连接建立时预热（`use-tx-center`）；`wallet_sendCalls` 报方法不可用时清缓存、下次点击重探。
  - 弹窗 SSR 已有的数据（费率、余额、headroom）点击时不重读；`quote/estimateGas` 只进渲染的面板才读（免审阅面板不读）；点击链路只留 `allowance` 这类必须现查的读（`readAllowances`，腿之间并行）。
  - 新增/改造交易弹窗照此接入，不要另建会话解析——组件直连 `resolveVerseSession` 由 `check-architecture-compliance` 拦截。
- **数据齐了再开窗，一次渲染**：点确认先探 `eth_chainId`（错链闸门 + 执行链选址：钱包在 verse 落地集的哪条链就在哪条链执行），再组 spec（allowance）并取完弹窗要画的报价（网络费行），全部到手才 `setReviewing(true)`。
  - 原因：弹窗打开后出现的后到行/数值会把已渲染的卡片顶一下（Network Fee 后到最典型）。
  - 链路等待放在表单态：`resolving` 持续置位挡住重复提交，失败走降级错误行；禁止把等待搬进弹窗。
- **实测开关**：`lib/web3/click-trace.ts` 记录点击链路的各相位（`chain.probe` / `session.*` / `allowance` / `quote` / `wallet.capabilities` / `wallet.sendCalls` / `wallet.sendTransaction`）耗时；默认关闭（每次埋点只有一次 `localStorage` 读取，不计时、不缓存行），`localStorage.setItem('outrun:click-trace','1')` 后重放点击，钱包调用返回时控制台打印表格。
  - 一次点击一个窗口：点击（捕获阶段）会清空上一轮的记录，报价轮询等后台相位不会混进本次时间线。
  - 用途：把「点按钮到钱包弹窗要几秒」拆到具体相位，再决定是并行、砍读还是归因钱包自身准备。
