# 设计参考输入说明（Stage-01 步骤 2）

> canonical inbox：`docs/design/references/inbox/`（已确认可写，后续新增资源统一放这里）
> legacy inbox：`docs/runbooks/references/inbox/`（现有仓库中不存在，无登记项；若后续出现，原地保留、不移动不删除，来源记录保留实际路径）
> 用户无需手工创建登记文件，Agent 负责生成唯一 `source-id` 并写入 `user-sources.md`。

## 1. 输入方式（二选一，不使用 v0 Plus）

1. 在当前会话点击附件/上传按钮，上传图片、截图、视频帧、PDF 或字体样本，并在同一条消息粘贴网站 URL；或
2. 无附件按钮时，在文件管理器打开 `/home/azkrale/Web3Project/OutrunDapp/docs/design/references/inbox/`，把文件拖入该目录，再发送文件名和网站 URL。

终端方式（把 `/absolute/path/to/reference` 换成实际文件，不用相对路径）：

```bash
mkdir -p /home/azkrale/Web3Project/OutrunDapp/docs/design/references/inbox
cp --preserve=mode,timestamps "/absolute/path/to/reference" /home/azkrale/Web3Project/OutrunDapp/docs/design/references/inbox/
```

消息格式：

```text
参考资源：
- 附件：cyberpunk-palette.png；观察：霓虹色、暗部层次；授权：reference-only；允许上传第三方工具：否
- 网站：https://example.com；观察：字体、材质、动效；授权：reference-only；允许上传第三方工具：否
- 附件：my-logo.svg；观察：字标比例；授权：licensed-for-product；允许上传第三方工具：是
```

没有用户资源时，必须发送 `user-supplied: none`，不能把空清单当作完成。

## 2. 命名与登记

- 保留原始文件名与时间戳，不重命名、不重复复制（已在 inbox 的不重复复制）。
- Agent 为每个文件/URL 生成唯一 `source-id`，补齐类型（image/site/video/pdf/font）、原始 URL/本地来源、作者/品牌、获取日期、授权状态、观察目标、禁止事项和 `externalToolUpload`。
- 默认授权 `reference-only`，`externalToolUpload: denied`：可留仓库本地研究，不得复制到产品或上传 v0 等第三方工具。
- 只有明确标记 `externalToolUpload: allowed` 才可进入 v0 资源包；只有明确标记 `licensed-for-product` 才可成为候选产品资产，且仍需阶段 1 人工选择。
- 品牌资产 `docs/design/brand/**` 与 `docs/design/logo-variants/**` 登记为 `licensed-for-product`，`externalToolUpload` 仍由人类逐项标记；进入 v0 输入包的位图/矢量从 brand/ 成品包选取。

## 3. canonical / legacy 边界

- 新增外部内容只进 canonical `docs/design/references/inbox/`。
- legacy `docs/runbooks/references/inbox/` 文件（当前不存在）如出现可保留原路径，登记时保留实际 `sourcePath`。
- 两处内容都不得进入 `public/`、生产路由或组件目录。

## 4. 保留 / 清理 / 不进生产构建

- 参考截图保留在仓库，直到阶段 1 handoff 明确记录“已无用”并经人类批准才清理。
- 不得自动删除、外传，或把 reference-only 误当产品资产。
- 文件损坏、来源不明或 URL 无法打开时保留原始输入并标 `blocked`/`unknown`，不删除、不用模型记忆替换；许可不清保持 `reference-only`。
