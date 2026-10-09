# Page Brief Template — 每页 brief 的强制结构

> 所有页面 brief 逐节使用本模板；不适用字段写 `N/A + 原因`，不得删除栏位。审阅者按同一字段比较所有页面。

```markdown
# Brief：<route>（<页面职责>）

- routes.json ID：R-xx / GS-01 / EF-x
- 依据：architecture §（…）；source map 条目（M…/S…/OutrunBook…）；决策 ID（PD-xx，凡产品性选择必标）

## 1. 用户任务（该页存在的理由）
- 目标用户（引 OutrunBook audience）：
- 用户任务（来做什么，≤3 条，动词开头）：
- 完成定义（什么信号代表任务完成）：
- 页面上最重要的一个用户决策：

## 2. 核心组件（页面由什么构成）
- 组件清单（逐个：名称/职责/引用 component-contract 行为契约条目）：
- 桌面布局（1440：区块顺序与栅格，文字描述）：
- 移动布局（390：区块顺序、折叠/抽屉策略）：
- 密度依据（complexity-map 对应行）：

## 3. 数据依赖（数据从哪里来；表格或行文皆可，降级行为与 sourceRef 必备）
| 数据 | 类型（RPC/Graph/交易/URL/本地） | 降级行为 | source map 引用 |
|---|---|---|---|
（每行注明：Graph 项在 Index lag >120s 时如何降级；RPC 实时项永不降级为陈旧索引）

## 4. URL 状态（什么进地址栏）
- 路径参数 / 查询参数 / hash（各自的合法值与默认值）：
- 分享/回链语义（带着参数回来是否还原视图）：

## 5. 文案键（zh/en；en 优先引 glossary en 列——两者皆无的键标「en=文案轮补」，禁止留空占位）
| 键 | zh | en | glossary 术语引用 |
|---|---|---|---|
（术语必须来自定稿 glossary.md，brief 不得新造同义词；glossary 未定稿前本栏标 pending-glossary，步骤 5 后回填）

## 6. 全状态标注（对照 state-catalog.md，逐状态一行）
| 状态（规范名） | 标注（rendered-here / delegated / N/A(原因)） | 本页可见布局/链接目标（rendered-here 必填） |
|---|---|---|
（A1–A15、B1–B4 全列——C 系仅写操作语境；不适用的列 `N/A(原因)`；delegated 必须写明承载面并链接证据。异步状态的 aria-live 与恢复动作以 state-catalog 定义为准，§6 不重复）

## 7. 可点击主流程（怎么点通）
- 主流程步骤（编号：用户动作 → 系统响应 → 进入状态）：
- 写操作注明：「原型只演示 ViewModel 状态，业务集成待实装」
- 完成后出口（回到哪里）：

## 8. 错误恢复（失败如何恢复）
- 每类失败（拒签/上链失败/超时/参数无效/网络错误）→ 用户看到什么 + 点什么恢复：

## 9. 视觉证据（长什么样）
- 视觉依据：DESIGN.md 四轴、tokens.css token 名（不写色值）、component-contract 行为条目、motion-and-a11y（唯一品牌 moment）
- 禁止：引用已废弃的 UI 片段版面（决议 005）

## 10. fixture 场景（用什么数据验证）
- 引用 fixtures/scenarios/states.json 的场景 ID + 每场景本页期望观察点：
- 动态路由 fixturePath：
```

## 模板级硬规则

1. **状态无同义词**：只用 state-catalog 规范名（A/B/C 系 + 账户九态子机）。
2. **术语无新造**：文案键栏的术语来自定稿 glossary.md；定稿前标 `pending-glossary`。
3. **链上事实必有 sourceRef**：每个机制事实旁标 source map 条目（M/S/OutrunBook + commit）；写不出 sourceRef 的字段标「依赖冻结 ABI/manifest 后确认」，禁止猜测。
4. **产品性选择必有决策 ID**：排序键、指标集、信息优先级、命名、挂载点等 → `PD-xx`（docs/design/decision-log.md）。
5. **写操作三件套**：可点击主流程 + 全状态标注 + 错误恢复；缺任一即 brief 不完整。
6. **每页 N/A 也列全状态表**：审阅者靠完整表格做交叉检查（汇总成 state-coverage-matrix.md）。
