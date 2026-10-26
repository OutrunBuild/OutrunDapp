# 决议蒸馏清单（已签署执行）

> 2026-10-26 用户签署。执行结果：8 条②类规则已蒸馏进目标文档（008/009/取数纪律→architecture.md §2/§9；zoom→components.md；样本等比缩尺→根 AGENTS.md；token 图标辉光豁免与交易反馈面归属（045/046）→component-contract.md）；①57 + ②8 共 65 组条目（87 个 `##` 块，含全部补充子条目）已从 decision-log.md 删除。`approve.unlimited/unlimitedBody/revoke` 孤儿键已从 copy.ts 删除。016b 已按用户裁定「正式恢复」处置：现行 runbook 验收工作方式登记进根 AGENTS.md「阶段验收」节，016b 条目删除——decision-log 现为零条目（仅保留章程头）。剩余未决仅 043 条纹取舍（用户裁定暂不动）。

本清单为 decision-log.md 的三态处置草稿，未签署前不删除任何决议。判定基准 = 当前代码与常驻文档
（tokens.css / globals.css / components/** / docs/design-system/* / docs/architecture.md），关键落地
声明均经 grep/read 抽查；无法验证者标「待人工核对」，不作臆断。同名决议（014/016/037/047/048 各两
条不同主题）与全部修订/补充子条目已按父条目归并，共 66 行。三态：①已完全落地可删；②部分落地，
蒸馏仍成立事实进指定文档后可删；③保留（未落地/被推翻/仍约束未来）。

## 汇总表

| 编号 | 主题 | 三态 | 蒸馏目标 / 保留原因 |
|---|---|---|---|
| 001 | 风格方向锁定 D1+去极客化 | ① | DESIGN.md/README 硬约束、architecture §2 承载；默认 en 落地 |
| 002 | 主色延伸 P2 冷石墨 | ① | tokens.css + DESIGN.md §2 + check:contrast 闸 |
| 003 | 信息密度 T2 均衡 | ① | tokens（行高 44/正文 16）承载 |
| 004 | 字标锁定 | ① | brand/logo-spec.md 常驻契约 + 资产在 |
| 005 | 阶段 1 片段≠产品 | ① | 示例页已删（032），语义无作用对象 |
| 006 | 架构修订窗口（基线+默认 en） | ① | architecture §21 已修订、proxy 现状一致 |
| 007 | 阶段 2 产品拍板（PD/对账/术语） | ① | architecture §2/§21（嵌入动线、术语纪律、R-07）+ page-briefs 承载 |
| 008 | 治理外置 Tally+市场对标采纳 | ② | M1-M5 已实现；Tally 零代码落点→蒸馏 architecture.md 并待核对 |
| 009 | v1 permissionless 触发，不建 keeper | ② | changeStage 已落地（end-genesis-button）；费分发/finalize 入口待核对→蒸馏 architecture.md |
| 010 | 审美重锚+勘误+审计修正 | ① | DESIGN.md §1/§4、tokens、token-contract 常驻 |
| 011 | v0 范围缩减 3 代表页 | ① | 历史事件，v0 循环已终结（030/031） |
| 012 | 追认 v0 细节精修 | ① | docs/design-system/ 目录与 §11-13 契约即产物 |
| 013 | 字阶全量上调 | ① | tokens 12/14/16/18 实测在 |
| 014a | 顶栏地平线签名重设计 | ① | globals.css product-topbar 落地 |
| 09-25 | 杠杆术语改「借贷资金」 | ① | copy.ts en/zh 已改、glossary 同步 |
| 015 | 品红三层管辖 | ① | README §3 #4 已登记（实测在） |
| 015补 | 返佣分账条品牌三色 | ① | globals.css ref-split 三段色实测在 |
| 10-01 | 标题信号失真 .ax-fault-title | ① | CSS+components.md/motion-and-a11y 登记 |
| 10-01 | 发现页三 tab 无「全部/退款」 | ① | 实现自始正确，文档勘误已同步 |
| 10-01 | 首页 KPI 数字豁免等宽红线 | ① | globals.css 该规则处裁定注释在 |
| 016a | Portfolio 四分区+跨链页内化 | ① | 页面落地；architecture §2 路由演进行已载 |
| 10-02 | 三列卡 zoom:0.8 已知妥协 | ② | 蒸馏 components.md：移除须配三列窄卡版式、禁单删 |
| 017 | 收益组合页质量轮（含补 2） | ① | Q3/Q6/Q7 token 实测在；Q1 档位偏差见偏差登记 |
| 018 | Portfolio 移动端（含补 1/2/4/6） | ① | zone-tabs/sheet/两列格/居中实测在 |
| 019 | 价格格式化市场口径 | ① | amount-format.ts fmtPrice 落地 |
| 020 | 顶栏三控件（含补 1-4/7） | ① | --topbar-height 52px 统一双壳实测在 |
| 021 | 组合页签名线移除 | ① | 六分区作用域 CSS 在 |
| 022 | 待办卡 @container 堆叠 | ① | 本仓首个容器查询实测在 |
| 023 | 分享功能（含补 4/7/10/13-16/19） | ① | verse-share 终态+body 级膜+ghost CTA 落地 |
| 024 | 首页导航终端索引 | ① | CSS 在；等宽豁免由消费点注释承载 |
| 10-08 | 无参与态数据卡隐藏 | ① | UserDataGate+component-contract §33 |
| 10-08 | 断连黄色连接 CTA | ① | ConnectWalletCta 落地+登记 |
| 10-08 | 笨重标题降档+字重补档 | ① | fonts.ts 四档+七处降档落地 |
| 10-08 | fixture 重复推导 wontfix | ② | 蒸馏 architecture.md：真数据接入须统一取数入口、消除双源 |
| 025 | 字标交付衍生 480/96px（含补 1） | ① | public/brand 衍生资产在+foundations §9 |
| 026 | 死代码清剿+next-intl 退役 | ① | package.json 零 next-intl 实测 |
| 027 | 时长 zh 本地化 | ① | staticDuration(locale) 实测在 |
| 028 | 字体死档修剪 | ① | fonts.ts Saira 600/700 实测（Noto 已随 029补2 移出） |
| 029 | 刷新闪变（含补 1/2/3） | ① | font-preload+CJK 子集自托管+fallback 落地；教训在 fonts.ts 注释 |
| 014b | 11 路由蓝图作废收敛 5 路由 | ① | architecture §2 路由演进行承载（faucet 为后续新增） |
| 10-09 | governance 可领越权裁剪回滚 | ② | 蒸馏根 AGENTS.md：样本量级调整只走等比缩尺决议、禁归零/删构成 |
| 016b | runbook 流程退役 | ③ | docs/runbooks/ 现存 stage-04/05/06 新册，裁定与现实漂移→待人工核对 |
| 030 | prototype 证据包清理 | ① | 目录已删 |
| 031 | v0 孤儿脚本移除 | ① | 脚本已删、引用零残留 |
| 032 | design 考古树清理（含补 1-5） | ① | 树现状=终态，freeze 清单双向闸承载 |
| 033 | 钱包/交易文案增补 | ① | copy.ts wallet 节在（孤儿键见待核对） |
| 034 | 登录弹窗重构 | ① | login-identity.ts+public/login+loginMethods 实测在 |
| 035 | 顶栏地址档（补 1 被补 2 回撤） | ① | 终态 16px/0x+4+4/space-2；formatHexTopbar 已删实测 |
| 036 | Faucet 免审阅直调（含补 2） | ① | executeDirect+架构 §7/§14/§29+§34 登记 |
| 037a | Get UUSD 免审阅+5792+执行器 | ① | write-route/eip5792/tx-executor 落地 |
| 037b | 参与面板余额客户端现读 | ① | onchain getWalletBalances 恒空表实测在 |
| 038 | 三处 EN Title Case | ① | copy.ts 实测在 |
| 039 | legacy 跳转退役 | ① | proxy.ts 零 LEGACY_PATHS 实测（/en 307 保留） |
| 040 | Button 禁用反馈根因修复 | ① | enabled:active:not-aria 门控实测在 |
| 041 | TxReviewPanel 全席废除 | ① | 组件已删、approval 精确额度 |
| 042 | uAsset 图标（含补 1-6，终态 #221E08/环21/字形再缩+glow 豁免） | ② | 蒸馏 components.md：token 图标属品牌资产层，辉光不受数据零 glow 约束 |
| 043 | 扫描线膜迁址被否回滚 | ① | body 级 .ax-scanlines 实测在；条纹取舍未拍板见待核对 |
| 044 | 门槛条达标转品红 | ① | data-reached/--stage-next 实测在 |
| 045 | 站内交易确认+签名终端（含补 1，被 046 撤销） | ② | 蒸馏 component-contract.md：签名终端层已试并撤销，勿再引入 |
| 046 | 撤终端回三步条+Gas 控件（含补 1-13） | ② | 蒸馏 component-contract.md：反馈=产品弹窗+三步条、错误两桶、外部钱包无 Gas 控件 |
| 047a | Get UUSD 弹窗补三步条 | ① | faucet-swap-dialog TxStatus 实测在 |
| 047b | Faucet 领取三步条+关 Privy UI | ① | showWalletUIs:false+进度窗实测在 |
| 048a | 参与链闸门取真实部署集 | ① | chains.ts verseExecutionChains 实测在；边界由 AGENTS.md 性能纪律段承接 |
| 048b | 成功页交易链接（含补 1/2） | ① | .tx-success__hash 台账行实测在 |
| 049 | Gas 地板价+feeHistory 分位 | ① | 被 050 修订，单测承载 |
| 050 | Gas 模型修订+20s+请求收敛（含补 1/2） | ① | use-gas-quote 注释+p10/p50/p90+单测承载 |

三态计数：①57 · ②8 · ③1（另 043 遗留待拍板项 1 条）。

## 可删批次建议（互相独立、全落地者先行）

- 批次 1（历史/清理，零依赖）：005、011、014b、026、030、031、032
- 批次 2（视觉与资产，纯代码承载）：002、003、004、013、014a、015、015补、10-01 三条、018、019、020、021、022、023、024、笨重标题、025、028、043、044
- 批次 3（产品与文案面）：001、006、007、010、012、016a、09-25 术语、017、027、029、033、034、035、038、10-08 无参与态两条
- 批次 4（web3 交易管线）：036、037a、037b、039、040、041、047a、047b、048a、048b、049、050
- 先蒸馏后可删（②类 8 条）：008/009→architecture.md；zoom→components.md；wontfix→architecture.md；governance 回滚→根 AGENTS.md；042→components.md；045/046→component-contract.md
- 暂缓保留：016b（runbook 退役与现实漂移，待人工核对后定）

## 落地偏差登记

1. 决议 017 Q1：裁定新增 `--text-num-xl` 28px mono 档未落地——tokens.css 无该 token，组合页 hero
   实用 `--text-xl`（=28px，视觉等价）；文档侧已按现状改写。删除 017 前无需补建，但该偏差事实随本清
   单留档。
2. 决议 016b（runbook 退役）裁定删除 docs/runbooks/ 整目录；现目录存在 stage-04/05/06 新 runbook
   与 acceptance-checklist（2026-10-26 修改）——退役裁定被后续阶段实践取代但无新决议登记。

## 待人工核对清单

1. 008 Tally 外置：代码与 architecture.md 均零 tally 落点，治理创建/执行外链与「已执行」回显是否仍为规划项。
2. 009 permissionless 触发口：changeStage 已核实；「触发费分发」与治理「finalize 结算」前端入口是否已实现。
3. 016b：runbook 工作方式是被正式恢复还是应再次清理 docs/runbooks/。
4. 043 遗留：uAsset 暗盘条纹与膜亮度的取舍仍未拍板（未拍板前不动膜、不动盘面色 #221E08）。
5. 033 残留：copy.ts `approve.unlimited/unlimitedBody/revoke` 等键在 041 面板废除后是否为孤儿（本轮未逐一核消费方）。
