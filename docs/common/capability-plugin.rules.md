<!-- docs/common/capability-plugin.rules.md -->

Purpose: Define stable capability plugin boundaries, runtime semantics, and follow-up guardrails.
Read when: You are adding, reviewing, or refactoring capability manifests, capability runtime, dispatcher / bus usage, session contributions, or capability-aware GraphQL / Worker integration.
Do not read when: You are only changing a normal same-domain usecase or module with no capability manifest, runtime state, or transport involvement.
Source of truth: This file defines stable capability plugin rules. Historical direction and archived plans do not override this file.

# Capability Plugin 规则

## 定位

- Capability plugin 是对既有 bounded context / domain 切分的加固，不是新增一套替代分层。
- 本项目的基础分层仍是 `adapters -> usecases -> modules -> infrastructure`。
- Capability 的边界与现有 docs 中的 bounded context 对齐；一个 capability 是某个 bounded context 的能力化表达。
- `platform.account` / `platform.auth` 属于底座只读声明，不做可选插件，不参与 enable state 状态机。
- 业务语义优先留在 business capability；底座能力只保留所有项目都需要的少量基础能力。
- 基线只提供通用插拔语义，不把具体业务项目的专用模块、身份、岗位或资源口径内置为通用抽象。

## 分层边界

- Adapter 仍只解析协议输入、调用 usecase、映射输出。
- Adapter 不得把 capability dispatcher 当成 resolver / controller 的通用替代入口。
- Usecase 仍持有业务流程、写语义、事务边界、权限组合和跨域协调。
- Modules 仍只提供同域可复用服务、QueryService、repository / entity 封装和 DI 组装。
- Infrastructure 只实现 runtime、transport、SDK、HTTP、queue、config、logger、Redis、database 等外部或运行时能力。
- Capability manifest 由 owner capability 持有；registry / discovery / bootstrap check 属于 infrastructure runtime。
- Infrastructure registry 不得静态 import `src/modules/**` 或 `src/usecases/**` 的 manifest。
- Modules 贡献 manifest、provider binding、queue binding 或 session contribution 时，不得反向依赖 runtime registry 实现。
- Manifest provider 文件应避免 import 副作用；不得在 manifest 声明文件内启动 Nest 容器、连接外部资源、读取业务数据或执行运行时 I/O。
- `modules/common` 不得因为 capability 化变成所有共享业务能力集中目录；可按域拆出的技术或业务能力应迁入对应 capability。

## Dispatcher / Bus

- Dispatcher / bus 是 usecase-owned runtime boundary，不是新的业务编排模型。
- Dispatcher 只用于 usecase 编排中的跨 capability 协作，或平台底座调度 capability operation。
- 同一 capability 内部的 usecase -> module service / QueryService 调用不需要 envelope 化。
- 现有跨域流程不会因为 capability 化自动改写为 dispatcher 调用。
- 只有当目标能力需要可选安装、启停、跨进程 transport、统一错误、权限或 context 治理时，才引入 bus / envelope。
- Dispatcher 不得用于规避跨域 usecase 依赖限制、同域 usecase 一层依赖限制或 Flow Usecase 拆分要求。
- 多个独立写语义仍必须回到具体 usecase / Flow Usecase，不能藏进 dispatcher、registry 或 handler。
- Dispatcher 不持有业务事务。
- 跨 capability command 默认不继承调用方 `TransactionRunner` 事务；不要假设 target capability 写入会随调用方事务回滚。
- 跨 capability 写默认使用独立事务边界，通过幂等、补偿、状态机、审计记录和最终一致处理一致性。

## Runtime State

- 当前启停状态分为安装态、部署态、运行态和 kill switch。
- 安装态来自代码是否进入项目；部署态来自 manifest / env / process 装配；运行态和 kill switch 来自平台配置或健康降级通道。
- 启停状态不得写入业务数据库。
- `platform.*` 在依赖校验中恒视为 enabled。
- 运行态关闭 capability 或 operation 时返回统一 capability error，不删除能力数据。
- GraphQL code-first schema 必须保持一致；能力关闭时不动态摘 resolver，而是由 guard / resolver helper 返回 `CAPABILITY_DISABLED` 或 `CAPABILITY_OPERATION_DISABLED`。
- 健康检查失败不自动等同 disabled；是否触发 kill switch 由单独策略决定。
- Runtime state reader 和 permission checker 的配置读取可先热读；若未来加入 cache，必须先定义刷新 / 失效语义。
- Capability id 清单必须从 manifest 生成或通过 registry / CLI 观察，不得手写维护为第二真源。
- 本地查看当前能力时使用 `npm run capability:list`；需要 markdown 快照时使用 `npm run capability:docs` 生成 `docs/generated/capabilities-current.md`。
- 可用 `npm run capability:docs:check` 校验 generated capability 文档是否与 manifest 同步。

## Transport

- 当前只支持单体内 in-process 调用和 BullMQ queue transport。
- 不引入远程 microservice transport；只有真实出现独立部署边界且 BullMQ 不能满足需求时，再评估 `@nestjs/microservices` adapter。
- in-process transport 只能调用当前进程已装配的 operation。
- 跨进程 capability 协作必须走 queue transport 或后续 remote transport，不走 in-process。
- Queue transport 的业务入口仍发送 `CapabilityCommand` / `CapabilityEvent` envelope；低层 enqueue input 只属于 transport 内部结构。
- `capability + operation + operationKind` 通过 manifest / registry 映射到现有 `queueName + jobName`。
- `queueName + jobName` 继续使用 BullMQ registry 真源，不强行改为 capability id。
- BullMQ job data 必须包含序列化 envelope，至少保留 `capability`、`operation`、`operationKind`、`context`、`idempotencyKey`、`dedupKey`、`payload` 和 `createdAt`。
- `traceId` / `requestId` 来自 envelope context；BullMQ `jobId` 不得替代 trace。
- `dedupKey` 表达业务或队列去重目标；映射为 `jobId`、BullMQ dedup option 或不映射时，必须由 queue binding 策略显式声明。
- Worker adapter 从 job data 恢复 envelope，并用 envelope context 初始化 `CapabilityRequestContextStore`。
- Worker adapter 只做 queue runtime 适配；业务执行仍由 usecase-owned boundary 或具体 usecase 承接。

## Event

- Event 用于发布事实或异步副作用，不用于获取同步业务结果。
- 发布方不等待所有业务副作用完成；需要同步结果时应使用 command。
- in-process event 默认 fire-and-forget，只保证派发一次。
- in-process subscriber 失败不得冒泡给发布方；当前至少要结构化记录。
- 需要可靠重试、延迟、削峰或跨进程消费的 event，应声明走 queue transport 或后续可靠事件通道。
- `CapabilityEvent.eventId` 由发布方生成并全局唯一，用于订阅方幂等；`idempotencyKey` 保留给 command 调用幂等。
- `CapabilityEventHandler` 是 operation handler 体系中 event 类型的特化；`CapabilityEventSubscriber` 是 event bus 消费侧注册点。两者属于不同注册路径。

## Session / Permission

- Session context builder 属于平台底座的 usecase-owned runtime boundary。
- Adapter、guard 或 middleware 可以通过 session context builder 建立 `CapabilityRequestContext` / `CapabilityActorContext`，然后继续调用 usecase。
- `CapabilityEntryPoint` 表示请求进入系统的运行面，当前基线只使用 `graphql-api` 和 `worker`。
- Capability entryPoint 不等于 JWT audience；adapter 不得把 JWT `aud` claim 直接当作 capability entryPoint。
- `principalCodes` 和 `authorityClaims` 是全局 code 集合；permission checker 可按全局 code 匹配，不按 capability 局部命名空间区分。
- Capability 贡献 principal 或 authority claim 时，code 必须可全局识别，避免不同 capability 生成同名但不同义的 code。
- authority claim 可先进入 `CapabilityRequestContext`，不要求写入 JWT。
- 既有 guard 可继续依赖当前 JWT 字段做粗准入；具体资源 scope 裁剪仍由 owner capability 的 authorizer 在 usecase 内完成。
- Operation 级 `requiredPermissions` 优先；permission manifest 只做声明、启动对账和后端权限派生真源。
- 前端菜单、功能点和可见性配置可以从后端权限信息派生，但不应和后端 capability manifest 共用同一份声明文件。

## API Surface / Data Resource

- Capability API surface 声明用于启动校验、权限对账和文档派生；不改变 adapters 层归属。
- GraphQL resolver 仍属于 adapters 层；manifest 不允许让 modules 或 capability package 反向拥有 adapter 实现。
- GraphQL code-first 对账应由 API adapter / bootstrap 在 schema 构建完成后读取实际 schema operation，再与 manifest 对账。
- `readShared` 只表达数据资源的共享读取声明，不代表其他 capability 可以绕过 owner 的 Query operation 直接跨 capability 读表。
- 跨 capability 读取优先通过 owner 的 Query operation。
- 若确实需要同进程模块级共享读取，必须单独写清读口径、权限和依赖方向。
- `resourceClaims.relation = owns` 的 owner 必须是当前 capability。
- `resourceClaims.relation = dependsOn | contributes` 指向其他 capability 时，当前 manifest 必须声明对应 dependency。
- `contributes` 表示向资源贡献内容或配置，但不拥有写权；owner 字段指向真正拥有该资源的 capability。

## Error

- Capability 边界错误应归一化为 `CapabilityError` / `CapabilityResult`。
- Capability 内部仍可使用 `DomainError`，但跨 capability 边界必须折叠为稳定 capability error 结构。
- Handler 负责把自身调用到的 usecase / module service / provider 错误折叠为 `CapabilityError`，因为 handler 最了解 operation 语义。
- Dispatcher 负责补齐 capability id、operation、transport、timeout、permission 等 runtime 错误上下文。
- Adapter 负责把 capability error 映射到现有 GraphQL / HTTP / Worker error contract。
- GraphQL 的 `extensions.code` 仍保持稳定分类；能力内部细节只能作为受控 detail / debug 信息。
- `DomainError.code` 不成为第二套 capability 业务错误码真源；需要保留时放入 `causeCode` 或受控 `details`。

## Followup

- 未完成的 runtime cache、event audit、queue policy、health / kill switch 联动、真实 business capability pilot 等事项只在 `plans/capability-plugin-followup.md` 跟踪。
- `plans/capability-plugin-direction.md` 只保留方向判断和背景价值，不覆盖本规则。
