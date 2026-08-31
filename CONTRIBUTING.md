# 贡献与投稿

1. 阅读内容准则与信任模型。
2. 在档案工坊完成完整试玩、校验和 `.ldmcase` 导出。
3. 使用“准备社区投稿”或主项目 `npm run community:prepare` 生成投稿包。
4. Fork 本仓库，在 `catalog/publishers/<publisherId>.json` 添加或复用发布者资料。
5. 将版本文件放入 `catalog/cases/<caseId>/<version>/`，不要编辑 `dist/`。
6. 使用投稿模板创建 Pull Request；一次 PR 只提交一个案件或一个发布者的紧密相关更新。
7. 根据 Actions 的案件 ID、版本、字段路径、错误代码和修复提示调整。
8. 自动校验通过后等待人工内容与基本体验审核。维护者决定 `curated` 与 `featured`。

更新版本必须使用更高的语义化版本并准确声明存档兼容性。删除或重命名已发布 ID 可能破坏玩家进度，必须在 CHANGELOG 中说明。投稿即确认拥有分发所需权利，且 `distributionConsent` 为 `true`。
