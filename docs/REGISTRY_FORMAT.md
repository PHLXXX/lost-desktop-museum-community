# Registry v1 format

维护者编辑 `catalog/publishers/<publisherId>.json` 与 `catalog/cases/<caseId>/<version>/entry.json`。构建器生成 `registry/v1/index.json`、案件详情、发布者详情、checksums、stats、包与截图。索引仅包含列表摘要，版本历史和 SHA-256 位于案件详情，完整 CaseDefinition 只在 `.ldmcase` 中。

所有 ID 使用小写字母、数字和连字符；版本使用语义化版本；相对路径不得包含绝对路径、协议、路径穿越、大小写冲突、保留名称或符号链接。`active` 允许安装与更新，`deprecated` 显示停止维护提示，`blocked` 禁止新安装和更新。`generatedAt` 与 `sourceCommit` 是允许随构建变化的字段，其余同输入输出稳定。
