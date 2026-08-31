# Lost Desktop Museum Community

《遗失电脑博物馆》的静态案件登记册与社区目录。这里没有账号、数据库、评分榜或下载统计；作者通过 GitHub Pull Request 投稿，GitHub Actions 完成技术校验，合并后的 `catalog/` 被确定性构建为 GitHub Pages 静态目录。

- 浏览目录：`https://phlxxx.github.io/lost-desktop-museum-community/`
- Registry v1：`https://phlxxx.github.io/lost-desktop-museum-community/registry/v1/index.json`
- 主应用：`https://github.com/PHLXXX/lost-desktop-museum`

## 浏览与安装

静态网页可直接查看案件、发布者、内容提示、许可证和 SHA-256。推荐从主应用的“社区档案”打开详情并点击“安装到档案馆”：客户端下载后会重新计算 SHA-256，再运行完整 `.ldmcase` 安全校验。安装完成后案件可离线游玩。

## 投稿

先在主应用档案工坊导出 `.ldmcase`，使用“准备社区投稿”生成投稿包。Fork 本仓库，把发布者资料放入 `catalog/publishers/`，把版本内容放入 `catalog/cases/<caseId>/<version>/`，然后创建 Pull Request。详见 [投稿指南](docs/CASE_SUBMISSION_GUIDE.md) 和 [贡献说明](CONTRIBUTING.md)。

## 目录职责

- `catalog/`：唯一手工维护的源目录。
- `schemas/`：发布者、源条目和生成索引的 Schema。
- `scripts/`、`src/`：校验、确定性构建与无脚本静态站点。
- `tests/`：路径、包、安全、Schema 和构建回归。
- `dist/`：构建产物，不提交，由 Pages 工作流生成。

“自动校验通过”只表示格式、路径、资源、引用、可达性和哈希符合规则，不表示故事内容绝对安全。“人工精选”表示维护者检查过内容与基本体验，不代表实名认证。完整边界见 [信任模型](docs/TRUST_MODEL.md)。

社区浏览需要联网，案件安装后可离线游玩。收藏、评分、备注和调查进度只保存在玩家设备。
