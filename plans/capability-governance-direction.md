# Capability Governance Direction

## 目的

Capability 治理表达项目提供哪些业务或技术功能、事实与运行资源由谁拥有，以及这些功能如何在运行时安装和协作。
它不是新的代码分层，也不以依赖图、物理目录或部署拓扑代替语义判断。

## 横向与纵向

- 横向分层回答技术职责：adapter、usecase、module、infrastructure、core 和 types 继续遵守现有边界。
- 纵向 capability 回答功能 ownership。一个 capability 可以穿过多个横向层，但不能改变各层职责。
- Capability 不是 Nest module、ORM entity、GraphQL resolver、部署进程或微服务的同义词。

## 准入

Capability 必须拥有至少一种可独立命名的对象：

- 内聚业务事实及其生命周期、规则和读写语义。
- 独立产品结果，以及自身状态、政策或生命周期。
- 可独立安装或执行的 provider、queue、transport 或 operation 资源。
- 跨业务域不可避免的平台事实或控制面行为。

组合查询、报表、预填、同步、事务、dispatcher 和 runtime consumer 默认不是 capability。业务对象优先也不表示每个
entity 都是 capability；边界必须具有共同变化原因和稳定业务或运维语言。

判断候选项时依次回答：

1. 它拥有哪个事实、运行资源或独立业务结果？
2. 它是否有自己的生命周期、规则和变化原因？
3. 人类能否脱离依赖图独立命名并理解它？
4. 去掉跨 owner 调用后，它是否仍然成立？
5. 如果只剩组合、转发、事务或部署需求，它是否应降为 usecase、read model、facade 或 runtime metadata？

## 两套职责

### Capability Ownership Metadata

Ownership metadata 回答“这个功能是什么、拥有什么、不负责什么、代码在哪里、通过什么公开面协作”。它通过 Nest provider 声明
`capabilityId`、`kind`、semantic scope、`owns`、`nonGoals`、physical scopes、public surfaces、
allowed dependencies、foundation classification 与 validation entrypoints。所有实际安装的 ownership provider
共同形成逻辑 Catalog；不再维护一份平行 JSON Catalog。

Allowed dependencies 只表达已批准的跨 capability 协作，不作为 ownership 证据。Owner-only capability 合法，不需要 Runtime Manifest。

### Runtime Manifest

Runtime Manifest 回答“已确认的 capability 如何运行”：runtime state、operations、runtime dependencies、
transports、providers、queues 和 session/API contributions。API/Worker process membership 从 Nest root module graph
推导，不在 manifest 中重复声明。

Runtime dependency 可以为启动与装配保持无环，但不能反向定义语义 ownership。Runtime Manifest 必须引用 ownership id；
没有真实运行治理需求时不得为了进入 capability 地图而制造 manifest。

## 迁移顺序

1. 从现有业务语言、API/current contract、事实存储和写生命周期确认 owner。
2. 声明 ownership 的 scope、owns、non-goals、physical scopes、public surfaces 和 allowed dependencies。
3. 建立 owner-facing public surface，收敛跨 owner 深层导入。
4. 在不改变业务行为的前提下迁移物理代码。
5. 只有真实安装、启停或 transport 需求出现时才增加 Runtime Manifest、dispatcher 或 guard。

## 人类与 AIGC 验收

每个 capability 必须让读者无需查看 runtime 图就能回答：它提供什么功能、拥有什么、修改应落在哪里。静态检查负责
验证已确认结论的一致性，不能代替语义判断。工具全部通过但人类无法理解功能地图时，治理仍视为失败。

人类只需要三个入口：`npm run capability:list` 查看组合视图，`npm run capability:docs` 更新投影，
`npm run capability:docs:check` 校验投影。工具不提供按 ownership/runtime/process 拆分的公开参数。
