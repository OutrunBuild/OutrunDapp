# Brief：`/memeverse/launch`（Consensus Launch 创建页）

- routes.json ID：R-03；**表单机制主源=SPEC-M8 verse/registration-details.md**；四项生命周期事实（双门槛/快速创世/365 天锁定/治理链枢纽）分源补引 M9 state-machines/M13 genesis（表单机制与生命周期事实分源）
- 依据：product-intent.md R-03；OB:memeverse/lifecycle.md:22/36/51-62/77；决议 C2（剩余资金不展示）
- 实现：`components/create/create-form.tsx` 等 `components/create/*`

## 1. 用户任务

- 目标用户：P5 发起人
- 用户任务：设定规则（选链+治理链、创世时长、Fast Genesis 开关〔快速创世，glossary B〕）→ 校验 symbol → 看费用报价 → 提交 → 跟踪跨链注册状态
- 完成定义：创世开启、进入阶段推进（Verse 页可见）
- 最重要的一个决策：**治理链选哪条**（治理链=质押/收益/投票枢纽，OB:memeverse/omnichain.md:13）

## 2. 核心组件

| 组件 | 职责 |
|---|---|
| 基本信息表单 | 名称/symbol（格式校验：SPEC-M8 规则读链校验，冲突实时提示）/描述/图片（必填——上传为必选项，提交校验+`required` 语义）/**社交链接选填**（Website/X/Telegram——详情与列表展示位；链上元数据是否容纳标 `pending-manifest`，暂存前端/索引层） |
| 链选择 | 多链启动选择器（六链限 §5）+ 治理链单选（必选其一） |
| 参数表单 | 创世时长（1–3 天=注册中心 min/maxDurationDays 读值样本）、Fast Genesis 开关（机制=快速创世：默认关闭；开启=任一门槛达标即可提前结束创世，无需等到截止——state-machines:33-35/lifecycle.md:52-54；UI 命名 Fast Genesis，glossary B；fixture 字段 `genesis.fastGenesis`，verse-020/022 样本）。**初始定价/最低成功额度不渲染**：非注册参数（SPEC-M8 §3），OB lifecycle.md:22 张力登记 source-map §6 对账区 |
| 费用报价卡 | 注册费用+多链部署费（SPEC-M8 费用口径；**报价结构以 spec 为准，字段依赖冻结 ABI 后确认的标 `pending-manifest`**） |
| 提交与状态 | 提交→跨链注册状态（逐链部署进度；源链与目标链事件分开） |

单页表单：基本信息→社区链接（选填）→创世规则；注册报价（随选链联动）并入表单卡尾部 Communities 下方+合约固定条款（锁定期 FIXED_LOCKUP_DURATION=365 天，无输入）；审阅卡（复用参与审阅形态，报价总额在审阅行内）后提交。密度=中低。

## 3. 数据依赖

symbol/名称占用校验=RPC（实时防抖）；费用报价=RPC（参数联动刷新）；跨链注册状态=RPC 事件+Graph（RSC 轮询降级）。

## 4. URL 状态

单页表单，无步骤 URL 状态；草稿暂存 localStorage（版本化 schema，client-localstorage 规则）留待业务集成阶段。

## 5. 文案键

create.symbol-hint（格式规则）/ create.govchain-note（治理链=质押、收益分配、DAO 投票所在链——glossary 全口径）/ create.fastGenesis（Fast Genesis：任一门槛达标即可提前结束创世，无需等到截止时间）/ create.lockup-note（锁定期 365 天硬约束，lifecycle.md:62）。剩余资金去向**不展示**（决议 C2）。

## 6. 全状态标注

A1 rendered-here（可填不可提）；A3 rendered-here（错链禁提）；A4–A7 delegated（启用/授权/签名）；A8–A12 delegated（交易中心；跨链注册为多阶段状态——源链确认≠部署完成）；A13 rendered-here（校验/报价骨架）；A14 N/A（表单无空态语义）；A15 rendered-here（校验失败+重试）；B1 N/A；B2 rendered-here（未部署链不可选）；B3 rendered-here（注册状态查询降级）；B4 rendered-here（回表单草稿保留）。

## 7. 可点击主流程（写操作——原型只演示 ViewModel 状态，业务集成待实装）

填基本信息→symbol 实时校验→选链+治理链→参数→审阅卡（费用+滑点/下限）→授权→签名→提交→逐链部署进度→全部链部署完成（跳 Verse 页；部分链失败=逐链重试态）。

## 8. 错误恢复

symbol 冲突：行内提示+建议；校验失败：字段级错误（不弹窗）；提交失败：错误解码+重试（草稿保留）；部分链部署失败：逐链状态+重试入口（SPEC-M8 注册流程边界——细节 `pending-manifest`）。

## 9. 视觉证据

DESIGN.md 四轴；表单组件行为契约（键盘/错误呈现）；费用报价卡 tabular-nums；无签名动效（唯一品牌 moment 限交易确认）。

## 10. fixture 场景

`normal`/`wrong-network`/`zero-balance`（费用余额不足）/`user-rejected`/`tx-failure`（部署部分失败）；symbol 占用=表单校验行为（断言，RPC 防抖）。
