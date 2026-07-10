<!-- docs/deprecated/README.md -->

# Deprecated Docs

本目录只存放历史背景或已完成计划的归档。

- 不作为实现指导。
- 不覆盖 `docs/common/*.rules.md`、`docs/api/*.md` 或 `AGENTS.md`。
- 若某条规则仍有效，应迁入稳定 docs，而不是只留在 deprecated 文档中。

## 已归档计划

- [Capability Plugin Plan](./capability-plugin-plan.md)：v1.4 历史实现计划。当前稳定规则见
  `docs/common/capability-ownership.rules.md` 与 `docs/common/capability-runtime.rules.md`；
  `plans/capability-plugin-direction.md` 仅保留兼容入口，不作为规则真源。
- [AI Workflow 基线补强计划](./ai-workflow-baseline-plan.md)：已完成，稳定规则已沉淀到
  `docs/common/ai-task-lifecycle-audit.rules.md`、`docs/common/queue-identifiers.rules.md`、
  `docs/worker/qm-worker-integration.rules.md`、`docs/worker/worker-adapter.rules.md` 和
  `docs/worker/worker-usecase.rules.md`。
