# 发布流程

合并 PR 后，Pages 工作流会完整校验 catalog、生成 Registry v1 与静态站点、检查链接并部署。维护者验证 Pages 的首页、索引、案件详情、发布者、截图、包下载和 SHA-256 后再创建 Registry Release。registry 版本变更需要记录格式兼容性。

部署故障时不直接修改生成目录；修复 catalog 或构建器后重新部署。需要紧急回滚时恢复已知良好提交。问题版本可标记 `deprecated`；存在格式、安全或严重内容问题时标记 `blocked` 并说明原因，且不远程删除玩家本地副本。
