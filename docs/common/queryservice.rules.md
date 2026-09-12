<!-- 文件位置: docs/common/queryservice.rules.md -->

Purpose: Define read-side access, permission, and output-shaping guardrails for QueryService.
Read when: You are implementing, reviewing, or refactoring modules queries and read-side output shaping.
Do not read when: Your task does not change QueryService boundaries.
Source of truth: This file defines QueryService rules; code examples elsewhere must not override it.

# QueryService 说明

## 目标与定位

- QueryService 用于读侧能力收敛。
  负责读取、权限判定与读侧输出整形。
- Usecase 是 QueryService 唯一的上层调用者，禁止 adapters 直接依赖 QueryService。
- 同一 bounded context 的 QueryService 可以把另一个 QueryService 作为只读下游依赖；这种
  modules 内部组合不属于“上层调用”，必须保持单向且无环。
- 本规则中的“同一 bounded context”按物理 owner 根目录判断：即
  `src/modules/<bounded-context>/` 中 `<bounded-context>` 相同。不同子目录或不同 Nest feature
  module 不自动构成跨 bounded context。
- QueryService 的上述横向组合许可不覆盖 capability dependency 规则；capability 前置与运行时
  gate 仍必须遵守 `docs/common/capability.rules.md` 和对应 capability decision。
- QueryService 不产生副作用，不包含写入行为。
- QueryService 归属 modules(service)。
- QueryService 下游可以依赖 core、同域只读 repository、同域 ORM Entity、同域其他
  QueryService，或通过 DI 引入的 infrastructure 查询实现。
- QueryService 不依赖混合读写的普通 Service。

## 文件结构

- 通用结构：`src/modules/<bounded-context>/queries/*.query.service.ts`。
- 一个文件聚焦一类读取职责，避免跨语义混杂。

## 命名方式

- 简单读且以 Entity 为语义中心：`<entity>.query.service.ts`。
- 单一读取语义且不等于实体名：`<semantic>.query.service.ts`。
- 带结果整形或读取阶段判定等场景语义。
  以读取语义命名。

## 职责分配

- 读侧输出整形。
  - QueryService 负责将内部实体或聚合读取结果转换为稳定 View、ReadModel 或 Record snapshot。
  - QueryService 不创建或返回 adapter-owned DTO；DTO 映射由 adapter 完成。
  - 对上游禁止返回 ORM Entity 或 QueryBuilder。
- 只读与权限判断。
  - 细粒度授权与读侧校验在 QueryService 内完成。
  - 包括可见性与字段裁剪。
  - 写用例的流程级授权由 Usecase 负责。
  - QueryService 不参与写侧决策。
  - 细粒度授权可抽为同域 PermissionPolicy / AccessPolicy。
  - 可实现为纯函数或 service。
  - 供 Usecase 与 QueryService 复用。
  - Usecase 可以调用 QueryService 获取只读结果。
  - QueryService 不反向调用 Usecase。
  - 跨 bounded context 读取必须提升为 usecases。
  - 同一 bounded context 内只允许 QueryService 到 QueryService 的只读组合，不得借此调用普通
    Service、写 repository 或形成跨域 modules 依赖。
- 不做事务编排与写入。
  - 写操作与事务编排由 usecases 负责。

## 读取迁移与映射复用

- 独立读取入口迁入 QueryService 后，应核对调用面并删除无调用的旧 Service 查询方法，
  避免保留两套相同查询。仍有调用者时，先迁移调用者或复用同域内部只读查询实现。
- 写 Service 为锁定、聚合约束检查、批量 diff 和写入结果进行的内部读取属于写操作的一部分，
  不因读写分离而强制迁入 QueryService。
- Service 与 QueryService 输出同一稳定 View 时，可共用同域模块内部的 `*-view.mapper.ts`。
  Mapper 仅做字段投影，无 I/O，不选择场景策略或权限；Entity 输入不得泄漏到上游。
  它属于模块内部实现，不因无副作用就成为 Core policy 或 Usecase 可导入的纯规则。
- 复用写入时已取得的记录进行映射，不为去重额外查询数据库；保留原有事务上下文与读取时点。
- QueryService 不得为了复用映射而依赖混合读写 Service。不同可见性、默认值或结果语义的
  View 不应仅因字段相似强行合并。

## 依赖方向

- adapters → usecases
- usecases → modules(service) 或 core。
- modules(service) → infrastructure 或 core。
- QueryService 归属 modules(service)。
- 上层只允许 usecases 依赖；adapters 不得直接调用 QueryService。
- QueryService 下游优先依赖 `core`、同域只读 repository、同域 ORM Entity，
  或通过 DI 注入的 infrastructure 查询实现。
- QueryService 允许依赖同域的其他 QueryService。
  “同域”在此明确指同一 bounded context；依赖必须保持只读、单向且无环。
- QueryService 不应依赖混合读写的普通 Service。
  即使当前调用的方法恰好是只读方法，也不作为例外。
- 若某查询能力当前只存在于普通 Service，应优先下沉为只读 repository / 查询实现。
  或拆为独立 QueryService，而不是继续扩大 QueryService → Service 依赖。
- QueryService 产出的稳定共享 View / contract type，若只在同一 bounded context 内跨层复用，
  放在 `src/modules/<bounded-context>/<bounded-context>.types.ts`。
- 仅当该类型跨多个 bounded context 稳定复用时，才上收到 `src/types`。

## 拆分原则

- 单文件单语义。
- 一类事情一文件。
- 视图映射是 QueryService 基础职责。
- 不把视图映射作为拆分理由。
- 当出现多种读取语义时，考虑拆分。
- 当出现不同权限策略时，考虑拆分。
- 当出现不同输出形态时，考虑拆分。
- 若只是几个轻量方法且语义一致，不必拆分。

## 项目约定

- 具体领域的读取与 View 维护入口见[当前领域实现约定](../project-convention/domain-implementation-current.md)。
