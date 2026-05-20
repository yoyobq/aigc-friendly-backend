<!-- 文件位置: plans/layered-governance-alignment-plan.md -->

# Layered Governance Alignment Plan

## 背景

当前仓库是旧项目。账号培训班语义移除已经收口，后续主线切换为：**完全对齐新项目
`/var/www/backend_next` 的分层治理体系和文档体系**。

这里的“新项目”只作为架构治理基线，不作为业务域来源。旧项目不能引入新项目中的教育、学校、
班级、学生、教务、upstream-access 等业务语义。

参考输入：

- 新项目 agent context：`/var/www/backend_next/AGENTS.md`
- 新项目 docs index：`/var/www/backend_next/docs/README.md`
- 新项目 framework extraction plan：
  `/var/www/backend_next/plans/aigc-ddd-framework-extraction-plan.md`
- 当前旧项目 agent context：`AGENTS.md`
- 当前旧项目 docs index：`docs/README.md`
- 当前旧项目账号收口计划：`plans/account-generic-identity-plan.md`

## 总目标

- 旧项目的分层职责、依赖方向、类型放置、事务边界、QueryService、boundary contract、adapter 规则、
  worker 规则、GraphQL error/auth/session contract 与新项目治理体系完全一致。
- 旧项目 `AGENTS.md`、`docs/README.md`、`docs/common/*`、`docs/api/*`、`docs/worker/*`、
  `docs/project-convention/*` 的路由方式和规则口径与新项目一致。
- 旧项目的架构 lint、typecheck、文件级 e2e 验证方式与新项目规则文档中描述的执行方式一致。
- 后续实现必须以对齐后的 docs/rules 为准，不再依赖旧注释、旧计划或过期口径。

## 非目标

- 不引入新项目的教育业务域。
- 不复制新项目的教育 current API 文档到旧项目。
- 不新增学校、学生、教务、班级、岗位、upstream-access 等能力。
- 不在本阶段做插件系统、pack 系统或微服务拆分。
- 不重启账号业务建模；账号仅保持当前最低框架能力：`ADMIN / STAFF / GUEST / REGISTRANT`，
  以及 staff 注册、staff 登录。

## 对齐定义

“完全对齐”不是简单复制文件，而是满足以下条件：

- 文档入口一致：agent 从 `AGENTS.md` 和 `docs/README.md` 能按同一套路由到最小规则集。
- 规则口径一致：同名 rule 文件表达同一边界；旧项目若因业务域不同需要删减，只能删减业务示例，
  不能改变分层原则。
- 代码边界一致：实际 import、module 装配、DTO/type 依赖、事务入口、QueryService 调用方向符合规则。
- 验证方式一致：`docs/common/eslint-architecture-rules.md` 能说明哪些边界已由 lint 覆盖，哪些需要人工扫描。
- 差异可解释：任何没有从新项目复制的文档，都必须是因为它属于教育业务 current API 或旧项目不存在的业务域。

## 新项目治理基线

必须对齐的治理文件类别：

- `AGENTS.md`
- `docs/README.md`
- `docs/common/rule-precedence.rules.md`
- `docs/common/core.rules.md`
- `docs/common/aggregate.rules.md`
- `docs/common/entity.rules.md`
- `docs/common/modules.rules.md`
- `docs/common/modules.extra.rules.md`
- `docs/common/usecase.rules.md`
- `docs/common/usecase-write-flow-boundaries.rules.md`
- `docs/common/queryservice.rules.md`
- `docs/common/type.rules.md`
- `docs/common/boundary-contract.rules.md`
- `docs/common/infrastructure.rules.md`
- `docs/common/eslint-architecture-rules.md`
- `docs/api/adapters.rules.md`
- `docs/api/graphql-error-contract-current.md`
- `docs/worker/worker-adapter.rules.md`
- `docs/worker/worker-usecase.rules.md`
- `docs/worker/qm-worker-integration.rules.md`
- `docs/worker/email-worker-delivery.rules.md`
- `docs/common/queue-identifiers.rules.md`
- `docs/common/ai-task-lifecycle-audit.rules.md`
- `docs/project-convention/ai-provider-call-persistence.rules.md`
- `docs/project-convention/database-baseline-delivery.rules.md`
- `docs/project-convention/e2e-test-groups.md`
- `docs/project-convention/input-field-design.md`
- `docs/project-convention/input-normalize-v1-boundaries.md`
- `docs/project-convention/time-field-design.md`
- `docs/project-convention/time-normalize-v1-boundaries.md`

需要明确排除或改写的类别：

- 新项目 `docs/api/*-current.md` 中教育、班级、教务、upstream-access 等业务 current 文档不复制。
- 新项目 `docs/project-convention/account-slot-group.rules.md` 若表达教育岗位或 slotGroup 语义，不进入旧项目。
- 新项目 `docs/frontend/*` 只作为前后端协作背景，不作为旧项目后端治理 source of truth。
- 新项目 `docs/deprecated/*` 只可作为历史背景，不作为实现指导。
- `docs/human/*` 不作为 agent 实现指导。

## 当前已知差距

- 旧项目缺少新项目中的 `aggregate.rules.md` 与 `entity.rules.md`。
- 旧项目 `docs/README.md` 路由比新项目少 aggregate/entity/current API 分支，需要按旧项目业务面改写。
- 旧项目 `AGENTS.md` 已吸收部分新项目口径，但 transaction boundary 描述仍需与新项目当前 `TransactionRunner`
  口径核对。
- 旧项目 `docs/api/*-current.md` 只保留通用 API current contract 时才应补齐；不能复制教育 API current 文档。
- 旧项目 ESLint architecture coverage 需要重新核对：哪些边界已自动覆盖，哪些仍需 `rg`/人工检查。
- 旧项目代码可能仍存在旧式 EntityManager transaction alias、adapter 直接依赖、DTO/type 下沉、modules 跨域依赖等
  历史问题，需要在规则对齐后分批清理。

## 推进阶段

### P0：新旧治理差异清单

当前产出：

- [layered-governance-p0-inventory.md](./layered-governance-p0-inventory.md)

目标：先准确知道旧项目和新项目在治理文档、规则入口、验证方式上的差距。

产出物：

- `AGENTS.md` 差异清单。
- `docs/README.md` 路由差异清单。
- `docs/common/*` 缺失、过期、需改写清单。
- `docs/api/*` 中应复制、应改写、应排除清单。
- `docs/worker/*` 与 `docs/project-convention/*` 差异清单。
- 当前旧项目 architecture lint 覆盖范围初扫清单。
- 治理文档动作矩阵：
  - 新项目文件。
  - 旧项目状态。
  - 动作：`copy` / `adapt` / `exclude` / `defer`。
  - 原因。
- P0 决策记录：D0-D3 必须在 P1 开始前冻结。

建议命令：

- `diff -u /var/www/backend_next/AGENTS.md AGENTS.md`
- `diff -u /var/www/backend_next/docs/README.md docs/README.md`
- `find /var/www/backend_next/docs -maxdepth 2 -type f | sort`
- `find docs -maxdepth 2 -type f | sort`
- `npm run typecheck`
- `npx eslint "{src,apps,libs,test}/**/*.ts" --cache --cache-location .eslintcache`

验收：

- 能逐项说明哪些治理文档必须完全对齐。
- 能逐项说明哪些新项目文档因教育业务语义被排除。
- 能确认旧项目后续实现应读取哪些 rule。
- D0-D3 已有明确结论，不把关键选择留到 P1 执行中临场决定。

P0 决策闸口：

- D0：旧项目采用新项目 `TransactionRunner` 口径作为目标；若当前代码仍使用 EntityManager transaction alias，
  只能作为待迁移项记录，不能继续新增同类 alias。
- D1：旧项目只补通用 current API 文档。教育、班级、教务、upstream-access 等 current API 文档一律排除。
- D2：先补齐 aggregate/entity rule 文档与人工扫描命令；是否新增 lint 规则由 P2 根据当前 ESLint 能力决策。
- D3：账号收口计划保留为完成计划，不再作为当前主线；当前主线是本分层治理对齐计划。

### P1：文档体系完全对齐

当前产出：

- `AGENTS.md` 已补 current API 路由，并将事务目标口径收敛到 `TransactionRunner`，当前
  EntityManager alias 仅作为 legacy 迁移债务。
- `docs/README.md` 已补 aggregate/entity/plans/current API/frontend/deprecated 路由。
- `plans/README.md` 已补生命周期、token 友好读取顺序与当前主计划入口。
- 已新增 `docs/common/aggregate.rules.md` 与 `docs/common/entity.rules.md`。
- 已新增旧项目通用 current API 文档：
  - `docs/api/auth-session-current.md`
  - `docs/api/account-write-current.md`
- 已新增非实现指导目录说明：
  - `docs/frontend/README.md`
  - `docs/deprecated/README.md`
- 已更新核心分层规则：
  - `docs/common/core.rules.md`
  - `docs/common/modules.rules.md`
  - `docs/common/modules.extra.rules.md`
  - `docs/common/usecase.rules.md`
  - `docs/common/usecase-write-flow-boundaries.rules.md`
  - `docs/common/queryservice.rules.md`
  - `docs/common/type.rules.md`
  - `docs/common/boundary-contract.rules.md`
  - `docs/common/infrastructure.rules.md`
  - `docs/common/rule-precedence.rules.md`
  - `docs/common/eslint-architecture-rules.md`
  - `docs/api/adapters.rules.md`
  - `docs/worker/qm-worker-integration.rules.md`

验证：

- `rg -n "学生|教务|班级|学校|课程|教育|培训班|upstream|academic|Student|StaffProfile|StudentProfile|CourseSchedule|slotGroup|Department|Major" AGENTS.md docs -g '*.md'`
  无匹配。
- `npm run typecheck` 通过。
- `npx eslint "{src,apps,libs,test}/**/*.ts" --cache --cache-location .eslintcache` 通过。
- `git diff --check` 通过。

目标：先让旧项目 docs/agent 入口与新项目治理体系一致，后续代码修改都按新规则执行。

范围：

- 对齐 `AGENTS.md`。
- 对齐 `docs/README.md` 的路由结构和 one-line meanings。
- 补齐或更新 `docs/common/aggregate.rules.md`、`docs/common/entity.rules.md`。
- 核对并更新 `docs/common/core.rules.md`、`modules.rules.md`、`usecase.rules.md`、
  `queryservice.rules.md`、`type.rules.md`、`boundary-contract.rules.md`、`infrastructure.rules.md`。
- 核对并更新 `docs/api/adapters.rules.md` 与 `docs/api/graphql-error-contract-current.md`。
- 核对并更新 worker、queue、AI audit、database baseline、input/time/e2e 规则。
- 明确 `docs/human/`、教育 current docs、frontend docs、deprecated docs 的非实现指导地位。

验收：

- 旧项目文档入口能按新项目方式完成任务路由。
- 同名 rule 文件和新项目原则一致。
- 新项目教育业务 current 文档没有进入旧项目。
- `plans/README.md` 能指向本计划作为当前主线。

### P2：架构验证口径对齐

当前产出：

- [layered-governance-p2-validation.md](./layered-governance-p2-validation.md)
- `eslint.config.mjs` 已参考新项目 local architecture lint，迁入可安全落地的规则。
- `docs/common/eslint-architecture-rules.md` 已更新自动覆盖、legacy 白名单、补充扫描命令与人工
  review 边界。

验证：

- `npm run typecheck` 通过。
- `npx eslint "{src,apps,libs,test}/**/*.ts" --cache --cache-location .eslintcache` 通过。
- `git diff --check` 通过。
- 额外执行 `npm run lint:usecase-normalize-guard`，当前因既有
  `src/usecases/account/fetch-user-info.usecase.ts` 手工 filter / Set 去重失败。
  该问题不是 P2 新增架构 lint 导致，已记录到 P2 validation，后续可单独收口。

目标：让旧项目的可执行验证方式和新项目治理文档一致。

范围：

- 核对 ESLint 架构规则配置和 `docs/common/eslint-architecture-rules.md` 描述是否一致。
- 明确 file-scoped validation、typecheck、lint、e2e group 的使用顺序。
- 为当前没有 lint 覆盖的边界补充 `rg` 扫描命令。
- 记录哪些规则只能人工 review。

验收：

- `npm run typecheck` 通过。
- `npx eslint "{src,apps,libs,test}/**/*.ts" --cache --cache-location .eslintcache` 通过。
- 架构扫描命令能列出后续 P3 的真实问题，而不是停留在文档假设。
- `docs/common/eslint-architecture-rules.md` 明确区分：
  - 已由 ESLint 自动覆盖的规则。
  - 需要 `rg` 扫描辅助的规则。
  - 只能通过 review 判断的规则。

### P3a：代码分层违规 Inventory

当前产出：

- [layered-governance-p3a-inventory.md](./layered-governance-p3a-inventory.md)

目标：按对齐后的新项目规则，先盘点旧项目实际代码里的分层违规，不在本阶段扩大修复范围。

重点检查：

- `adapters` 是否直接 import `modules` 或 `infrastructure`。
- GraphQL DTO/Input/Args/Result 是否下沉到 usecases/modules/core。
- `usecases` 是否拥有写流程、事务边界、跨域编排。
- `modules` 是否只做同域服务、QueryService、repository/entity 封装。
- `modules/common` 是否依赖业务 domain module。
- `core` 是否保持 framework-free、I/O-free、DI-free。
- `types` 是否只依赖 `types`。
- QueryService 是否只由 usecases 调用，adapter 不直接调用。
- boundary contract 是否使用 `*.contract.ts`，且归属到拥有决策的层。
- ORM Entity 是否泄漏 adapter decorator 或被直接返回到 adapter。

产出物：

- 分层违规清单，按规则文件归类。
- 每项违规的文件路径、违规方向、建议修复方式。
- 修复优先级：
  - P0：阻塞 typecheck/lint 或破坏核心架构边界。
  - P1：不阻塞运行但会持续制造错误依赖。
  - P2：命名、注释、历史兼容或低风险尾项。
- 明确不处理项：测试别名、历史计划文字、非实现指导文档等。

验收：

- inventory 能直接指导 P3b 分批提交。
- 不在 P3a 中混入大规模代码修复。
- 不为了治理扫描引入教育业务语义。

### P3b：代码分层违规分批修复

当前产出：

- 第一批已完成：
  - `src/types/errors/exception-payload.types.ts` 移除对 core 的依赖，`ExceptionPayload.errorCode`
    使用协议层稳定 `string`。
  - `src/modules/account/base/entities/user-info.entity.ts` 移除 GraphQL `Field / ID` 装饰器与
    `@nestjs/graphql` import。
  - `eslint.config.mjs` 移除 `exception-payload.types.ts` 的 types-to-core legacy 白名单。
- 第二批已完成：
  - `src/modules/async-task-record/queries/async-task-record.query.service.ts` 从依赖混合读写
    `AsyncTaskRecordService` 改为同域 repository 读侧实现。
  - 行为保持原有 `findById`、`findByQueueJob`、`listByTraceId`、`listByBizTarget`、
    `countByStatus` 与 `hasActiveTaskByBizTarget` 的查询条件、排序、limit 和 view 映射。
- 第三批已完成：
  - `src/modules/account/queries/account.query.service.ts` 从依赖混合读写 `AccountService`
    和 `AccountTransactionManager` 改为同域 repository 读侧实现。
  - 行为保持原有账户详情权限判断、账户 view 映射、userInfo 严格读取与可见资料裁剪。
  - account 写 service 的 transaction legacy 未在本批次扩大处理，仍留给 transaction boundary
    专项批次。
- 第四批已完成：
  - `ThirdPartyAuthEntity` 从 `src/modules/account/base/entities` 迁回
    `src/modules/third-party-auth`。
  - `ThirdPartyAuthEntity` 移除对 `AccountEntity` 的 ORM relation，只保留 `accountId`
    字段契约；表名、字段、索引和迁移语义不变。
  - third-party-auth module / service / QueryService 不再依赖 account 内部 entity。

验证：

- types -> core 扫描无匹配。
- ORM Entity adapter decorator 扫描无匹配。
- QueryService mixed service 扫描不再包含 `async-task-record.query.service.ts` 与
  `account.query.service.ts`。
- third-party-auth entity 搜索仅命中 `src/modules/third-party-auth/**` 与测试引用。
- `npm run typecheck` 通过。
- `npx eslint "{src,apps,libs,test}/**/*.ts" --cache --cache-location .eslintcache` 通过。
- `npm run test:e2e:file -- 01-auth/auth.e2e-spec.ts` 通过。
- `npm run migration:drill:empty-db` 已尝试；当前 E2E DB 用户缺少 `CREATE/DROP DATABASE`
  权限，脚本要求授予权限或设置 `MIGRATION_DRILL_DATABASE` 指向预置空库后再验证。

目标：按 P3a inventory 分批修复旧项目实际代码里的分层违规。

建议批次：

- adapter 边界：resolver / guard / DTO / schema 注册与 usecase 调用方向。
- type 边界：GraphQL DTO 不下沉，shared type 只放 `src/types` 或 bounded-context `.types.ts`。
- transaction 边界：usecase 拥有事务入口，modules 只接收事务上下文。
- QueryService 边界：QueryService 只由 usecase 调用，不由 adapter 直连。
- core/types 纯度：core 不依赖 framework/I/O/config，types 不依赖非 types。
- boundary contract 命名与归属：新增或迁移为 `*.contract.ts`。
- Entity 纯度：ORM Entity 不带 adapter decorator，不作为 adapter 输出 contract。

验收：

- 每个批次涉及文件通过 typecheck/lint 或更窄验证。
- 每个修复批次能回指到 P3a inventory 和对应 rule 文档。
- 不为了治理对齐引入教育业务语义。

### P4：收口与归档

目标：让分层治理对齐成为旧项目稳定基线。

产出物：

- 本计划记录 P0-P3b 完成状态。
- 若发现长期治理尾项，拆到单独 followup。
- 若某些边界暂时只能人工 review，在 `docs/common/eslint-architecture-rules.md` 明确。

验收：

- 旧项目 `AGENTS.md`、`docs/README.md`、核心 rule 文档可作为后续 agent 的稳定入口。
- 后续开发不再需要打开新项目文档才能知道旧项目分层规则。
- 工作区 typecheck/lint 通过，必要的 e2e slice 通过或记录明确外部依赖限制。

## 已冻结决策

- D0：旧项目采用新项目 `TransactionRunner` 口径作为目标；当前 EntityManager transaction alias 只作为待迁移项，
  不再新增。
- D1：旧项目只补通用 current API 文档；教育业务 current API 文档排除。
- D2：先补齐 aggregate/entity rule 文档与人工扫描命令；是否新增 lint 规则放到 P2 决策。
- D3：账号收口计划保留为完成计划，当前主线切换为本分层治理对齐计划。

## 第一轮建议

1. 先做 P0，形成新旧治理差异清单。
2. 在 P0 末尾冻结 D0-D3，避免 P1 执行时临场扩大范围。
3. 做 P1，把 docs/agent 入口补齐到新项目治理口径。
4. 做 P2，确认 lint/typecheck/扫描命令能执行治理验收。
5. 做 P3a，只产出真实分层违规 inventory。
6. 做 P3b，按 inventory 分批修代码。

核心约束：**目标是完全对齐新项目的分层治理体系，不是复制新项目业务域。**
