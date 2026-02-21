# PRD 包：Folder-First Shared DB Rollout

**成文日期**：2026-02-18 16:01:48 UTC+8
**最后修订**：2026-02-18 21:00:00 UTC+8

本文档为本专题 PRD 包入口。阅读时当前系统实现可能已发生变化，请以实际代码与产品行为为准，谨慎参考。

---

## 文档档位与产物策略

- tier：medium
- package_path：docs/prd/20260218_02_folder-first-shared-db-rollout
- 判档依据：生产改造 + 接口变更 + 数据迁移 + 共享数据库风险控制，需跨前后端与运维协作。

## 存储路径与命名规范

- root_path：docs/prd
- package_name：20260218_02_folder-first-shared-db-rollout
- 命名规则：YYYYMMDD_index_short-slug（short-slug 建议 2-5 词，长度 <= 32）

## 背景

1. 当前线上与测试共用一套 PostgreSQL，任何测试改造都可能直接影响线上数据与行为。
2. 本期引入“层级矩阵（root/folder/file）+ 批量移动 + 置顶”，需要新增数据语义与迁移机制。
3. 目标是在共享 DB 前提下，实现“可灰度、可观测、可回滚、对线上无感”。

## 阅读顺序

1. `01_产品方案_PRD.md`
2. `02_技术方案_架构与接口.md`
3. `03_数据模型与存储设计.md`
4. `04_风控与安全策略.md`
5. `05_时序与状态机.md`
6. `06_实施计划_测试与回滚.md`

## 关键决策

1. 采用 `migrate` 策略，不做一次性 replace。
2. 数据层采用“只增不改”原则：优先新增扩展表，避免修改热表结构。
3. 按 workspace 灰度 + release channel 隔离，测试流量默认不可写线上工作区。
4. 右侧内容区采用 `nodeType` 分流：folder=目录视图，file=正文编辑器。
5. 默认不自动迁移历史根层文件；仅在 Owner/Admin 手动触发迁移任务时改写 `parent_page_id`，且全程可审计可回滚。

## 非目标

1. 本期不做“线上/测试物理分库”；该项作为后续治理任务。
2. 本期不引入文件夹独立 ACL，仍继承 Space 权限模型。
