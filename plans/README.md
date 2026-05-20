<!-- 文件位置: plans/README.md -->

# Plans

本目录存放当前项目仍在推进中的计划文档。

`plans` 的职责是回答：

- 接下来要推进什么
- 优先级如何排序
- 前置条件是什么
- 每一项希望产出什么

`plans` 不负责定义稳定规则。若某条边界已经稳定，应进入 `docs/` 下对应 rule 文档，而不是继续留在
`plans/` 中反复描述。

## 读取顺序

阅读某个 plan 时，优先按下面顺序处理：

1. 先看当前 plan 本身，确认目标、范围、优先级和产出物
2. 若 plan 明确引用了某份 rule，再按需打开对应 `docs` 文档
3. 若多个 rule 可能冲突，再看 [docs/common/rule-precedence.rules.md](../docs/common/rule-precedence.rules.md)
4. 若当前 plan 需要真实后端字段、类型或权限语义，先按需查看本地 schema、DTO、resolver、usecase 或 entity

## 与 Docs 的关系

- `plans/`：记录尚在推进中的事项、阶段和待完成产出
- `docs/`：记录已经稳定的规则、边界、约定和开放项

常见情况：

- 若 plan 里写着“已移入规则的内容”，不要再把 plan 当成主规则来源
- 若需要判断正式边界，优先去 [docs/README.md](../docs/README.md) 查对应主题入口
- 若只是执行某个 plan 中的单一事项，只打开该事项直接引用的文档即可
- 若需要后端契约，优先读取与当前任务直接相关的本地 schema、DTO、resolver 或 usecase

## 命名约定

- `*-direction.md`：方向判断。回答“要不要做 / 朝哪做”。
- `*-plan.md`：推进计划。回答“怎么做 / 按什么阶段做”。
- `*-followup.md`：尾项跟踪。回答“主链路完成后还剩什么”。

## 当前优先级约定

若某份 plan 使用 `P0 / P1 / P2 / P3`，默认按以下语义理解：

- `P0`：不做就会阻塞主线落地
- `P1`：不阻塞主线，但应尽早补齐，否则实现容易继续发散
- `P2`：需要相关页面、模块或上下文先稳定下来后再推进
- `P3`：需要更多真实使用模式或更成熟前置条件后再展开

## 当前计划

- [account-generic-identity-plan.md](./account-generic-identity-plan.md)
