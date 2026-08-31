# Maintainer workflow

1. 确认 PR 只修改登记范围且发布者资料合法。
2. 阅读 Actions Step Summary，要求所有 Schema、路径、截图、包、引用、可达性、往返与确定性构建检查通过。
3. 人工检查内容提示、版权声明、基本可玩性和是否冒充官方；仅在实际检查后设置 `curated`。
4. 合并到 `main`，等待 Pages 部署并验证索引、详情、包、截图和 SHA-256。
5. 新版本保持语义化递增；不兼容更新必须在 entry 与 CHANGELOG 中明确说明。
6. 对损坏或高风险版本可标记 `deprecated` 或 `blocked`。社区移除不会远程删除玩家本地副本。
7. 发布 Registry Release 时记录 source commit；回滚时恢复已知良好的 catalog commit 并重新部署，不直接编辑 `dist/`。
