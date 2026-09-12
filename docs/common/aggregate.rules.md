<!-- docs/common/aggregate.rules.md -->

Purpose: Define aggregate root and child-entity write guardrails.
Read when: You are designing, reviewing, or refactoring entities, aggregate boundaries, or write paths that touch multiple records in one bounded context.
Do not read when: Your task only changes adapter DTO names or pure read-only projections.
Source of truth: This file defines aggregate write boundaries; examples elsewhere must not override it.

# Aggregate 规则

## 聚合根

- 聚合根是聚合内唯一允许被外部写入的入口。
- 聚合根负责保护聚合内不变量。
- Usecase 负责本次操作的场景策略、流程授权、事务与跨域协调；聚合写入口负责保证本聚合
  的状态迁移及关联事实约束。事务入口仍由 Usecase 持有，不能因聚合校验下沉而迁入模块。
- 聚合根可以是领域模型、聚合根 service，或由 usecase 显式编排的聚合根写入口。
- 聚合根必须有清晰业务语义，不得因为表之间有关联就合并为一个聚合。

## 聚合内实体

- 聚合内实体不得被外部直接写入。
- 聚合内实体只能通过所属聚合根入口创建、更新、删除或整体替换。
- 聚合内实体可以被 QueryService 读取，用于投影、详情、列表或诊断视图。
- 聚合内实体的读取不得绕过写入规则。
- 若某实体需要被多个外部流程独立写入，应重新评估它是否应升级为独立聚合根。

## 外部写入定义

以下都属于外部直接写入，禁止：

- adapters 直接写聚合内实体。
- usecases 直接写聚合内实体 repository。
- 其他 bounded context 的 modules(service) 直接写聚合内实体。
- 同一 bounded context 内绕过聚合根 service 直接写子实体 repository。
- 为了方便批量修改，在普通业务 usecase 中直接写子实体表。

以下不属于外部直接写入：

- 聚合根 service 内部写自己的子实体。
- 聚合根 usecase 显式调用聚合根 service 写自己的子实体。
- QueryService 只读子实体并返回 View / ReadModel，不返回 Entity 或 adapter DTO。
- migration、baseline、受控修复脚本按数据库交付规则写表。

## 事务与聚合

- 单聚合写入由聚合根入口保护不变量。
- 跨聚合写入由 usecase 编排。
- 跨聚合事务必须由 usecase 持有事务边界。
- modules(service) 不得为了跨聚合一致性开启事务。
- 若跨聚合流程不能强一致完成，usecase 必须选择失败处理、补偿、重试或审计策略。

## Code Review 必查项

- 新写路径是否从聚合根入口进入。
- 是否有 usecase 或 service 直接写了聚合内实体 repository。
- 子实体是否出现独立生命周期。
- 子实体是否被 QueryService 之外的读写服务随意暴露。
- 是否把数据库关系误当成聚合边界。

## 项目约定

- 具体聚合归属和实现入口见[当前领域实现约定](../project-convention/domain-implementation-current.md)，不在本规则重复维护。
