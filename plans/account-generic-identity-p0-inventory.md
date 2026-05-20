<!-- 文件位置: plans/account-generic-identity-p0-inventory.md -->

# Account Generic Identity P0 Inventory

## 状态

P0 已完成。

本文件记录 P0 初扫结果，用于进入 P1/P2 前确认影响面。它不是稳定规则；稳定规则仍应进入
`docs/`。

## P0 前确认输入

- 主计划：[account-generic-identity-plan.md](./account-generic-identity-plan.md)
- 新项目 agent context：`/var/www/backend_next/AGENTS.md`
- 当前项目工作目录：`/var/www/aigc-friendly-backend`
- 数据库迁移口径：只保证空库 create，不做已有库原地升级
- 目标角色：`ADMIN / STAFF / GUEST / REGISTRANT`
- 保留 `IdentityTypeEnum` 名字，第一阶段只缩小枚举值

## AGENTS.md 差异

当前项目根目录没有 `AGENTS.md`。

新项目 `AGENTS.md` 值得纳入本项目治理，但不建议在 P0 直接原样复制。原因是它引用了当前项目尚未
具备的规则文档，直接落地会让后续 agent 先读到不存在的路径。

新项目 `AGENTS.md` 中当前项目缺失或未对齐的关键引用：

- `docs/api/graphql-error-contract-current.md`
- `docs/common/boundary-contract.rules.md`
- `docs/common/eslint-architecture-rules.md`
- 多数 `docs/api/*-current.md` 当前行为文档

P0 判断：

- `AGENTS.md` 应作为 P1 架构治理对齐的输入。
- 落地 `AGENTS.md` 前，需要二选一：
  - 先补齐其引用的最小规则文档。
  - 或创建当前项目专用 `AGENTS.md`，只引用已存在规则，并把缺失规则列为 P1 followup。

## Docs 差异

当前项目已有：

- `docs/README.md`
- `docs/common/core.rules.md`
- `docs/common/modules.rules.md`
- `docs/common/modules.extra.rules.md`
- `docs/common/usecase.rules.md`
- `docs/common/usecase-write-flow-boundaries.rules.md`
- `docs/common/queryservice.rules.md`
- `docs/common/type.rules.md`
- `docs/common/rule-precedence.rules.md`
- `docs/api/adapters.rules.md`
- worker、queue、input、time、database baseline、e2e 等基础规则

相对新项目缺失的重点规则：

- GraphQL error/auth/session contract
- boundary contract naming rule
- ESLint architecture rule map
- aggregate / entity 规则
- 当前 API 行为快照文档

P0 判断：

- P1 应优先补齐 `boundary-contract.rules.md` 与 `eslint-architecture-rules.md`，因为它们影响后续改代码时的
  文件命名、依赖方向和验证命令。
- GraphQL error/auth/session contract 会影响 auth/session 改造，P1 或 P4 前必须补齐。
- 教育域相关 current API 文档不应从新项目带入。

## 培训班语义影响面

初扫命令：

- `rg -l "MANAGER|COACH|CUSTOMER|LEARNER|manager|coach|customer|learner|training" src test docs plans`

初扫结果：

- 命中文件数：171
- 明确培训班身份管理文件数：
  - `src/modules/account/identities/training`
  - `src/usecases/identity-management`
  - `src/adapters/api/graphql/identity-management`
  - 合计 82 个文件

重点入口：

- `src/types/models/account.types.ts`
- `src/core/account/policy/role-access.policy.ts`
- `src/modules/account/account-installer.module.ts`
- `src/modules/account/account.module.ts`
- `src/modules/account/base/constants/provider-tokens.ts`
- `src/modules/account/base/services/account.service.ts`
- `src/modules/account/queries/account.query.service.ts`
- `src/usecases/account/fetch-identity-by-role.usecase.ts`
- `src/usecases/auth/enrich-login-with-identity.usecase.ts`
- `src/usecases/auth/decide-login-role.usecase.ts`
- `src/usecases/verification/consume-verification-flow.usecase.ts`
- `src/usecases/verification/verification-usecases.module.ts`
- `src/adapters/api/graphql/graphql-adapter.module.ts`
- `src/adapters/api/graphql/schema/enum.registry.ts`
- `src/schema.graphql`

P0 判断：

- 培训班语义不是单一 domain pack；它已经进入 account core policy、shared types、GraphQL schema、auth/session、
  verification、test fixture。
- P2 不能直接删除 training 目录；必须先收敛 role contract。
- P3 需要给通用模块提供不依赖 training identity provider 的 account 装配。

## 教育或 school 语义影响面

初扫命令：

- `rg -l "STUDENT|student|school|academic|department|class|upstream-access" src test docs plans`

初扫结果：

- 命中文件数：328

说明：

- 当前旧项目本身已包含 `school/staff/student` 残留，不是新项目才有。
- 本次不能从新项目引入新的教育语义。
- 旧项目已有 `student / school` 残留应作为待清理或兼容输入处理，不能作为目标模型。

重点入口：

- `src/modules/account/identities/school/*`
- `src/adapters/api/graphql/account/dto/identity/student.dto.ts`
- `src/adapters/api/graphql/account/dto/identity/staff.dto.ts`
- `src/types/models/student.types.ts`
- `test/utils/test-accounts.ts`

P0 判断：

- `STAFF` 可以保留为通用账号角色，但不能复用 school staff 的业务 profile 语义作为通用 staff。
- `STUDENT` 不进入目标 runtime contract。
- 若 P7 需要 staff profile，应重新定义通用 staff profile，不从新项目教育 staff 或旧 school staff 继承。

## Shared Type 与 GraphQL Enum 影响面

初扫命令：

- `rg -l "IdentityTypeEnum|VerificationRecordType|SubjectType|RegisterTypeEnum|EmploymentStatus|LearnerSortField|CustomerSortField|CoachSortField" src test docs plans`

初扫结果：

- 命中文件数：95

重点文件：

- `src/types/models/account.types.ts`
- `src/types/models/verification-record.types.ts`
- `src/types/services/register.types.ts`
- `src/types/common/sort.types.ts`
- `src/adapters/api/graphql/schema/enum.registry.ts`
- `src/infrastructure/database/migrations/1773924900000-create-base-user-accounts-table.migration.ts`
- `src/infrastructure/database/migrations/1773925000000-create-base-user-info-table.migration.ts`
- `src/infrastructure/database/migrations/1773927600000-create-base-verification-records-table.migration.ts`

P0 判断：

- `IdentityTypeEnum` 第一阶段保留名字，但枚举值收敛为 `ADMIN / STAFF / GUEST / REGISTRANT`。
- `VerificationRecordType` 需要移除 training invite 类型。
- `SubjectType` 第一阶段只保留通用 `ACCOUNT`；是否新增 `STAFF` 等到 P7。
- `LearnerSortField / CustomerSortField / CoachSortField` 属于培训班列表能力，应随 identity-management 删除或下线。

## 模块装配影响面

初扫命令：

- `rg -l "AccountInstallerModule|IdentityManagementUsecasesModule|GraphQLAdapterModule|VerificationUsecasesModule|RegistrationUsecasesModule" src test docs plans`

初扫结果：

- 命中文件数：12

重点文件：

- `src/modules/account/account-installer.module.ts`
- `src/modules/auth/auth.module.ts`
- `src/modules/register/register.module.ts`
- `src/modules/verification-record/verification-record.module.ts`
- `src/modules/identity-management/identity-management.module.ts`
- `src/usecases/account/account-usecases.module.ts`
- `src/usecases/auth/auth-usecases.module.ts`
- `src/usecases/registration/registration-usecases.module.ts`
- `src/usecases/verification/verification-usecases.module.ts`
- `src/usecases/identity-management/identity-management-usecases.module.ts`
- `src/adapters/api/graphql/graphql-adapter.module.ts`
- `src/bootstraps/api/api.module.ts`

P0 判断：

- `AccountInstallerModule` 是 training identity provider 进入通用模块的集中入口。
- P3 需要将 account 装配改为 base-only 或 generic-role-only。
- `GraphQLAdapterModule` 当前直接装配 identity-management resolvers，是 P5 的主要清理点。

## 数据库 Baseline

当前 migration 文件：

- `1773889200000-create-ai-provider-call-records-table.migration.ts`
- `1773924900000-create-base-user-accounts-table.migration.ts`
- `1773925000000-create-base-user-info-table.migration.ts`
- `1773925700000-create-base-async-task-records-table.migration.ts`
- `1773926400000-create-base-third-party-auth-table.migration.ts`
- `1773927600000-create-base-verification-records-table.migration.ts`

P0 判断：

- 空库 baseline 当前没有 `member_*` training 表 migration。
- `base_user_accounts.identity_hint` 注释仍包含旧身份示例。
- `base_user_info.user_state` 注释仍包含教育语义。
- `base_verification_records.type` 和 `subject_type` enum 包含培训班语义。
- P6 应直接调整 first-release baseline，并更新 `verify-empty-db-migrations.ts`。

## 测试影响面

重点测试分组：

- `test/01-auth/*`
- `test/02-register/register.e2e-spec.ts`
- `test/03-roles-guard/roles-guard.e2e-spec.ts`
- `test/04-user-info/*`
- `test/05-verification-record/*`
- `test/06-identity-management/*`
- `test/07-pagination-sort-search/*`
- `test/08-qm-worker/email-queue-consume.e2e-spec.ts`
- `test/utils/test-accounts.ts`

P0 判断：

- `test/06-identity-management/*` 大概率整体下线或替换为通用 staff 管理测试。
- `test/utils/test-accounts.ts` 是测试 role 映射和 fixture 的核心入口。
- `email-queue-consume` 中的 invite coach/manager case 需要随 verification 清理。
- `learners-pagination` 和 learner search case 属于培训班语义，应下线或替换。

## P0 验证

- `npm run typecheck` 已通过。
- `node scripts/check-usecase-normalize-guard.js` 已通过。
- `npx eslint "{src,apps,libs,test}/**/*.ts" --cache --cache-location .eslintcache` 已通过。

说明：

- 未运行 `npm run lint`，因为该脚本带 `--fix`，会自动修改文件。
- P1 需要补齐的最小 docs 清单已在本文件 `Docs 差异` 中给出。
- `AGENTS.md` 应进入 P1 处理：先适配当前 docs，或先补齐缺失 rules 后再落地。
