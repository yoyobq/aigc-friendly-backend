<!-- 文件位置: plans/capability-plugin-direction.md -->

# Capability Plugin Direction

## 目标

为本项目后续“能力插拔”建立方向判断和接口草案。

本方向不以拆独立服务为目标。当前目标是让能力可以被声明、装配、启停、依赖校验，并在 API / Worker 两个进程中按需拥有不同运行面。

统一通信底座是能力插拔的实现组成部分，用来表达同进程调用、API 入队到 Worker 和可靠异步任务。独立部署形态不是当前方向的语义中心。

本文不是稳定规则。等接口模型被实现验证后，再把稳定部分沉淀到 `docs/` 中。

## 语义校准

本文不使用“微服务”描述当前目标，避免把能力插拔误读成独立部署、RPC、拆库或外部服务治理。

- 能力插拔：当前目标。关注 capability 如何声明、装配、启停、校验和在 API / Worker 进程中运行。
- 运行拓扑：当前需要表达的部署内结构。一个 capability 可以在 API 进程提供入口，在 Worker 进程提供 processor / subscriber / background handler。
- Transport：能力运行面之间的通信方式。当前只讨论 in-process 和 BullMQ queue。
- 独立服务：仅当某个 capability 被独立部署并通过网络或 broker 作为自治服务调用时才成立。它不是本文默认前提。

## 核心判断

采用“平台底座 + 可插拔 Capability”的模型。

- 平台底座保留为内建能力，不做插件化。
- 技术型能力与业务语义型能力统一纳入 `Capability` 体系。
- 统一的是能力接入协议、注册、启停、配置、权限、事件和通信 envelope。
- 不强制技术 provider 与业务模块拥有相同内部结构；它们只是共享同一套能力生命周期。
- 当前阶段只设计 in-process 调用与 BullMQ queue transport；不为 future remote transport 预先展开复杂结构。

## 术语

- Platform：平台底座。所有项目默认具备，提供身份、认证、权限、事务、日志、配置、错误、队列、审计和通信底座。
- Capability：可选能力。可以是技术 provider，也可以是完整业务能力包。
- Technical Capability：技术型能力，通常适配外部系统或运行时能力。
- Business Capability：业务语义型能力，拥有项目或行业业务口径。其边界默认与现有 docs 中的 bounded context 对齐；Capability 是 bounded context 的能力化装配面，不是新的域边界。
- Operation：能力对外声明的操作，包括 command、query、event。
- Command：改变状态或触发副作用的请求。
- Query：读取状态或计算视图的请求。
- Event：事实通知，表达已经发生的事情。
- Session Principal：能力贡献的正式会话主体类型，例如某类用户、成员、客户、员工或其他可登录 / 可切换 / 可展示的主体。平台只理解稳定 code、会话投影和 identity resolver，不内置具体主体语义。
- Session Authority Claim：能力贡献的会话授权摘要类型，例如某类岗位、职责、组织关系、项目角色或资源管理资格。平台只负责收集、投影、启停和对账；最终 scope 裁剪和授权判断仍由 owner capability 的 policy / authorizer 决定。
- Envelope：统一通信外壳，承载 trace、actor、entryPoint、幂等和 payload。
- Transport：通信实现。当前只纳入 in-process 与 queue。
- Contribution：能力向宿主进程声明的装配需求，例如 API surface、worker handler、provider binding、queue 声明。声明不改变实际代码的 layer 归属。

## 平台底座

平台底座是所有项目默认具备、所有能力都可以依赖的基础能力。

当前判断应保留在底座中：

- 配置、日志、错误结构、GraphQL 错误映射
- 数据库连接、事务、Redis、队列基础设施
- `accountId`、账号状态、基础 session principal 机制，以及当前项目的 accessGroup 兼容投影
- 认证、JWT/session/current user
- 基础权限与可见性策略
- 异步任务审计、traceId、dedupKey、idempotency key 语义
- capability command / query / event 的通信 envelope

底座可以被业务能力依赖；底座不得依赖具体业务能力，例如 `crm`、`order`、`content`。

`platform.account` 只保留 base account、access/session 机制和底座权限能力。具体业务身份子域不应长期沉入 account 底座；它们应作为 owner capability 贡献的 session principal / authority claim 接入。既有项目可以先保留现有目录和 module 装配，但迁移目标是由业务能力持有 manifest、identity resolver、summary resolver 和 scope authorizer，避免 account 继续膨胀成“所有身份”的集中目录。

平台底座也可以在 registry 中以 `platform.*` 形式做只读声明，便于表达依赖关系；但这类声明不是可关闭插件。

## Capability 类型

Capability 分为两类，但共享同一套注册和通信模型。

### Technical Capability

技术型能力主要适配外部系统或运行时资源。

候选：

- `ai.openai`
- `ai.qwen`
- `notification.email`
- `third-party-auth.weapp`
- `storage.s3`
- `payment.stripe`

这类能力通常包含 provider、配置、健康检查、限流、重试、kill switch，不一定拥有业务表或 GraphQL 入口。

### Business Capability

业务语义型能力承载具体项目或行业口径。

候选：

- `crm`
- `order`
- `membership`
- `content`

这类能力可以包含 entity、migration、module service、QueryService、usecase、GraphQL API surface、worker handler、权限声明和事件处理。实际文件仍按 adapters / usecases / modules / infrastructure 分层放置。

业务能力可以依赖平台底座；不得把自身语义反向写入平台底座。例如业务能力中的客户、订单、内容等概念应归业务能力自身拥有，而不是扩散到 account/auth 底座中。

## 设计原则

- 先定义边界，再选择通信方式。
- 先支持单体内 in-process adapter 与 BullMQ queue transport。
- 共享数据库不是问题；问题是共享写所有权。
- 能力之间不共享 ORM Entity、Repository、QueryBuilder。
- 能力之间通过 command、query、event 或底座提供的稳定查询口径协作。
- Adapter -> Usecase 的现有调用语义不变；Capability dispatcher 不是 adapter 的替代。
- 同一 capability 内部的 usecase -> module service / QueryService 调用不需要 envelope 化。
- Capability dispatcher 只用于 usecase 编排中的跨 capability 协作，或平台底座调度能力操作。
- Capability dispatcher 不改变 usecase 依赖规则：不得用它规避“跨域 usecase 依赖禁止”“同域 usecase 依赖只允许一层”“多独立写语义需要 Flow Usecase”的既有约束。
- 跨能力写操作默认不使用分布式事务。
- 跨能力 command 默认不继承调用方 `TransactionRunner` 事务；不要假设 target capability 写入会随调用方事务回滚。
- 需要一致性时优先用幂等、状态机、补偿、审计记录和最终一致。
- API 入口、Worker 入口、队列声明和外部 provider 都应能被能力启停控制。
- 运行态关闭能力时，返回统一错误，不删除能力数据。
- 底座能力保持稳定和少量；业务语义优先留在 business capability 中。
- 基线只提供通用插拔语义，不内置具体业务样本的专用抽象。具体行业、外部系统、业务对象、工作流、产物模板等语义只应出现在具体 capability manifest、module factory、handler 或 usecase 中。

## 与现有分层的落点

Capability 不是新 layer。它是跨能力通信与装配的模式，必须落在现有分层规则内。

Capability 也不是 `src/modules/common` 的同义词。一个 business capability 是跨 adapters、usecases、modules、infrastructure 的逻辑切片；落地文件仍放在各自 layer 中，依赖方向仍服从现有规则。

Business capability 默认不跨越多个 bounded context 打包，也不把多个既有域强行合成一个新域。若 capability 边界与现有 bounded context / usecase / modules 规则发生冲突，现有域边界和层级规则优先。

Technical capability 可以是 provider binding、runtime binding 或外部系统适配能力，不必等同于业务 bounded context；但它仍必须有明确 owner，且不得突破现有层级与依赖规则。

### Usecase / Flow Usecase

Capability 不放宽 `docs/common/usecase.rules.md` 与 `docs/common/usecase-write-flow-boundaries.rules.md` 的边界。

- Adapter 仍只解析协议输入、调用 usecase、映射输出。
- 普通 modules(service) 仍只提供同域 service / QueryService / 细粒度写入口，不做跨 bounded context 编排。
- 跨 bounded context 读必须由上层 usecase 发起。若通过 capability query bus 读取，本质上也是调用目标 capability 的 query operation；目标 handler 应落回目标域 QueryService 或只读 usecase，不得让调用方绕过读侧所有权。
- 跨 bounded context 写必须由上层 usecase 或 Flow Usecase 显式编排。若通过 capability command bus 触发，本质上也是一次跨能力写协作，调用方 usecase 必须明确一致性、失败、补偿、审计或重试策略。
- 当流程包含多个独立写语义时，不得把这些步骤隐藏在一个 dispatcher 调用里；应拆分为多个 usecase，再由上层 Flow Usecase 编排。
- `usecases -> usecases` 仍只允许同域、一层、编排型依赖；Capability bus 不应成为跨域 usecase 依赖的替代捷径。
- 不允许为了复用某个 service 而绕道调用另一个 capability 的 usecase 或 handler。需要同域复用时下沉为 modules(service)；需要跨域协作时通过明确 operation 表达。
- Worker 场景仍遵守 worker adapter / worker usecase 规则：worker adapter 不透传 BullMQ 原始对象给 usecase，worker usecase 持有生命周期编排、失败落库和审计语义。

### Types

纯框架无关、跨层稳定的通信契约最终可以进入 `src/types`，通过 `@app-types/*` 引用。

但首个实现阶段不应一次性把所有 Capability 草案类型上收到 `src/types`。按 `docs/common/type.rules.md`，只有稳定且跨 2 个及以上 bounded context 复用的类型才进入 `src/types`。在能力底座尚未落地前，接口草案先保留在 plan 或实现局部；实现时只上收最小且已被实际跨层依赖的稳定子集。

候选：

- `CapabilityId`
- `CapabilityKind`
- `CapabilityProcess`
- `CapabilityManifest` 及其子类型
- `CapabilityActorContext`
- `CapabilityRequestContext`
- `CapabilityEnvelope`
- `CapabilityResult`
- `CapabilityError`
- `CapabilityErrorCode`

建议文件：

```text
src/types/common/capability.types.ts
```

该文件是稳定后的目标位置，不是首个 plan 的强制落点。该文件不得 import Nest、TypeORM、GraphQL、core 或具体 capability 实现。

### Boundary Contracts

带有 DI token、运行时调度能力或可替换实现的接口不放进 `src/types`。

建议：

- `CapabilityCommandBus` / `CapabilityQueryBus` / `CapabilityEventBus`
  归 usecase-owned boundary contract。
- `CapabilityDispatcher` 可作为 infrastructure 内部组合 facade 或少量平台装配入口；业务 usecase 默认只注入自己需要的 bus，避免无谓依赖 command/query/event 全能力。它是运行时调度 boundary，不是业务编排 boundary。
- `CapabilityTransport` / `CapabilityTransportRegistry` 若被 usecase bus / dispatcher 调用，归 usecase-owned boundary contract，由 infrastructure 实现具体 transport。
- `CapabilityRegistry` 若仅用于启动装配和运行状态查询，可作为平台底座模块的 module-owned contract；若被 usecase 编排直接依赖，应放入 usecase-owned contract。不要为 capability 另建独立的 platform contract layer。

首个实现如果只做 manifest 收集、启动对账和运行状态查询，不应为了对齐文件示例而强行把 `CapabilityRegistry` 放进 `src/usecases/common/ports`。只有当业务 usecase 需要直接依赖 registry 查询或编排时，才提取 usecase-owned narrow contract。

建议文件形态：

```text
src/usecases/common/ports/capability-command-bus.contract.ts
src/usecases/common/ports/capability-query-bus.contract.ts
src/usecases/common/ports/capability-event-bus.contract.ts
src/usecases/common/ports/capability-registry.contract.ts
```

是否拆分为多个 contract，取决于落地时是否存在独立替换实现。

实现归属应复用 `TransactionRunner` 模式：

- usecase 层只持有 contract 和 DI token。
- infrastructure 提供 in-process dispatcher、registry、transport、AsyncLocalStorage context store 和 Nest Discovery 收集实现。
- modules 不承载跨 capability dispatcher / registry 的平台实现，只暴露自身 capability 需要被注册的 manifest、handler 或 provider。

### Manifest 常量

稳定后，Manifest 的类型可以来自 `@app-types/common/capability.types`；首个实现也可以先使用能力底座局部类型。无论类型真源在哪里，manifest 常量都由能力拥有方持有。

- Manifest 真源建议使用 TS 常量，不以 JSON 文件作为主要声明源。
- JSON 可以作为文档、管理面板或外部系统消费的生成物。
- 选择 TS 常量的原因是 manifest、operation descriptor 和 handler 注册需要在同一编译期尽量被类型系统约束。
- Business capability 的 manifest 放在该业务能力包内。
- Technical capability 的 manifest 放在对应 technical capability 包内。
- 平台底座的 `platform.*` manifest 只用于依赖声明和自描述，不参与可关闭插件流程。

### Handler

Capability handler 不是新的业务编排层。

- Business operation handler 默认归 usecase 层，因为它要调用 usecase 或 modules QueryService，且不能让 modules 反向依赖 usecases。
- Business command handler 应调用对应 usecase 或 Flow Usecase，由 usecase 继续持有写语义、事务、权限组合、补偿和审计策略。
- Business query handler 应调用对应 usecase 或 QueryService 入口，不能直接返回 ORM Entity，也不能绕过 owner bounded context 的读侧口径。
- Handler 不做跨步骤业务流程拆分，也不承担多个独立写语义的编排；这种场景必须回到 Flow Usecase。
- Technical handler 若位于 usecase / modules 层，只能调用 layer-owned provider contract、module-owned contract 或注入 token，不得静态 import infrastructure adapter。外部 SDK / HTTP / I/O 的具体实现仍落 infrastructure，并通过 DI 绑定到 contract。
- 只有 infrastructure-local adapter / provider implementation 可以直接调用 SDK、HTTP client 或其他 I/O runtime。
- Adapter 不应直接调用 handler。

### modules/common

`src/modules/common` 只保留真正跨 capability 的通用能力。

这不意味着 capability 化后要把 `modules/common` 抽空。按当前 `modules.rules.md`，`modules/common` 仍适合承载稳定、横切、非业务专属的通用封装，例如密码/安全辅助、分页、队列网关、通用 provider registry、通用 worker registry、邮件发送抽象等。

如果 `modules/common` 中某个目录已经混入明确业务语义，后续 capability 化时应重新判断：

- 属于平台底座的，保留为 platform common。
- 属于 technical capability 的，迁入对应 technical capability。
- 属于 business capability 的，迁入对应 business capability。

`modules/common` 不得因为 capability 化而变成新的“所有共享业务能力”集中目录，也不得把业务域目录直接作为 `common` 的子目录或别名镜像。

业务项目回投到基线时，`modules/common` 瘦身应和 capability 化同步推进，优先级建议：

- AI queue / worker / provider registry 先归入 `ai.*` technical capability，这是首个落地点。
- Email dispatch / delivery worker 归入 `notification.email` technical capability；email verification 若只表达邮件通道策略，可接入该 technical capability，若表达验证流程决策，应留在 platform verification 或 owner flow 中。
- Password、security、tokens 等认证安全基础设施保留为 platform common。
- Invite / onboarding 只有在不含具体业务对象语义时才保留为 platform common；一旦绑定某类业务身份、组织或流程，应迁回 owner capability。
- `utils` 不作为长期归宿；能归属明确 capability 的分散回 owner，真正无业务语义的工具才保留。

### Physical Placement

首个实现不新增 `src/capabilities` 这类独立物理层。Capability 是逻辑切片，文件继续按现有 layer 放置。

建议：

- Manifest 常量放在拥有该能力声明的现有目录中，并通过 Nest provider / Discovery 注册，不让 infrastructure 静态 import 上层实现。
- Technical capability manifest 可先放在现有 technical/common 能力目录，例如 `src/modules/common/ai-worker/ai-provider.capability.manifest.ts`。
- Business capability manifest 可先放在对应 usecase 目录，例如 `src/usecases/<domain>/<domain>.capability.manifest.ts`，因为跨能力 command/query/event 编排由 usecase 拥有。
- Business operation handler 放在 usecase 层，例如 `src/usecases/<domain>/capability-handlers/*.handler.ts`。
- Technical provider binding handler 放在拥有 provider contract 的 modules/common 或对应 module 目录；如果只是适配外部 SDK，则实现仍落 infrastructure。
- GraphQL resolver / DTO 继续放在 `src/adapters/api/graphql/<domain>/`，只由 adapter 层参与 GraphQL surface 对账。
- `NestCapabilityPackage` 若需要落地，应作为装配模块的 provider/metadata 由 API / Worker bootstrap 汇总，不建立全局 capability package 层。

## Capability ID

Capability ID 是稳定标识，应跨进程、配置、日志、审计和事件保持一致。

建议规则：

- 使用 dot-separated lowercase；段内多词使用 kebab-case。
- 技术型能力使用领域前缀，例如 `ai.openai`、`third-party-auth.weapp`。
- 业务型能力使用业务前缀，例如 `crm`、`order`、`content`。
- 操作名不写进 capability id，操作通过 `operation` 单独表达。
- 不使用部署环境、租户、版本号作为 capability id 的一部分。

```ts
export type CapabilityId = string;

export type CapabilityKind = 'technical' | 'business';

export type CapabilityProcess = 'api' | 'worker';

export type CapabilityEntryPoint =
  | 'graphql-api'
  | 'admin-api'
  | 'worker'
  | 'system-task'
  | 'cron';

export type CapabilityVersion = string;
```

`CapabilityId` 在草案层保持开放字符串，避免用全局 union 提前锁死可安装能力集合。正式实现时应通过两层约束降低拼写风险：

- 每个 capability 导出自己的 literal id 常量，例如 `export const AI_OPENAI_CAPABILITY_ID = 'ai.openai' as const`。
- `defineCapabilityManifest()` 或 registry bootstrap 对 id 格式、重复 id、依赖 id 是否存在做运行时校验。

不建议使用 `` `platform.${string}` | `ai.${string}` | string `` 这类类型；只要包含 `string`，模板约束就会被抹平。

`platform.*` 是逻辑能力 id，不直接等同于 Nest module class 名。映射关系由 manifest 或装配模块表达，例如 `platform.account` 可以映射到当前 `AccountModule` / account usecase 组合，`platform.auth` 可以映射到 auth/session 相关装配。

## Capability Manifest

Manifest 是能力的声明面，只描述能力“是什么”和“声明需要什么装配”，不承载业务流程。

实现时应按“核心 manifest + 扩展声明”理解，避免每个 capability 都被迫填写一个庞大对象。核心字段只有 `id`、`kind`、`displayName`、`version`、`processes`；operations、permissions、data、contributions、runtime 都是可选扩展片段。

```ts
export interface CapabilityCoreManifest {
  readonly id: CapabilityId;
  readonly kind: CapabilityKind;
  readonly displayName: string;
  readonly version: CapabilityVersion;
  readonly description?: string;

  /**
   * 能力会在哪些进程中装配。
   * api: GraphQL / HTTP 入口。
   * worker: BullMQ / 消费者 / 后台任务。
   */
  readonly processes: readonly CapabilityProcess[];
}

export interface CapabilityManifest extends CapabilityCoreManifest {
  /**
   * 当前能力依赖的其他能力。
   * 这里只表达能力依赖，不表达具体 provider class。
   */
  readonly dependsOn?: readonly CapabilityDependency[];

  /**
   * 配置声明。用于启动时校验、文档生成和缺失配置报错。
   */
  readonly config?: readonly CapabilityConfigDefinition[];

  /**
   * 能力对外声明的操作。
   */
  readonly operations?: CapabilityOperationManifest;

  /**
   * 能力声明的权限。
   */
  readonly permissions?: readonly CapabilityPermissionDefinition[];

  /**
   * 能力拥有的数据资源。
   */
  readonly data?: CapabilityDataManifest;

  /**
   * 能力拥有或依赖的非数据资源声明。
   */
  readonly resourceClaims?: CapabilityResourceClaimManifest;

  /**
   * 能力向宿主进程贡献的装配项。
   */
  readonly contributions?: CapabilityContributionManifest;

  /**
   * 健康检查、熔断和 kill switch 声明。
   */
  readonly runtime?: CapabilityRuntimeManifest;
}
```

### Dependency

```ts
export interface CapabilityDependency {
  readonly capabilityId: CapabilityId;

  /**
   * required: 依赖未启用时，本能力不能启用。
   * optional: 依赖未启用时，本能力可降级运行。
   */
  readonly mode: 'required' | 'optional';

  /**
   * 依赖能力需要提供的 operation 或 contract。
   * 用于启动时校验。
   */
  readonly requires?: readonly string[];
}
```

### Config

```ts
export interface CapabilityConfigDefinition {
  readonly key: string;
  readonly required: boolean;
  readonly secret?: boolean;
  readonly defaultValue?: string | number | boolean;
  readonly description?: string;

  /**
   * 部署态启用时才必须存在的配置。
   */
  readonly requiredWhenEnabled?: boolean;
}
```

### Operations

```ts
export interface CapabilityOperationManifest {
  readonly commands?: readonly CommandDefinition[];
  readonly queries?: readonly QueryDefinition[];
  readonly events?: readonly EventDefinition[];
}

export type CapabilityOperationKind = 'command' | 'query' | 'event';

export interface OperationDefinition {
  readonly name: string;
  readonly description?: string;
  readonly version?: string;
  readonly enabledByDefault?: boolean;
  readonly requiredPermissions?: readonly string[];
  readonly idempotency?: OperationIdempotencyPolicy;
  readonly timeoutMs?: number;
}

export interface CommandDefinition extends OperationDefinition {
  readonly kind: 'command';
  readonly sideEffects: 'none' | 'internal' | 'external';
}

export interface QueryDefinition extends OperationDefinition {
  readonly kind: 'query';
  readonly cache?: OperationCachePolicy;
}

export interface EventDefinition extends OperationDefinition {
  readonly kind: 'event';

  /**
   * fact: 已发生事实，消费者不得反向要求发布方回滚。
   * signal: 通知信号，可用于触发后续处理。
   */
  readonly eventType: 'fact' | 'signal';
}

export interface OperationIdempotencyPolicy {
  readonly required: boolean;

  /**
   * request: 同一次请求的幂等。
   * business: 业务目标的幂等，例如同一个订单只支付一次。
   * queue: 队列 dedup。
   */
  readonly scope: 'request' | 'business' | 'queue';
}

export interface OperationCachePolicy {
  readonly cacheable: boolean;
  readonly ttlMs?: number;
}
```

底座级 `OperationDefinition.name` 保持 `string`，因为 registry 不能提前知道所有可安装 capability 的 operation。具体 capability 应导出 operation literal 常量或 union，并用 `satisfies` / `defineCapabilityManifest()` 在 manifest 常量处保留编译期约束；不要把具体 operation union 上收到全局 `src/types` 基类。

`timeoutMs` 默认由 dispatcher / transport 做 wall-clock 超时折叠，返回 `CAPABILITY_TIMEOUT`。这不保证底层 provider 调用、HTTP 请求或队列任务会被真正取消；需要取消语义的 provider / handler 应在自身边界使用 `AbortSignal` 或对应 SDK 的取消能力。`AbortSignal` 不进入 envelope，也不序列化进 queue job；queue transport 需要取消语义时，由 Worker 侧按 job/operation policy 创建本地 signal。

### Permission

```ts
export interface CapabilityPermissionDefinition {
  readonly key: string;
  readonly description?: string;
  readonly defaultRoles?: readonly string[];
  readonly exposedToClient?: boolean;
}
```

`OperationDefinition.requiredPermissions` 是 operation 执行时的权限要求真源。`CapabilityPermissionDefinition` 负责声明权限目录、默认角色建议、文档和前端可见性。若二者出现不一致，operation 级 `requiredPermissions` 优先；启动对账应提示 operation 引用了未在 permission manifest 声明的 permission key。

### Data Ownership / Resource Claims

数据所有权与非数据资源声明分开表达。

- `data` 只描述数据库表、视图和 migration 归属。
- `resourceClaims` 描述队列、缓存、外部资源、产物、授权资源等非数据资源归属或依赖。
- 两者都只做 ownership / dependency 声明，不承载业务流程，也不改变实际代码的 layer 归属。

```ts
export interface CapabilityDataManifest {
  /**
   * 能力拥有的数据库表或视图。
   * 共享数据库下，ownership 仍必须清楚。
   */
  readonly resources?: readonly CapabilityDataResourceClaim[];

  /**
   * migration 声明只表达能力与迁移的归属关系。
   * 当前阶段不由 manifest 驱动 migration 执行。
   */
  readonly migrations?: readonly CapabilityMigrationDefinition[];
}

export interface CapabilityDataResourceClaim {
  readonly name: string;
  readonly kind: 'table' | 'view';
  readonly owner: CapabilityId;
  readonly readShared?: boolean;
  readonly writeOwnerOnly: boolean;
}

export interface CapabilityResourceClaimManifest {
  readonly claims?: readonly CapabilityResourceClaim[];
}

export interface CapabilityResourceClaim {
  readonly name: string;
  readonly kind:
    | 'queue'
    | 'cache'
    | 'externalResource'
    | 'artifact'
    | 'authorizationResource';
  readonly owner: CapabilityId;
  readonly relation: 'owns' | 'dependsOn' | 'contributes';
}

export interface CapabilityMigrationDefinition {
  readonly id: string;
  readonly description?: string;
  readonly irreversible?: boolean;
}
```

`readShared` 只表达数据资源的共享读取声明，不代表其他 capability 可以绕过 owner 的 Query operation 直接跨 capability 读表。跨 capability 读取仍优先通过 owner 的 Query operation；若确实需要同进程模块级共享读取，必须在后续 plan 中把读口径、权限和依赖方向单独写清楚。

`resourceClaims` 中的 `queue` 只表达资源 ownership / dependency，例如谁拥有这个队列语义、谁依赖该队列。`contributions.queues` 表达运行时装配，例如哪些 job、handler、并发、限流和关闭策略需要挂到当前进程。两者可以指向同一个队列名，但职责不同。

`CapabilityResourceClaim.relation` 的含义：

- `owns`：当前 capability 拥有该资源的写语义与生命周期；`owner` 应指向当前 capability。
- `dependsOn`：当前 capability 依赖另一个 capability 拥有的资源；`owner` 指向资源 owner。
- `contributes`：当前 capability 向另一个 capability 拥有的资源贡献配置、内容、扩展点或运行时绑定，但不拥有该资源的写语义；`owner` 指向资源 owner。

`externalResource`、`artifact`、`authorizationResource` 只表达通用资源 claim，不内置具体业务或行业语义：

- `externalResource`：能力依赖或拥有的外部系统连接、第三方 API、SDK 资源或外部数据源。具体系统名称、登录策略、payload codec、限流规则由该 capability 自己的 module factory / provider / config 声明。
- `artifact`：能力拥有的模板、静态资产、生成文件、导入文件、下载产物或转换产物。具体格式、TTL、大小限制、存储实现由该 capability 自己声明。
- `authorizationResource`：能力贡献的权限作用域资源。基线只理解“这是授权资源”，不内置具体资源枚举。

### Contributions

Contribution 描述能力要向 API / Worker / DI 容器声明什么装配需求。

Contribution 必须保持通用，不把现实项目中的具体能力类别固化为基线接口。判断标准：

- 平台需要统一启停、启动对账、权限对账、健康检查、运行时绑定或审计的，才进入通用 contribution。
- 只属于某个业务场景的字段，留在该 capability 的本地 manifest extension、module options、handler 或 usecase 中。
- 当两个以上不同 capability 反复出现相同装配语义，再考虑提升为通用 contribution。

建议把能力声明面按概念理解为几组，其中真正需要进程装配的部分再落入 `contributions`：

- `operations`：能力对外可调用的 command / query / event。
- `apiSurfaces`：GraphQL、HTTP、二进制下载、multipart 上传等入口声明。
- `runtimeBindings`：queue job、worker processor、flow handler、background task 等运行时绑定。
- `providerBindings`：DI token、provider registry、外部 SDK adapter 绑定。
- `session.principals`：能力贡献的正式会话主体类型及其 identity resolver。
- `session.authorityClaims`：能力贡献的会话授权摘要类型及其 scope authorizer / summary resolver。
- `data` / `resourceClaims`：表、视图、队列、缓存、外部资源、产物、授权资源等 ownership / dependency 声明。

Session contribution 只表达“能力向会话系统贡献什么”。平台底座不内置具体主体或授权摘要语义，也不直接理解业务事实表。当前项目已有 `accessGroup` 会话字段，可作为 session principal 的兼容投影；当前没有既有 authority claim 投影字段。首个实现可以先不把 authority claim 投影进 JWT / session，只做 resolver 注册和启动对账；若需要会话摘要，再新增显式会话字段承载投影。通用 capability 接口不以具体项目字段命名。

authority claim 不投影进 JWT 不表示请求生命周期内不可用。首个实现可以由 session context builder 把解析出的 principal / authority claim 写入 `CapabilityRequestContextStore`，供 capability-aware guard、dispatcher 和 usecase 读取。既有 guard 可继续依赖当前 JWT 字段做粗准入；需要具体资源 scope 裁剪时，仍由 owner capability 的 authorizer 在 usecase 内完成。

Session principal 贡献正式会话主体。它适合表达“这个账号可以以某种主体身份进入系统”，并由 capability 提供 identity resolver。平台只处理 code、启停、会话投影和对账；主体资料、注册、绑定、状态流转和业务权限仍由 owner capability 拥有。

Session authority claim 贡献会话授权摘要。它适合表达“这个账号当前具备某类增量授权资格”。Claim 命中只作为入口摘要或粗准入信号，不代表最终资源 scope；需要按具体业务资源裁剪时，必须调用 owner capability 的 policy / authorizer 或读取 owner capability 的事实源。

API contribution 不表示 capability 的 modules/usecases 目录可以持有 GraphQL resolver。GraphQL resolver、DTO、schema enum/scalar 注册仍归 adapters 层；manifest 只声明需要暴露的 API surface，用于启动校验、文档生成、权限/启停 guard 对账和进程装配。Adapter 层仍然只调用 usecase，不直接依赖 modules(service) 或 infrastructure 运行时值。

GraphQL code-first 对账应由 API adapter/bootstrap 集成触发。优先在 schema 构建完成后读取实际 schema 中的 query / mutation / subscription operation 名称，再与 manifest 的 `graphqlOperations` 对账；不要让 infrastructure registry 静态 import resolver，也不要依赖 usecase / modules 扫描 GraphQL decorator。

HTTP endpoint 对账同样由 API adapter/bootstrap 集成触发。manifest 只声明 method/path/body kind/response kind/permission 等 surface 信息；实际 controller、interceptor、filter、DTO 或 stream response 仍归 adapters 层。启动期可先做显式注册表对账，后续再评估是否通过 Nest metadata 自动扫描 controller route。

```ts
export interface CapabilityContributionManifest {
  readonly session?: CapabilitySessionContributionManifest;
  readonly api?: CapabilityApiContributionManifest;
  readonly worker?: CapabilityWorkerContributionManifest;
  readonly providers?: readonly CapabilityProviderContribution[];
  readonly queues?: readonly CapabilityQueueContribution[];
}

export interface CapabilitySessionContributionManifest {
  readonly principals?: readonly CapabilitySessionPrincipalContribution[];
  readonly authorityClaims?: readonly CapabilitySessionAuthorityClaimContribution[];
}

export interface CapabilitySessionPrincipalContribution {
  readonly principalCode: string;
  readonly description?: string;
  readonly identityResolver: string;

  /**
   * 当前项目可映射到 accessGroup 等既有会话字段。
   * 基线只要求这是稳定投影名，不内置具体字段语义。
   */
  readonly sessionProjectionKey?: string;

  /**
   * 是否进入登录后的 session identity view，例如当前可用主体 / 身份摘要。
   * 这不等同于把完整主体资料写入 JWT。
   */
  readonly exposedInSessionIdentity?: boolean;
}

export interface CapabilitySessionAuthorityClaimContribution {
  readonly claimCode: string;
  readonly description?: string;

  /**
   * 若引用其他 capability 贡献的 principal，当前 capability 应在 dependsOn 中声明对应依赖。
   */
  readonly subjectPrincipalCode?: string;
  readonly summaryResolver: string;
  readonly scopeAuthorizer?: string;

  /**
   * 是否进入 session authority summary 或项目定义的会话摘要投影。
   * 这只表示摘要可见，不代表最终资源 scope 已授权。
   */
  readonly exposedInSession?: boolean;

  /**
   * 可映射到项目显式定义的会话字段。
   * 基线只要求这是稳定投影名，不内置具体字段语义。
   */
  readonly sessionProjectionKey?: string;
}

export interface CapabilityApiContributionManifest {
  readonly graphqlOperations?: readonly CapabilityGraphqlOperationContribution[];
  readonly httpEndpoints?: readonly CapabilityHttpEndpointContribution[];
  readonly schemaRegistrations?: readonly string[];
}

export interface CapabilityGraphqlOperationContribution {
  readonly operationName: string;
  readonly operationKind: 'query' | 'mutation' | 'subscription';
  readonly requiredPermissions?: readonly string[];
}

export interface CapabilityHttpEndpointContribution {
  readonly endpointId: string;
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly path: string;
  readonly requestBody?: 'none' | 'json' | 'multipart' | 'binary';
  readonly responseBody?: 'json' | 'binary' | 'stream' | 'none';
  readonly requiredPermissions?: readonly string[];
}

export interface CapabilityWorkerContributionManifest {
  readonly processors?: readonly string[];
  readonly handlers?: readonly string[];
  readonly flowHandlers?: readonly CapabilityFlowHandlerContribution[];
  readonly backgroundTasks?: readonly CapabilityBackgroundTaskContribution[];
}

export interface CapabilityFlowHandlerContribution {
  readonly flowType: string;
  readonly handler: string;
  readonly process: CapabilityProcess;
}

export interface CapabilityBackgroundTaskContribution {
  readonly taskName: string;
  readonly kind: 'interval' | 'cron' | 'startup' | 'manual';
  readonly process: CapabilityProcess;
  readonly enabledByDefault?: boolean;
  readonly intervalMs?: number;
  readonly cronExpression?: string;
}

export interface CapabilityProviderContribution {
  readonly token: string;
  readonly description?: string;
}

export interface CapabilityQueueContribution {
  readonly queueName: string;
  readonly jobs: readonly CapabilityQueueJobDefinition[];
  readonly runtime?: CapabilityQueueRuntimePolicy;
}

export interface CapabilityQueueJobDefinition {
  readonly jobName: string;
  readonly handler: string;
  readonly attempts?: number;
  readonly dedupRequired?: boolean;
}

export interface CapabilityQueueRuntimePolicy {
  readonly concurrency: number;
  readonly limiter?: {
    readonly max: number;
    readonly durationMs: number;
  };
  readonly shutdownGraceMs: number;
  readonly disabledPolicy?: CapabilityQueueDisabledPolicy;
  readonly killSwitchPolicy?: CapabilityQueueKillSwitchPolicy;
}

export interface CapabilityQueueDisabledPolicy {
  /**
   * pause_new_enqueue: 拒绝或暂停新的入队请求。
   * reject_new_enqueue: 明确返回能力不可用错误。
   */
  readonly newJobs: 'pause_new_enqueue' | 'reject_new_enqueue';

  /**
   * continue: 继续消费已入队任务。
   * pause: 暂停消费，等待能力恢复。
   * mark_failed_and_audit: 标记失败并落审计。
   */
  readonly existingJobs: 'continue' | 'pause' | 'mark_failed_and_audit';
}

export type CapabilityQueueKillSwitchPolicy = CapabilityQueueDisabledPolicy;
```

`CapabilityQueueKillSwitchPolicy` 与 `CapabilityQueueDisabledPolicy` 的字段形态相同，但默认语义不同：普通 disabled 默认暂停新入队并继续消费已入队任务；kill switch 默认拒绝新任务，并将不应继续执行的已入队任务标记失败后落审计。若具体 capability 需要不同策略，必须在 manifest 中显式声明。

`exposedInSessionIdentity` 与 `exposedInSession` 有意区分：前者用于 principal 的“当前身份 / 可切换主体”视图，后者用于 authority claim 的“会话授权摘要”视图。两者都是投影开关，但目标 surface 不同；若具体项目要投影到 JWT 或其他会话字段，仍通过 `sessionProjectionKey` 显式声明。

抽象示例：

```ts
const sessionContributionExample: CapabilitySessionContributionManifest = {
  principals: [
    {
      principalCode: 'CLIENT',
      identityResolver: 'clientIdentityResolver',
      sessionProjectionKey: 'accessGroup',
      exposedInSessionIdentity: true,
    },
  ],
  authorityClaims: [
    {
      claimCode: 'RESOURCE_MANAGER',
      subjectPrincipalCode: 'CLIENT',
      summaryResolver: 'resourceManagerSummaryResolver',
      scopeAuthorizer: 'resourceManagerScopeAuthorizer',
      exposedInSession: true,
    },
  ],
};
```

`CLIENT` 与 `RESOURCE_MANAGER` 是 reference capability / contract fixture 的样例 code，用来把 session principal / authority claim 的接口形态代码化，避免后续生成 capability 时各自理解偏移。它们不属于默认业务装配，不进入真实账号、权限、菜单、JWT 生产链路，也不拥有业务表或 migration。真实项目应由具体 capability 定义自己的稳定 principal / authority claim code；`RESOURCE_MANAGER` 不表示全局管理权限，只表示存在某类资源管理资格摘要，最终资源范围仍由 owner capability 的 authorizer 判断。

Reference fixture 的目标是“代码即文档”：

- 提供最小 manifest、identity resolver、summary resolver、scope authorizer 和 session projection 示例。
- 参与 registry / bootstrap / session contribution 单测。
- 不被 API / Worker 默认加载为真实能力。
- 不作为业务模板硬编码进 platform.account 或 modules/common。

### Runtime

```ts
export interface CapabilityRuntimeManifest {
  readonly healthCheck?: boolean;
  readonly killSwitch?: boolean;
  readonly retryPolicy?: CapabilityRetryPolicy;
  readonly rateLimit?: CapabilityRateLimitPolicy;
}

export interface CapabilityRetryPolicy {
  readonly maxAttempts: number;
  readonly backoff: 'fixed' | 'exponential';
  readonly delayMs: number;
}

export interface CapabilityRateLimitPolicy {
  readonly max: number;
  readonly windowMs: number;
}
```

## 启停状态

能力开启 / 关闭按四层理解。

1. 安装态：能力代码、依赖和 migration 是否进入项目。
2. 部署态：能力在某个环境是否启用，通常由配置与 manifest 决定。
3. 运行态：能力已启用后，是否按租户、用户、角色或灰度策略开放。
4. Kill switch：外部系统异常时，紧急阻断调用但保留系统可恢复状态。

`platform.*` 只做依赖声明和自描述，不参与普通 capability enableState 状态机，也不应声明业务意义上的 kill switch。平台底座异常应按启动失败、健康检查失败或整体降级处理，而不是被当成可关闭插件。

在 `dependsOn` 校验中，`platform.*` 依赖默认视为 installed/enabled。它们不需要构造普通 `CapabilityRuntimeState`，也不参与 deployment/runtime disabled 判断。

```ts
export type CapabilityInstallState = 'installed' | 'not_installed';

export type CapabilityEnableState =
  | 'enabled'
  | 'disabled'
  | 'dependency_disabled'
  | 'misconfigured'
  | 'killed';

export interface CapabilityRuntimeState {
  readonly capabilityId: CapabilityId;
  readonly installState: CapabilityInstallState;
  readonly enableState: CapabilityEnableState;
  readonly enabledForProcesses: readonly CapabilityProcess[];
  readonly disabledReason?: string;
  readonly updatedAt: Date;
}

export interface CapabilityAvailabilityQuery {
  readonly capabilityId: CapabilityId;
  readonly process?: CapabilityProcess;
  readonly actor?: CapabilityActorContext;
  readonly entryPoint?: CapabilityEntryPoint;
  readonly tenantId?: string;
}

export interface CapabilityAvailabilityResult {
  readonly available: boolean;
  readonly state: CapabilityRuntimeState;
  readonly reason?: CapabilityDisabledReason;
}

export interface CapabilityDisabledReason {
  readonly code:
    | 'CAPABILITY_NOT_INSTALLED'
    | 'CAPABILITY_DISABLED'
    | 'CAPABILITY_MISCONFIGURED'
    | 'CAPABILITY_DEPENDENCY_DISABLED'
    | 'CAPABILITY_KILLED'
    | 'CAPABILITY_NOT_AVAILABLE_FOR_PROCESS'
    | 'CAPABILITY_NOT_AVAILABLE_FOR_ACTOR';
  readonly message: string;
}
```

关闭能力时默认不删除数据，不自动回滚 migration。

启停状态来源建议：

- 安装态由代码、依赖和 migration 是否进入项目决定。
- 部署态由 env + manifest 在启动期共同决定。
- 运行态由配置模块提供，可支持热读或短周期刷新。
- Kill switch 可来自配置模块、健康检查降级或运维开关。
- 不建议把 capability 启停状态写入业务数据库；这会让平台底座对业务存储产生反向写依赖。

Worker 对已入队任务的处理由 capability manifest 中的 queue runtime policy 声明。默认策略：

- 普通关闭：暂停新入队，继续消费已入队任务。
- Kill switch：拒绝新任务，已入队任务标记 failed 并落审计。

GraphQL code-first 场景下应优先保持同一部署集群的 schema 一致。

- 安装态未安装：代码不进入项目，resolver 可以不存在。
- 部署态关闭：resolver 仍可注册，但入口统一返回 `CAPABILITY_DISABLED`。
- 运行态关闭：guard、usecase 或 dispatcher 的 capability check 返回 `CAPABILITY_DISABLED`。

只有明确能保证所有节点使用同一构建和同一 schema 发布策略时，才考虑部署态不注册 resolver。

## Envelope

能力之间统一通过 command / query / event 表达协作。

所有调用共享基础 envelope：

```ts
export interface CapabilityActorContext {
  readonly accountId?: number;
  readonly activeRole?: string | null;
  readonly principalCodes?: readonly string[];
  readonly authorityClaims?: readonly string[];

  /**
   * 当前项目的兼容会话投影。新 capability 设计应优先使用
   * principalCodes / authorityClaims 的通用语义。
   */
  readonly accessGroup?: readonly string[];
  readonly source: 'anonymous' | 'account' | 'system' | 'worker';
}

export interface CapabilityRequestContext {
  readonly traceId: string;
  readonly requestId: string;
  readonly actor: CapabilityActorContext;
  readonly entryPoint?: CapabilityEntryPoint;
  readonly tenantId?: string;
  readonly locale?: string;
  readonly ip?: string;
  readonly userAgent?: string;
}

export interface CapabilityEnvelope<TPayload> {
  readonly capability: CapabilityId;
  readonly operation: string;
  readonly operationKind: CapabilityOperationKind;
  readonly operationVersion?: string;
  readonly context: CapabilityRequestContext;
  readonly idempotencyKey?: string;
  readonly dedupKey?: string;
  readonly payload: TPayload;
  readonly createdAt: Date;
}

export type CapabilityCommand<TPayload> = CapabilityEnvelope<TPayload> & {
  readonly operationKind: 'command';
};

export type CapabilityQuery<TPayload> = CapabilityEnvelope<TPayload> & {
  readonly operationKind: 'query';
};

export type CapabilityEvent<TPayload> = CapabilityEnvelope<TPayload> & {
  readonly operationKind: 'event';
  readonly eventId: string;
  readonly occurredAt: Date;
};
```

`eventId` 由发布方在发布前生成，建议使用全局唯一 UUID 或等价碰撞概率足够低的 id。订阅方应以 `eventId` 做幂等去重键。`idempotencyKey` 主要表达调用方对 command / queue enqueue 的幂等目标，不替代事件发生事实的 `eventId`。

`entryPoint` 表达调用入口或客户端面，建议值域使用 `CapabilityEntryPoint`：`graphql-api`、`admin-api`、`worker`、`system-task`、`cron`。它不是租户、组织、角色或权限主体；租户使用 `tenantId`，授权主体使用 `actor`。

首个实现只需要落地真实存在的入口，例如当前项目的 `graphql-api` 与 `worker`。`admin-api`、`system-task`、`cron` 是保留值域，只有出现对应 bootstrap、guard 或调度入口后才应实际写入 context，避免日志和权限策略里出现无法观测的虚拟入口。

不要把 JWT `aud` claim、`JWT_AUDIENCE` 配置或业务登录流程中的 `audience` 直接写入 `CapabilityRequestContext.entryPoint`。这些是 auth/token 的受众概念；capability context 的 `entryPoint` 只描述请求进入系统的运行面。

Envelope 不携带 `PersistenceTransactionContext` 或其他 ORM transaction handle。跨 capability command handler 默认在自己的事务边界内执行；即使调用方 usecase 正处于 `TransactionRunner.run()` 中，也不能假设 target capability 的写入会加入调用方事务或随调用方回滚。

### Context Propagation

`CapabilityRequestContext` 不应依赖每个 usecase 手动拼装和透传。

建议底座提供 request context accessor：

```ts
export interface CapabilityRequestContextStore {
  run<T>(context: CapabilityRequestContext, callback: () => Promise<T>): Promise<T>;
  getCurrent(): CapabilityRequestContext | null;
  requireCurrent(): CapabilityRequestContext;
}
```

in-process transport 下，优先用 `AsyncLocalStorage` 保存当前 context。Nest REQUEST-scoped provider 会让依赖链连锁变成 request scope，和当前项目以单例 service 为主的结构冲突较大，除非有明确性能和生命周期评估，否则不作为默认方案。

建议入口：

- GraphQL / HTTP adapter 在请求进入时创建 `CapabilityRequestContext`。
- Worker adapter 从 job payload、job id、traceId 和 worker identity 构造 `CapabilityRequestContext`。
- Usecase 内部跨 capability 调用时，dispatcher 默认继承当前 context。
- 显式传入 context 只用于系统任务、降级输入或跨进程恢复。

如果当前 context 不存在，dispatcher 应拒绝执行需要 actor / trace 的 operation，或按 manifest 声明的 system operation 策略构造 system actor。

### Response

所有 command / query 返回统一 result。Event 发布默认不要求业务结果，只要求发布是否被底座接受。

```ts
export type CapabilityResult<TData> =
  | CapabilitySuccess<TData>
  | CapabilityFailure;

export interface CapabilitySuccess<TData> {
  readonly ok: true;
  readonly data: TData;
  readonly meta?: CapabilityResultMeta;
}

export interface CapabilityFailure {
  readonly ok: false;
  readonly error: CapabilityError;
  readonly meta?: CapabilityResultMeta;
}

export interface CapabilityResultMeta {
  readonly traceId: string;
  readonly requestId: string;
  readonly capability: CapabilityId;
  readonly operation: string;
  readonly durationMs?: number;
  readonly providerRequestId?: string;
  readonly retryable?: boolean;
}

export interface CapabilityError {
  readonly code: CapabilityErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly causeCode?: string;
}

export type CapabilityErrorCode =
  | 'CAPABILITY_NOT_INSTALLED'
  | 'CAPABILITY_DISABLED'
  | 'CAPABILITY_OPERATION_NOT_FOUND'
  | 'CAPABILITY_OPERATION_DISABLED'
  | 'CAPABILITY_DEPENDENCY_DISABLED'
  | 'CAPABILITY_CONTRACT_VERSION_UNSUPPORTED'
  | 'CAPABILITY_PERMISSION_DENIED'
  | 'CAPABILITY_VALIDATION_FAILED'
  | 'CAPABILITY_IDEMPOTENCY_CONFLICT'
  | 'CAPABILITY_TIMEOUT'
  | 'CAPABILITY_TEMPORARILY_UNAVAILABLE'
  | 'CAPABILITY_INTERNAL_ERROR';
```

进入 GraphQL 层后，`CapabilityError` 应统一映射到现有 GraphQL error contract，不让前端依赖能力内部错误细节。

## Dispatcher

Dispatcher 是能力通信底座的运行时调度组件。调用方只知道发 command/query/event，不直接关心目标由同进程 handler 处理，还是通过 queue 交给 Worker 处理。

Dispatcher 不是新的业务编排模型，也不是跨域 usecase 依赖规则的例外。它只解决能力是否存在、是否启用、当前进程能否调用、用哪种 transport、如何传递 context、如何折叠错误等运行时问题。

Dispatcher 的边界：

- Adapter 不直接把 GraphQL / HTTP 请求转成 dispatcher 调用。
- Adapter 仍调用 usecase。
- Usecase 或 Flow Usecase 在需要跨 capability 协作时使用 dispatcher。
- 同 capability 内部协作不强制经过 dispatcher。
- 同域 usecase -> modules service / QueryService 的直接调用不因为 capability 化而 envelope 化。
- 跨 bounded context 读取仍必须由上层 usecase 发起；dispatcher query 只是把目标读入口运行时路由到 owner capability，不允许调用方绕过 owner QueryService。
- 跨 bounded context 写入仍必须由上层 usecase 或 Flow Usecase 显式表达；dispatcher command 不替代一致性、补偿、重试、审计和失败语义设计。
- 多个独立写语义不得被塞进一个 handler 或 dispatcher operation 中规避 Flow Usecase 拆分。
- Dispatcher 不持有业务事务；事务仍由发起 usecase 定义。
- Dispatcher 不传播调用方 transaction context；跨 capability 写协作默认是独立事务边界。
- 调用方事务回滚不会自动回滚 target capability 已完成的写入，target handler 也不得依赖调用方事务。
- Dispatcher 可以做 capability 启停检查、operation 查找、权限前置检查、context 注入、transport 选择、错误折叠。

```ts
export interface CapabilityCommandBus {
  execute<TPayload, TResult>(
    command: CapabilityCommand<TPayload>,
  ): Promise<CapabilityResult<TResult>>;
}

export interface CapabilityQueryBus {
  ask<TPayload, TResult>(
    query: CapabilityQuery<TPayload>,
  ): Promise<CapabilityResult<TResult>>;
}

export interface CapabilityEventBus {
  publish<TPayload>(event: CapabilityEvent<TPayload>): Promise<CapabilityResult<void>>;
}

/**
 * Optional infrastructure facade. Business usecases should inject the narrow bus they need.
 */
export interface CapabilityDispatcherFacade
  extends CapabilityCommandBus,
    CapabilityQueryBus,
    CapabilityEventBus {}
```

### Handler

```ts
export interface CapabilityOperationHandler<TPayload, TResult> {
  readonly capability: CapabilityId;
  readonly operation: string;
  readonly operationKind: CapabilityOperationKind;

  handle(
    envelope: CapabilityEnvelope<TPayload>,
    signal?: AbortSignal,
  ): Promise<CapabilityResult<TResult>>;
}

export interface CapabilityCommandHandler<TPayload, TResult>
  extends CapabilityOperationHandler<TPayload, TResult> {
  readonly operationKind: 'command';
}

export interface CapabilityQueryHandler<TPayload, TResult>
  extends CapabilityOperationHandler<TPayload, TResult> {
  readonly operationKind: 'query';
}

```

Handler 的职责边界：

- Handler 是 capability bus 到现有 usecase / module service / provider 的适配点。
- Handler 不替代 usecase；复杂写流程仍由 usecase 编排。
- Handler 不承担跨 bounded context 流程编排；跨域读写组合仍归上层 usecase / Flow Usecase。
- Handler 不为复用下游 service 而绕过 modules/service 的同域边界。
- Handler 不应暴露 ORM Entity、Repository 或 QueryBuilder。
- Handler 应把内部 `DomainError` 或 provider 错误折叠为 `CapabilityError`。
- Command / query 是一对一 target handler；event 是发布后零到多 subscriber。Capability 作者公开注册 event 消费侧时应使用 `CapabilityEventSubscriber`，不要再注册另一套 event operation handler。

### Transport

Transport 决定调用如何到达 handler。

```ts
export interface CapabilityTransport {
  readonly name: 'in-process' | 'queue';

  supports(input: {
    readonly capability: CapabilityId;
    readonly operation: string;
    readonly operationKind: CapabilityOperationKind;
  }): boolean;

  dispatch<TPayload, TResult>(
    envelope: CapabilityEnvelope<TPayload>,
  ): Promise<CapabilityResult<TResult>>;
}

export interface CapabilityTransportRegistry {
  register(transport: CapabilityTransport): void;
  resolve(input: {
    readonly capability: CapabilityId;
    readonly operation: string;
    readonly operationKind: CapabilityOperationKind;
  }): CapabilityTransport;
}
```

当前阶段只定义 `in-process` 与 `queue`。Future remote transport 不进入当前接口草案；等真实出现独立部署边界时再扩展 transport name 与 adapter 规范。

首个实现不需要构建复杂的“任意 transport 插件系统”。可以先由 operation descriptor 明确选择 `in-process` 或 `queue`，registry 只做启动对账和最小路由。

Transport 选择规则：

- `in-process` 只能调用当前进程已装配的 capability operation。
- API 进程不能用 `in-process` 调用只在 Worker 进程装配的 operation。
- API / Worker 跨进程 capability 协作默认走 `queue` transport。
- 需要可靠异步执行、重试或削峰的 command / event，应优先声明为 `queue` transport。

### Existing Runtime Facilities

Capability 底座应优先复用现有成熟设施，但这些设施只承担自己的 runtime 职责，不替代 manifest、registry、启停、权限、事务和错误语义。

#### `@nestjs/microservices`

Nest 官方包名是 `@nestjs/microservices`，但它不属于当前能力插拔主线。

当前不采用它承担 capability 底座职责，原因：

- 当前目标是 API / Worker 运行拓扑内的能力插拔，不是独立服务之间的 RPC。
- 当前可靠跨进程协作已经由 BullMQ queue transport 承担。
- `@MessagePattern()` / `@EventPattern()` 属于协议 adapter 语义，过早引入会把设计重新拉向独立服务治理。

只有当真实出现独立部署边界，且 BullMQ queue transport 不能满足同步调用或既有 broker 接入需求时，才重新评估是否增加 `@nestjs/microservices` based remote transport adapter。届时它也只能位于 infrastructure transport adapter 中，不进入 usecases、modules、core 或 `src/types`。

#### Current Facilities

当前项目已有设施的取舍：

- `@nestjs/bullmq` / BullMQ：继续作为可靠异步 command/event transport，承接重试、限流、并发、优雅停机和已入队任务策略。
- `DiscoveryService.createDecorator()`：继续作为 handler / provider 自动发现机制，优先复用 AI workflow handler registry 的模式。
- Node `AsyncLocalStorage`：作为 in-process `CapabilityRequestContext` 传播默认方案。
- `@nestjs/config`：作为部署态配置、运行态开关和 kill switch 配置读取的底座入口。
- `class-validator` / `class-transformer`：保留在 adapter 输入规范化边界；Capability payload 的 runtime contract 应使用 capability-owned validator 或现有 job-contract registry 风格，不把 GraphQL DTO 当成能力 contract 真源。

暂不引入：

- `@nestjs/cqrs`：它提供应用内 command/query/event bus 与 handler 分发，但不能直接覆盖 capability manifest、启停、跨进程 transport、权限、幂等、事务和错误折叠语义。当前项目已有 usecase 编排规则，再叠加 CQRS handler 模型会增加心智负担，首个 capability plan 不采用。

## Registry

Registry 负责收集 manifest、启停状态、operation handler 和 contribution。

```ts
export interface CapabilityRegistry {
  register(manifest: CapabilityManifest): void;

  getManifest(capabilityId: CapabilityId): CapabilityManifest | null;

  listManifests(filter?: CapabilityRegistryFilter): readonly CapabilityManifest[];

  getRuntimeState(capabilityId: CapabilityId): CapabilityRuntimeState;

  checkAvailability(query: CapabilityAvailabilityQuery): CapabilityAvailabilityResult;

  resolveOperation(input: {
    readonly capability: CapabilityId;
    readonly operation: string;
    readonly operationKind: CapabilityOperationKind;
  }): CapabilityOperationDescriptor | null;
}

export interface CapabilityRegistryFilter {
  readonly kind?: CapabilityKind;
  readonly process?: CapabilityProcess;
  readonly enabledOnly?: boolean;
}

export interface CapabilityOperationDescriptor {
  readonly capability: CapabilityId;
  readonly operation: string;
  readonly operationKind: CapabilityOperationKind;
  readonly version?: string;
  readonly requiredPermissions?: readonly string[];
  readonly transport: 'in-process' | 'queue';
}
```

Registry 不直接执行业务逻辑；它只回答“能力是否存在、是否可用、该找谁处理”。

### Bootstrap Consistency Check

Registry 应在应用启动期对 manifest 与运行时注册结果做一次对账。

```ts
export interface CapabilityRegistryBootstrapCheck {
  validate(): CapabilityRegistryValidationResult;
}

export interface CapabilityRegistryValidationResult {
  readonly ok: boolean;
  readonly issues: readonly CapabilityRegistryValidationIssue[];
}

export interface CapabilityRegistryValidationIssue {
  readonly severity: 'error' | 'warning';
  readonly code:
    | 'CAPABILITY_OPERATION_HANDLER_MISSING'
    | 'CAPABILITY_OPERATION_NOT_DECLARED'
    | 'CAPABILITY_GRAPHQL_OPERATION_MISSING'
    | 'CAPABILITY_GRAPHQL_OPERATION_NOT_DECLARED'
    | 'CAPABILITY_HTTP_ENDPOINT_MISSING'
    | 'CAPABILITY_HTTP_ENDPOINT_NOT_DECLARED'
    | 'CAPABILITY_SESSION_PRINCIPAL_RESOLVER_MISSING'
    | 'CAPABILITY_SESSION_AUTHORITY_CLAIM_RESOLVER_MISSING'
    | 'CAPABILITY_SESSION_AUTHORITY_CLAIM_AUTHORIZER_MISSING'
    | 'CAPABILITY_SESSION_PRINCIPAL_REFERENCE_MISSING'
    | 'CAPABILITY_OPERATION_HANDLER_DUPLICATED'
    | 'CAPABILITY_DEPENDENCY_MISSING'
    | 'CAPABILITY_PROCESS_MISMATCH';
  readonly capability: CapabilityId;
  readonly operation?: string;
  readonly operationKind?: CapabilityOperationKind;
  readonly graphqlOperationKind?: 'query' | 'mutation' | 'subscription';
  readonly httpEndpointId?: string;
  readonly principalCode?: string;
  readonly authorityClaimCode?: string;
  readonly message: string;
}
```

建议启动期规则：

- manifest 声明且当前进程启用的 operation 没有对应 handler：启动失败。
- 同一个 operation 注册了多个 handler：启动失败。
- handler 已注册但 manifest 未声明：默认启动告警；严格模式可升级为启动失败。
- manifest 声明的 `graphqlOperations` 没有对应 resolver / schema operation：默认启动失败。
- resolver / schema operation 已注册但 manifest 未声明：默认启动告警；严格模式可升级为启动失败。
- manifest 声明的 `httpEndpoints` 没有对应 controller route / 显式注册项：默认启动失败。
- controller route / 显式注册项已注册但 manifest 未声明：默认启动告警；严格模式可升级为启动失败。
- manifest 声明的 `session.principals` 没有对应 identity resolver：默认启动失败。
- manifest 声明的 `session.authorityClaims` 没有对应 summary resolver：默认启动失败。
- manifest 声明的 `session.authorityClaims.scopeAuthorizer` 没有对应 authorizer：默认启动失败。
- manifest 声明的 `session.authorityClaims.subjectPrincipalCode` 指向未注册 principal，或跨 capability 引用但未声明 `dependsOn`：默认启动失败。
- handler 在某进程注册，但 manifest 的 `processes` 未声明该进程：记录 `CAPABILITY_PROCESS_MISMATCH`，默认启动失败。
- manifest 声明的依赖能力不存在或未启用：按 `required` / `optional` 规则决定失败或降级。
- operation 被运行态关闭时，handler 可以仍然存在，但 dispatcher 不应允许调用。

## Nest 装配接口

在当前 NestJS 项目中，Capability 可以通过 Nest module 贡献 provider，但对外仍通过 manifest 和 registry 表达。

```ts
export interface NestCapabilityPackage {
  readonly manifest: CapabilityManifest;

  /**
   * 能力在 API 进程中需要挂载的 Nest module。
   */
  readonly apiModule?: unknown;

  /**
   * 能力在 Worker 进程中需要挂载的 Nest module。
   */
  readonly workerModule?: unknown;

  /**
   * 能力共享 provider module。
   * 例如 provider contract、QueryService、基础 service。
   */
  readonly sharedModule?: unknown;
}
```

Direction 文档中用 `unknown` 避免接口草案直接 import Nest 类型；正式实现 `NestCapabilityPackage` 时不应继续使用 `unknown`，module 字段必须收敛为 Nest 的 `Type<unknown> | DynamicModule` 或本项目封装的等价类型，保证装配期类型安全和启动对账可落地。

API 进程装配时只加载：

- 平台底座 module
- 当前进程启用的 capability API module
- 当前进程启用能力需要的 shared module

Worker 进程装配时只加载：

- 平台底座 module
- 当前进程启用的 capability worker module
- 当前进程启用能力需要的 shared module

同一个 capability 在不同进程中的装配可以不同。API 进程可以有 GraphQL operation surface、guards 和入队入口；Worker 进程通常只有 processor、event subscriber、queue consumer 或后台 handler，不应挂载 GraphQL resolver。

当前 `CapabilityProcess = 'api' | 'worker'` 只覆盖本项目现有两个 bootstrap。若未来出现独立 scheduler、cron、admin API 或 public API 进程，应扩展 union，而不是把不同进程语义塞进同一个 `api`。

## 权限检查接口

权限属于平台底座，但权限声明可以来自 capability manifest。

Capability permission manifest 是后端权限真源。前端菜单、功能点和可见性配置可以从后端权限信息派生，但不应和后端 capability manifest 共用同一份声明文件。

```ts
export interface CapabilityPermissionChecker {
  canAccess(input: CapabilityPermissionCheckInput): Promise<CapabilityPermissionCheckResult>;
}

export interface CapabilityPermissionCheckInput {
  readonly capability: CapabilityId;
  readonly operation: string;
  readonly actor: CapabilityActorContext;
  readonly requiredPermissions: readonly string[];
  readonly payload?: unknown;
}

export interface CapabilityPermissionCheckResult {
  readonly allowed: boolean;
  readonly deniedReason?: string;
}
```

推荐顺序不改变 `adapter -> usecase` 的现有入口语义：

`session context builder` 属于平台底座的 usecase-owned runtime boundary。它不属于具体 capability，也不是 adapter 层的业务编排。正式实现时可放在 `src/usecases/common/ports` 作为 `*.contract.ts`，由 infrastructure 提供 Nest / AsyncLocalStorage / Discovery / resolver registry 实现；GraphQL / HTTP adapter、guard 或 middleware 只通过 DI token 调用它建立 `CapabilityRequestContext` / `CapabilityActorContext`，然后继续调用 usecase。

若 builder 需要业务身份或授权摘要，它只能通过已注册的 identity resolver / summary resolver 获取，不直接 import 具体业务模块或读取业务事实表。

1. adapter 解析输入，通过平台会话 context builder 把 current user 转成 `CapabilityActorContext`，然后调用 usecase。
2. session context builder 可按已注册的 identity resolver / summary resolver 填充 `principalCodes` 与 `authorityClaims`；首个实现阶段也可以只从当前 JWT 填充 `accountId`、`activeRole` 和兼容 `accessGroup`。
3. usecase 需要跨 capability 协作时，才通过 dispatcher 发起 operation。
4. dispatcher 或 guard 读取 operation descriptor。
5. permission checker 统一判断权限。
6. handler 内只做业务语义校验，不重复解析 JWT。

in-process 场景下，权限检查应优先使用启动期加载的 principal / authority claim / permission 内存映射和 manifest 权限声明，避免每次 dispatcher 调用都查询数据库。需要动态权限或 scope 裁剪时，也应通过 owner capability 的 authorizer、配置模块缓存或显式失效机制控制成本。

## 配置解析接口

能力配置由平台底座读取 raw values，能力自己的 module factory 再映射为本地 options token。

```ts
export interface CapabilityConfigReader {
  read(capabilityId: CapabilityId): CapabilityConfigResult;
}

export type CapabilityConfigResult =
  | {
      readonly ok: true;
      readonly values: Readonly<Record<string, unknown>>;
    }
  | {
      readonly ok: false;
      readonly missingKeys: readonly string[];
      readonly invalidKeys: readonly string[];
    };
```

`CapabilityConfigDefinition.key` 与 `values` 的 key 一一对应。`CapabilityConfigReader` 只负责按 manifest 读取、缺失校验和基础格式校验；结构化 `TOptions` 由 capability-owned module factory 映射和校验。如果 `TOptions` 与 manifest 声明不一致，应在该 capability 的 module factory 启动时报错。

能力执行逻辑不得直接读取 `process.env`。模块装配层可以读取配置并注入 options token。

## 健康检查接口

健康检查用于启动校验、观测、kill switch 判断和运维面板。

```ts
export interface CapabilityHealthCheck {
  readonly capability: CapabilityId;
  check(): Promise<CapabilityHealthResult>;
}

export interface CapabilityHealthResult {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly message?: string;
  readonly checkedAt: Date;
  readonly details?: Readonly<Record<string, unknown>>;
}
```

Technical Capability 通常更需要健康检查，例如外部 API、邮件服务、支付服务、对象存储。

Business Capability 的健康检查可以只检查关键依赖能力和数据资源是否可用。

## 事件接口

Event 表达已经发生的事实或触发后续处理的信号。Event 不按 command / query 的一对一 target handler 模型注册；发布方声明 event，消费方注册 subscriber。

```ts
export interface CapabilityEventPublisher {
  publish<TPayload>(event: CapabilityEvent<TPayload>): Promise<CapabilityResult<void>>;
}

export interface CapabilityEventSubscriber<TPayload> {
  readonly capability: CapabilityId;
  readonly event: string;
  handle(event: CapabilityEvent<TPayload>): Promise<CapabilityResult<void>>;
}
```

事件规则：

- in-process event transport 默认采用异步 fire-and-forget 派发。
- `publish` 返回 `ok: true` 只表示事件已被底座接受或调度，不表示所有订阅方已经执行成功。
- 发布方不等待所有业务副作用完成；如果调用方需要同步结果，应使用 command 而不是 event。
- in-process event 至少保证派发一次；订阅方失败后只保证记录审计，不保证自动重试。
- 需要可靠重试、延迟、削峰或跨进程消费的 event，应声明走 queue transport。
- 订阅方必须幂等。
- 订阅方失败应进入审计或重试，不要求发布方回滚。
- 订阅方失败不应冒泡到发布方事务，也不应反向要求发布方回滚已发生事实。
- 事件 payload 使用稳定 contract，不暴露 ORM Entity。

## 队列接口

队列是 event/command 的一种 transport，但当前项目已有 BullMQ 语义，因此保留队列 manifest。

```ts
export interface CapabilityQueueDispatcher {
  enqueue<TPayload>(input: CapabilityQueueEnqueueInput<TPayload>): Promise<CapabilityQueueResult>;
}

export interface CapabilityQueueEnqueueInput<TPayload> {
  readonly queueName: string;
  readonly jobName: string;
  readonly envelope: CapabilityEnvelope<TPayload>;
  readonly jobId?: string;
}

export interface CapabilityQueueResult {
  readonly jobId: string;
  readonly traceId: string;
}
```

`CapabilityQueueEnqueueInput` 是 queue transport 内部结构，不暴露给业务 usecase。业务 usecase 仍发送 `CapabilityCommand` / `CapabilityEvent` envelope；dispatcher 根据 operation descriptor 决定是否走 queue transport。

Envelope 到 BullMQ job 的映射规则：

- `capability + operation + operationKind` 通过 manifest / registry 映射到现有 `queueName + jobName`。
- `queueName + jobName` 继续使用当前 BullMQ registry 的真源，例如 `BULLMQ_QUEUES.AI` / `BULLMQ_JOBS.AI.WORKFLOW`，不强行改成 capability id。
- BullMQ job data 应包含序列化后的 envelope，至少保留 `capability`、`operation`、`operationKind`、`context`、`idempotencyKey`、`dedupKey`、`payload` 和 `createdAt`。
- `traceId` / `requestId` 来自 `envelope.context`。BullMQ `jobId` 不得替代 `traceId`。
- `dedupKey` 表达业务或队列去重目标；queue transport 可以按当前 BullMQ 能力把它映射为 `jobId` 或 dedup option，但该映射必须由 queue binding 策略显式声明。
- Worker adapter 从 job data 恢复 envelope，并用 envelope context 初始化 `CapabilityRequestContextStore`。

队列任务 payload 应继续使用 runtime contract，不应把 BullMQ payload 当成业务类型真源。

当前 BullMQ 已有 `job-contract.registry.ts` 和 `queue-registry.ts` 两层 registry 雏形。Capability manifest 后续应补的是声明面、capability id / operation 到 queueName / jobName 的绑定、进程装配关联，以及 envelope 与 job payload 的对账规则，而不是重造一套并行队列 registry。

## 数据所有权

共享数据库可以存在，但每个数据资源只能有一个写 owner。

规则草案：

- Capability 可以通过 `data` 声明自己拥有的表或视图，通过 `resourceClaims` 声明非数据资源归属或依赖。
- 其他能力需要读取时，优先通过 owner 的 Query operation。
- 其他能力需要写入时，必须通过 owner 的 Command operation。
- 平台底座可以提供通用 transaction runner，但不替业务能力拥有写语义。
- 禁止为了方便跨能力 join 而让上游直接依赖另一个能力的 ORM Entity。

## 错误映射

Capability 错误应先归一化为 `CapabilityError`，再由 adapter 映射到 GraphQL / HTTP / Worker 结果。

建议映射：

- `CAPABILITY_NOT_INSTALLED` -> 配置或部署错误，生产环境一般不应暴露细节。
- `CAPABILITY_DISABLED` -> 能力关闭，可返回业务可理解提示。
- `CAPABILITY_OPERATION_DISABLED` -> operation 级关闭，与能力关闭同类，可返回业务可理解提示。
- `CAPABILITY_OPERATION_NOT_FOUND` -> 调用方错误或版本不匹配。
- `CAPABILITY_PERMISSION_DENIED` -> 权限错误。
- `CAPABILITY_VALIDATION_FAILED` -> 输入错误。
- `CAPABILITY_IDEMPOTENCY_CONFLICT` -> 幂等冲突，GraphQL / HTTP 下按 conflict 类错误处理。
- `CAPABILITY_TIMEOUT` -> 可重试外部 provider、队列或运行时调用错误。
- `CAPABILITY_TEMPORARILY_UNAVAILABLE` -> 降级或 kill switch。
- `CAPABILITY_INTERNAL_ERROR` -> 未预期错误。

能力内部仍可使用 `DomainError`，但跨能力边界必须折叠为稳定错误结构。

折叠责任建议：

- Handler 负责把自身调用到的 usecase / module service / provider 错误折叠为 `CapabilityError`，因为 handler 最了解 operation 语义。
- Dispatcher 负责能力启停、operation not found、权限拒绝、版本不兼容、timeout、transport unavailable 和未捕获异常的兜底折叠。
- Adapter 负责把 `CapabilityError` 映射到现有 GraphQL error contract；GraphQL 的 `extensions.code` 仍保持稳定分类，能力内部细节只能作为受控的 detail / debug 信息。
- `DomainError.code` 不成为第二套 capability 业务错误码真源；需要保留时放入 `causeCode` 或受控 `details`。

## 示例：Technical Capability

示例只表达形态，不要求按此命名落地。

```ts
export const thirdPartyWeappCapability: CapabilityManifest = {
  id: 'third-party-auth.weapp',
  kind: 'technical',
  displayName: 'WeApp Auth Provider',
  version: '1.0.0',
  processes: ['api'],
  config: [
    { key: 'WECHAT_APP_ID', required: true, secret: false, requiredWhenEnabled: true },
    { key: 'WECHAT_APP_SECRET', required: true, secret: true, requiredWhenEnabled: true },
  ],
  operations: {
    commands: [
      {
        kind: 'command',
        name: 'exchangeCredential',
        sideEffects: 'external',
        timeoutMs: 10000,
        enabledByDefault: true,
      },
      {
        kind: 'command',
        name: 'getPhoneNumber',
        sideEffects: 'external',
        timeoutMs: 10000,
        enabledByDefault: true,
      },
    ],
  },
  runtime: {
    healthCheck: true,
    killSwitch: true,
  },
};
```

## 示例：Business Capability

示例只表达业务能力结构，不绑定具体业务项目。

```ts
export const businessContentCapability: CapabilityManifest = {
  id: 'content',
  kind: 'business',
  displayName: 'Content Capability',
  version: '1.0.0',
  processes: ['api', 'worker'],
  dependsOn: [
    { capabilityId: 'platform.account', mode: 'required' },
    { capabilityId: 'platform.auth', mode: 'required' },
  ],
  permissions: [
    { key: 'content.read', defaultRoles: ['REGISTRANT'], exposedToClient: true },
    { key: 'content.write', defaultRoles: ['STAFF', 'ADMIN'], exposedToClient: true },
  ],
  operations: {
    commands: [
      {
        kind: 'command',
        name: 'publish',
        sideEffects: 'internal',
        idempotency: { required: true, scope: 'business' },
        requiredPermissions: ['content.write'],
      },
    ],
    queries: [
      {
        kind: 'query',
        name: 'getById',
        requiredPermissions: ['content.read'],
        cache: { cacheable: true, ttlMs: 30000 },
      },
    ],
    events: [
      {
        kind: 'event',
        name: 'published',
        eventType: 'fact',
      },
    ],
  },
  data: {
    resources: [
      {
        name: 'content_item',
        kind: 'table',
        owner: 'content',
        readShared: false,
        writeOwnerOnly: true,
      },
    ],
  },
};
```

## 当前项目映射

当前项目已经具备一部分可演进基础：

- `third-party-auth.weapp` 已通过 module-owned contract 与 infrastructure 实现隔离，这是 capability 化的前置条件；但它还没有 manifest、dispatcher 集成、启停状态或 provider binding registry，不能描述为已经 capability 化。
- AI provider 有 `AiProviderClient`，但 `ai-provider-registry.ts` 仍硬编码 `LocalMockAiProvider`、`OpenAiGenerateProvider`、`QwenGenerateProvider` 并用 provider name 分支匹配。这是最适合优先演进为 `ai.*` capability provider binding 的点。
- AI workflow handler 已使用 `DiscoveryService.createDecorator()` 自动发现和注册，已经是较成熟的能力化 handler 模型样本。
- verification flow handler 已有 `Map<VerificationRecordType, VerificationFlowHandler>` registry、`registerHandler()`、`getHandler()`、`getSupportedTypes()` 和 `isTypeSupported()`；当前差距主要是注册入口仍在 usecase 构造函数里硬连 `ResetPasswordHandler`，还没有像 AI workflow 一样通过 Discovery 收集。
- BullMQ 已经有两层 registry 雏形：`job-contract.registry.ts` 负责 queue/job 的 payload、result 和 validator 契约，`queue-registry.ts` 负责 concurrency、limiter、shutdown grace 等运行时策略。后续应补 manifest 声明面和 capability id 关联，而不是把它描述为只有静态常量。
- API / Worker 进程拆分已经很清楚：API 侧负责编排与入队，Worker 侧负责 BullMQ、AI、Email 等消费入口，可以作为 `processes: ['api' | 'worker']` 的现实样本。

当前项目没有直接携带完整业务语义型能力包。后续若把具体业务口径沉淀回本基线，应按 business capability 设计，而不是沉入平台底座。

## 非目标

- 不在此方向中拆独立部署服务。
- 不把 account/auth 做成可选插件。
- 不允许业务能力绕过底座边界直接改写 account/auth 内部实现。
- 不把具体业务项目中的能力类别固化为基线专用接口；基线只沉淀通用 contribution 与运行时治理语义。
- 不为了统一而要求所有能力拥有 entity、resolver、worker 或 migration。
- 不把共享数据库视为反模式；当前阶段重点是写所有权与通信边界，而不是物理库拆分。
- 不要求运行态关闭能力时动态修改数据库 schema。
- 不要求 GraphQL schema 在单个进程内按用户动态变化。
- 不在此阶段引入 capability SDK、CLI 或脚手架工具。
- 不在此阶段重构全部现有 GraphQL resolver；resolver 仍按 adapters 规则渐进对齐。
- 不在此阶段改变现有 e2e 测试分组结构；capability 相关测试先复用 core / worker / smoke 现有路由。

## 迁移策略

迁移应渐进进行，不做大爆炸重构。

建议第一个落地点是 `ai.*` provider binding，而不是完整业务 capability：

- AI provider registry 当前硬编码 provider 列表，收益明确。
- AI workflow handler 已有 Discovery 模型，可复用为 capability handler 注册参考。
- AI / Worker 已天然跨 API 入队与 Worker 消费两个进程，适合验证 `processes`、queue transport 和 bootstrap 对账。

共存策略：

- 新 capability registry 先包住一个技术能力，不要求所有旧 registry 立刻迁移。
- 旧 registry 在 capability registry 覆盖同等契约、启动校验、测试和观测后再删除。
- 现有 usecase -> modules 的同域直接调用不改；只有跨 capability 协作才引入 bus / envelope。
- 现有跨域流程不因 capability 化自动改写为 dispatcher 调用；只有当目标能力需要可选安装、启停、跨进程 transport 或统一错误/权限/context 治理时，才引入 bus / envelope。
- GraphQL resolver 继续留在 adapters；先补 guard/disabled/error 映射，不强制迁移目录结构。
- 从业务项目回投能力时，先把具体语义映射到通用 contribution。若只能服务单个业务场景，留在该 capability 本地实现；只有跨多个 capability 反复出现的装配语义才上收到基线接口。

迁移前应审视既有“一个 usecase 事务内同时写底座账号 / access 索引和业务身份事实”的流程：

- 若这些写入仍属于同一个 capability owner，短期可以保持现有 usecase -> modules 调用。
- 若业务身份事实被拆成独立 business capability，则原流程应提升为 Flow Usecase 或显式跨 capability command，并为每个 owner 声明独立事务、幂等、补偿和审计语义。
- 不允许因为原流程曾经共享一个数据库事务，就在 capability 拆分后继续假设跨 capability 写能共享事务。

## 已收敛倾向

- Manifest 真源使用 TS 常量；JSON 只作为可选生成物。
- 启停状态不进业务数据库：安装 / 部署态来自代码、env 和 manifest，运行态来自配置模块，kill switch 来自配置或健康检查降级。
- GraphQL code-first 场景保持 schema 一致：部署态和运行态关闭都注册 resolver，但入口统一返回 `CAPABILITY_DISABLED`。
- Worker 已入队任务按 capability queue runtime policy 处理；默认普通关闭暂停新入队并继续消费已入队，kill switch 拒绝新任务并把已入队任务 failed 落审计。
- 当前阶段不引入 manifest 驱动的 migration runner；manifest 只声明 migration 归属，不驱动执行。
- Operation contract 可保留 `operationVersion` 作为能力契约演进字段；首个实现可为空，版本不兼容时返回 `CAPABILITY_CONTRACT_VERSION_UNSUPPORTED`。
- Capability permission manifest 是后端权限真源；前端菜单 / 功能点声明可从后端权限信息派生，但不共享同一份 manifest。

## 后续计划需细化

P0，首个 `ai.*` technical capability 落地必须先细化：

- 首个 `ai.*` capability provider binding 的目录结构、contract 位置、旧 registry 共存方式，以及 `AI_PROVIDER_MODE=mock/remote` 如何映射到 capability 启停、provider binding 选择或 local mock provider fallback。
- `NestCapabilityPackage` 的具体 Type / DynamicModule 类型、manifest provider 注册方式，以及 API / Worker bootstrap 如何汇总并做启动对账。
- Queue transport 的 envelope ↔ BullMQ job 映射规则，以及 queue runtime policy 与当前 BullMQ registry 的字段合并方式。
- CapabilityError、DomainError 与 GraphQL error contract 的具体映射 helper，包括 disabled / temporarily unavailable / idempotency conflict。
- 首个 `ai.*` capability 的 P0/P1/P2 步骤清单和最小验证命令。

P1，第二批能力拆分和平台治理需要细化：

- `modules/common` 瘦身的具体迁移顺序：AI technical capability 之后，评估 email dispatch / worker、verification / invite policy、password / security / tokens、utils 的归属。
- Session principal / authority claim contribution 如何映射到既有 `accessGroup`、项目显式会话投影字段、identity resolver、summary resolver 和 scope authorizer。
- `platform.account` 与业务身份子域的拆分路径：哪些身份包先作为现有 account 内部 contribution 注册，哪些后续迁为 business capability。
- 配置模块如何表达运行态启停、热读周期和 kill switch 优先级。
- `CapabilityEntryPoint` 的最终值域、命名约束，以及 adapter 如何从请求上下文映射到 `entryPoint`。
- Capability manifest 与 Nest module 装配如何同步注册、启动期对账、循环依赖检测和错误报告。

P2，真实业务 capability 和扩展 surface 出现后再细化：

- Capability API surface 与 adapters GraphQL resolver / DTO 的映射规则。
- Capability API surface 与 adapters HTTP controller、multipart 上传、binary/stream 下载的映射规则。
- 通用 resource claim 的边界：`externalResource`、`artifact`、`authorizationResource` 如何做启动对账、健康检查、权限/ownership 校验。
- `flowHandlers` 与 `backgroundTasks` 如何复用现有 Discovery、worker usecase 和异步审计规则。
- `AbortSignal` 在 dispatcher / handler / provider / queue worker 中的传递与取消边界。
- Capability 化后的 e2e 测试组织：优先复用现有 core / worker / smoke 分组，必要时再增加能力级测试约定。
