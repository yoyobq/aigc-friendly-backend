<!-- 文件位置: plans/account-generic-identity-plan.md -->

# Account Generic Identity Plan

## 背景

当前仓库是 AIGC friendly backend 的旧项目。后续改造有两个目标：

1. 架构治理绝对对齐新项目 `/var/www/backend_next`。
2. 移除旧项目账号体系中的培训班语义，将账号权限收敛为 `admin / staff / guest` 三层权限语义，
   并保留 `registrant` 作为注册未完成的通用过渡状态。

新项目只作为架构治理基线：参考其分层规则、事务边界、QueryService 归属、adapter/usecase/module/core
依赖方向和计划文档组织方式。

新项目中的教育背景不能带入当前项目。`student`、`school identity`、`academic`、`department`、`class`、
`upstream-access` 等教育语义不属于本次目标。

## 总目标

- 当前项目具备与新项目一致的架构治理口径。
- 账号、权限、注册、登录、会话、验证、邀请等通用能力不再依赖培训班业务身份。
- 培训班语义 `manager / coach / customer / learner` 从 framework kernel 和 generic account capability 中移除。
- 最小账号角色语义稳定为：
  - `ADMIN`：系统管理者。
  - `STAFF`：后台工作人员或运营人员。
  - `GUEST`：未登录、访客或最低权限主体。
  - `REGISTRANT`：已开始注册但未完成资料、验证或激活流程的过渡主体。
- AIGC、worker、email、verification、async task 等通用能力仍可保留并编译通过。

## 非目标

- 不引入新项目的教育域。
- 不把旧项目改造成学校、班级、学生、教务系统。
- 不在第一阶段设计插件系统或完整 domain pack 系统。
- 不强制拆微服务。
- 不做 UI 或前端权限模型重写。
- 不保留培训班角色作为账号核心语义的 alias。

## 架构治理基线

以新项目 `/var/www/backend_next` 中已稳定的规则为参考：

- `core` 只承载纯领域规则、值对象和 core-owned boundary contract。
- `usecases` 承载写流程、事务边界、权限组合和跨域编排。
- `modules(service)` 承载同域可复用服务、QueryService、ORM Entity 和 repository 封装。
- `adapters` 只做 GraphQL / HTTP 协议适配，不直接依赖 service 或 infrastructure。
- `infrastructure` 承载外部系统、数据库、队列、provider、运行时实现。
- 新增 boundary contract 使用 `*.contract.ts`，不新增 `*.port.ts` / `*.ports.ts`。
- 事务边界由 usecase 持有，modules(service) 只接收事务上下文。
- QueryService 属于 modules(service)，上游只允许 usecase 调用。

如本项目 `docs/` 与新项目规则存在差距，先以新项目治理口径修正当前项目规则或实现，再推进业务语义清理。

## P0 前已确认决策

- 保留 `REGISTRANT`。
  它是通用注册流程状态，表达“开始注册但未全部完成”，不表达培训班、教育或业务身份。
- 第一阶段保留 `IdentityTypeEnum` 名字，只缩小枚举值。
  避免在语义清理阶段叠加大范围命名迁移；后续稳定后再评估是否改名为 `RoleEnum` / `AccountRole`。
- 第一阶段目标枚举值为 `ADMIN / STAFF / GUEST / REGISTRANT`。
- 第一阶段不新增通用 staff profile 表。
  `STAFF` 先只作为账号级角色；若需要 staff 资料管理，进入 P7。
- GraphQL contract 允许破坏性移除培训班接口。
  不为 `coach / customer / learner / manager` 提供兼容 alias。
- 数据库只保证空库 create。
  允许直接调整 first-release baseline，不提供已有数据库原地升级脚本。
- 测试验收以 `typecheck`、`lint`、`migration:drill:empty-db`、E2E `core` / `worker` 为主。
  `smoke` 涉及外部服务，不作为本次必过门槛。
- 测试 fixture 和临时开发数据可采用本 plan 的 role 映射建议。

## 当前已确认的问题

### 培训班语义进入账号核心

- `src/types/models/account.types.ts` 中 `IdentityTypeEnum` 包含
  `MANAGER / COACH / CUSTOMER / LEARNER`。
- `src/modules/account/account-installer.module.ts` 默认存在 `training` 身份优先级。
- `src/modules/account/account.module.ts` 直接装配 `identities/training` 身份包。
- `src/core/account/policy/role-access.policy.ts` 定义了
  `ADMIN -> MANAGER -> COACH -> CUSTOMER -> LEARNER` 的权限层级。
- `src/modules/account/base/services/account.service.ts` 直接暴露
  `findCoachByAccountId()`、`findManagerByAccountId()`、`findCustomerByAccountId()`、
  `findLearnerByAccountId()`。

### 培训班身份实体耦合

- `src/modules/account/identities/training/coach/*`
- `src/modules/account/identities/training/customer/*`
- `src/modules/account/identities/training/learner/*`
- `src/modules/account/identities/training/manager/*`

这些实体和服务表达 `教练`、`客户/监护人`、`学员`、`计次比例` 等培训机构语义，不属于通用 framework
账号能力。

### API 与 usecase 暴露培训班角色

- `src/adapters/api/graphql/identity-management/*`
- `src/adapters/api/graphql/account/dto/identity/*`
- `src/usecases/identity-management/*`
- `src/usecases/verification/coach/*`
- `src/usecases/verification/manager/*`
- `src/usecases/verification/invite/accept-invite-coach.usecase.ts`
- `src/usecases/verification/invite/accept-invite-manager.usecase.ts`

这些入口需要后续删除、改名或重新收敛到通用账号语义。

## 目标语义

### Account Base

保留：

- 账号基础表和登录凭据。
- `AccountStatus`。
- `UserInfo` 的通用资料字段。
- 登录历史、第三方登录绑定、密码凭据、注册和验证记录。

调整：

- `identityHint` 不再表达培训班身份。
- `accessGroup` / `metaDigest` 不再保存 `MANAGER / COACH / CUSTOMER / LEARNER`。
- `UserState` 中教育或培训语义强的注释需要清理为通用状态描述。

### Role / Identity

目标角色：

- `ADMIN`
- `STAFF`
- `GUEST`
- `REGISTRANT`

开放问题：

- 是否需要 `SYSTEM` 这类机器主体角色。若需要，应单独评估，不混入本次第一阶段。

### Identity Management

第一阶段不保留培训班 identity management。

若需要通用 staff 管理，应新建或收敛为：

- `src/modules/account/identities/staff/*` 或更通用的 `src/modules/account/staff/*`
- `src/usecases/account` 或 `src/usecases/identity-management/staff`
- GraphQL contract 使用 `staff`，不使用 `coach / learner / customer / manager`

## 迁移策略

迁移以空库 create 为第一目标，不承担已有数据库的历史数据升级。

本阶段迁移分为两条线：

1. Runtime contract 迁移：代码、GraphQL、session、guard、usecase 不再承认培训班角色。
2. Baseline 迁移：空库 first-release migration 只表达通用 skeleton，不包含培训班表或培训班 enum。

已有数据库的数据迁移不作为本阶段目标。若未来需要升级长期运行库，再单独开 followup 或独立迁移计划。

### 角色归一化建议

第一阶段建议采用保守映射，避免把培训班业务概念带进 runtime：

- `ADMIN` -> `ADMIN`
- `STAFF` -> `STAFF`
- `MANAGER` -> `STAFF`
- `COACH` -> `STAFF`
- `CUSTOMER` -> `GUEST`
- `LEARNER` -> `GUEST`
- `REGISTRANT` -> `REGISTRANT`
- `GUEST` -> `GUEST`
- `STUDENT` -> `GUEST`，仅作为旧数据兼容值处理，不进入新 runtime contract
- 未知值 -> `GUEST`

说明：

- `MANAGER / COACH` 在旧项目中更接近工作人员或运营身份，因此迁移为 `STAFF`。
- `CUSTOMER / LEARNER` 更接近访客或普通端用户，因此迁移为 `GUEST`。
- `REGISTRANT` 是通用注册流程过渡状态，因此保留。
- 迁移映射只允许存在于测试 fixture 调整、临时开发数据重建或未来独立历史迁移计划中，不得保留为线上运行时 alias。

### 空库账号字段口径

空库 baseline 需要确保以下字段只表达通用角色：

- `base_user_accounts.identity_hint`
- `base_user_info.access_group`
- `base_user_info.meta_digest`

注意：

- 新建账号只写 `ADMIN / STAFF / GUEST / REGISTRANT`。
- `access_group` 是 JSON 字段，默认值和测试 fixture 不得再使用培训班 role。
- `meta_digest` 是 `@EncryptedField()` 字段，空库新写入时通过现有应用层链路生成。
- 本阶段不提供已有密文的批量转换脚本。
- `identity_hint` 建议写为账号当前角色；若只作为优化字段且无法明确语义，可在 P2 决策中改为置空。

### Verification baseline

当前验证记录 baseline 包含培训班类型：

- `INVITE_COACH`
- `INVITE_MANAGER`
- `INVITE_LEARNER`
- `SubjectType.LEARNER`
- `SubjectType.CUSTOMER`
- `SubjectType.COACH`
- `SubjectType.MANAGER`

空库口径：

- 运行时先停止创建培训班邀请类型。
- 空库 migration 中不再创建培训班 invite enum。
- 只有在 P7 明确补齐通用 staff 邀请能力后，才新增通用 `INVITE_STAFF` 或同类类型。
- `base_verification_records.subject_type` 第一阶段只保留通用 `ACCOUNT`，是否新增 `STAFF` 取决于 P7。
- 不处理已有库中未消费的培训班 invite 历史行。

### Training 表 baseline

当前空库 migration 只包含 base 表，未包含 `member_coaches`、`member_customers`、`member_learners`、
`member_managers`。这些表可能来自历史同步、测试建表或 `synchronize` 环境。

空库口径：

- first-release baseline 不再新增 training 表。
- `verify-empty-db-migrations.ts` 只校验通用 skeleton 所需表、索引和约束。
- 不为 `member_*` 表提供 drop migration。
- 不从 training 表迁出业务资料到 generic account。

### 测试迁移

测试不能一次性全删再补，应按风险分组迁移：

- auth / registration / roles guard / user-info 先改为 `ADMIN / STAFF / GUEST / REGISTRANT`。
- verification-record 测试先保留 email/password/magic-link 等通用类型，移除 invite coach/manager。
- identity-management 测试整体下线或替换为通用 staff 管理测试。
- worker 测试中涉及 `INVITE_MANAGER / INVITE_COACH` 的 email queue case 需要同步删除或改为通用验证。
- pagination/search/sort 中 `learners` 相关 case 属于培训班语义，应下线或替换为通用 account/staff 查询。

## 推进阶段

### P0：规则与影响面确认

产出物：

- 当前项目 `docs/` 与新项目治理规则差异清单。
- 培训班语义引用清单。
- `IdentityTypeEnum`、GraphQL enum、resolver、usecase、entity、migration、test 的影响面清单。
- 确认 P0 前已确认决策与代码现状的差距。
- 空库 baseline 需要保留的表、enum、索引和外键清单。
- 确认本阶段不提供已有数据库历史数据迁移脚本。

建议命令：

- `rg -n "MANAGER|COACH|CUSTOMER|LEARNER|manager|coach|customer|learner|training" src test docs`
- `rg -n "STUDENT|student|school|academic|department|class|upstream-access" src test docs`
- `npm run typecheck`
- `npm run lint`

验收：

- 能说清楚所有培训班语义从哪些入口进入账号体系。
- 能说清楚哪些文件可删除，哪些文件需要泛化。
- 能确认不会引入新项目教育语义。

### P1：架构治理先对齐

目标：先补齐或修正当前项目的架构治理规则，避免在旧规则下继续修改账号模型。

范围：

- 对齐 `core / usecases / modules(service) / adapters / infrastructure` 职责。
- 对齐 `*.contract.ts` 命名口径。
- 对齐 QueryService 归属和 adapter 禁止直接依赖 service 的规则。
- 对齐事务边界由 usecase 持有的规则。
- 保留当前项目已有 `docs/common/*`，必要时按新项目规则更新。

验收：

- 当前项目规则文档能支撑后续账号语义清理。
- 不新增 `*.port.ts` / `*.ports.ts`。
- 不把培训班或教育语义写入架构 rule。

### P2：账号角色契约收敛

目标：按 P0 前已确认决策冻结账号核心角色契约，将目标语义明确为
`ADMIN / STAFF / GUEST / REGISTRANT`，避免后续删除培训班代码时继续扩大歧义。

范围：

- 保留 `IdentityTypeEnum` 名字，缩小枚举值到 `ADMIN / STAFF / GUEST / REGISTRANT`。
- 定义 `ADMIN / STAFF / GUEST / REGISTRANT` 的层级关系、默认权限和 session snapshot 语义。
- 定义旧值 `MANAGER / COACH / CUSTOMER / LEARNER` 的处理策略：
  - 直接删除。
  - 在测试 fixture 或临时开发数据重建中映射为 `STAFF` 或 `GUEST`。
  - 不进入 runtime contract。
- 重写 `role-access.policy.ts`，移除培训班权限层级。
- 更新 GraphQL enum 注册目标，不再把培训班角色作为通用账号角色。

验收：

- 账号角色契约文档化，且只包含通用角色。
- `core/account` 不再出现 `manager / coach / customer / learner` 权限语义。
- GraphQL enum 不再把培训班角色注册为通用账号角色。
- auth/session/roles guard 对 `ADMIN / STAFF / GUEST / REGISTRANT` 的含义一致。

### P3：账号模块去培训班装配

目标：让 account base 不再运行时依赖培训班 identity provider。

范围：

- 清理 `AccountInstallerModule` 中的 `training` priority。
- 清理 `AccountModule` 中对 `identities/training` 的直接装配。
- 清理 `AccountService` 中培训班身份查询方法。
- 清理 `AccountQueryService` 和 account DTO 中对 coach/customer/learner/manager profile 的拼装。
- 保留账号基础能力、UserInfo、登录历史、密码、第三方绑定等通用能力。

验收：

- `src/modules/account/base` 不再 import training 身份实体、service 或 provider。
- `src/modules/account/account.module.ts` 不再导出 training QueryService。
- account base 能在不启用任何培训班身份包的情况下编译。

### P4：注册、验证、邀请与会话改造

目标：把仍有 runtime 调用价值的账号流程改成
`ADMIN / STAFF / GUEST / REGISTRANT` 通用语义。

范围：

- 注册流程默认角色从培训班语义收敛到 `REGISTRANT`。
- 注册完成、验证完成或资料补全后的晋升只进入 `GUEST`，或由后台明确授予 `STAFF / ADMIN`。
- 登录和 session snapshot 不再返回培训班 active role。
- roles guard、decorator、currentUser 上下文只依赖通用角色。
- 删除或替换 `invite coach / invite manager` 验证流程。
- 保留 email verification、password reset、magic link、third-party bind 等通用验证流程。

验收：

- auth/session/registration/verification 不再 import training usecase 或 training entity。
- 保留的 verification flow 不再依赖 coach/manager handler。
- GraphQL 登录结果和 current user contract 不再暴露培训班身份。

### P5：培训班身份 API 与 usecase 移除

目标：移除暴露培训班身份管理语义的 API 和 usecase。

范围：

- 删除或停用 `identity-management/coach`、`identity-management/customer`、
  `identity-management/learner`、`identity-management/manager`。
- 删除或停用对应 GraphQL resolver、DTO、list/filter/sort enum。
- 删除或停用培训班身份创建、升级、停用、恢复相关 usecase。
- 清理 account identity union / identity DTO 中的培训班 profile 类型。

验收：

- API adapter 不再暴露 `coach / customer / learner / manager`。
- usecase 不再编排培训班身份创建、升级、停用、恢复。
- identity-management e2e 不再依赖培训班身份。

### P6：数据库、migration 与测试收敛

目标：让最小 skeleton 能在移除培训班语义后通过基础验证。

范围：

- 调整 first-release migration，使空库只创建通用 skeleton 所需表、enum、索引和外键。
- 从空库 baseline 中移除培训班 invite type、subject type 和培训班字段注释。
- 确认不提供一次性历史数据迁移脚本。
- 处理测试 fixture 和 e2e 中培训班账号。
- 处理 GraphQL schema snapshot 或当前 API 文档中的培训班残留。
- 更新 `verify-empty-db-migrations.ts` 的空库校验口径。

验收：

- `npm run typecheck` 通过。
- `npm run lint` 通过。
- auth/account/verification/registration/AIGC/worker 相关测试能运行，或记录明确未迁移差异。
- `src` 中 framework kernel 与 generic capability 不再依赖培训班身份实现。
- 空库 migration drill 不创建培训班表或培训班 enum。
- 不要求旧数据库原地升级。

### P7：通用 staff 能力补齐

目标：若实际需要后台人员资料或管理能力，按通用 staff 语义补齐，而不是复用培训班 manager/coach。

候选：

- staff profile 最小字段。
- staff list / update / deactivate / reactivate。
- admin 创建 staff。
- staff 登录后的权限与 session snapshot。

验收：

- `STAFF` 是通用工作人员，不表达教师、教练、班主任、学员顾问等行业身份。
- staff 能力位于 account generic capability 或独立 generic staff capability，不依赖教育或培训域。

## 后续开放项

- O0：是否需要 `SYSTEM` 这类机器主体角色。
- O1：是否需要通用 staff profile 表和 staff 管理 API。若需要，进入 P7。
- O2：是否在角色契约稳定后将 `IdentityTypeEnum` 改名为 `RoleEnum` / `AccountRole`。

## 第一轮建议

第一轮不要做完整 pack 系统。建议顺序：

1. 先做 P0，拿到培训班语义影响面清单。
2. 再做 P1，确保当前项目规则对齐新项目架构治理。
3. 做 P2，只冻结账号角色契约，不同时拆模块。
4. 做 P3，让 account base 脱离 training identity provider。
5. 做 P4，把注册、验证、邀请和会话改成通用角色语义。
6. 做 P5/P6，删除培训班 API、usecase、entity、migration、test 残留。
7. 若确实需要 staff 管理，再做 P7。

这条路线的关键约束是：只借鉴新项目的治理方式，不把新项目教育背景带入当前项目。
