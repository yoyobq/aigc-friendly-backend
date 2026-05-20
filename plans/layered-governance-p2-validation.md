<!-- 文件位置: plans/layered-governance-p2-validation.md -->

# Layered Governance P2 Validation

## 状态

P2 已完成，日期：2026-05-21。

本文件记录旧项目对齐新项目 `/var/www/backend_next/eslint.config.mjs` 后的架构验证口径。
它是 P3a 代码分层违规 inventory 的输入。

## P2 决策

- 参考新项目 `localArchitecturePlugin`，旧项目已迁入可安全落地的 local architecture ESLint 规则。
- 已知 legacy 做精确白名单，保证 P2 不把 P3 迁移债务提前变成阻塞：
  - `src/core/pagination/pagination.ports.ts`
  - `src/core/search/search.ports.ts`
  - `src/core/sort/sort.ports.ts`
  - `AccountTransactionManager`
  - `VerificationRecordTransactionManager`
  - `AsyncTaskRecordTransactionManager`
- `no-cross-domain-modules-imports` 暂不迁入 ESLint error。
  旧项目当前存在真实跨模块依赖，需要 P3a 先盘点，再分批修。
- 新项目更细的 `modules-contracts` / `modules-types` / `modules-internal` boundaries modeling
  暂不整套迁入。
  旧项目需要先处理现有 cross-domain modules 与 legacy contract 命名，再收紧模型。

## 当前自动覆盖

`eslint.config.mjs` 当前自动覆盖：

- `boundaries/dependencies` 粗粒度层级矩阵。
- `local-architecture/no-boundary-port-naming-drift`
  - 阻止新增 `*.port.ts` / `*.ports.ts`
  - 阻止 `TransactionPort` / `UnitOfWork`
- `local-architecture/no-transaction-manager-alias`
  - 阻止新增 `*TransactionManager`
- `local-architecture/no-usecase-transaction-manager-orm-api`
  - 阻止 usecase 直接调用事务上下文 ORM API
- `local-architecture/no-infrastructure-to-modules-imports`
  - 阻止 infrastructure 依赖 modules 实现
- `local-architecture/no-cross-domain-usecases-imports`
  - 阻止 usecases 跨 bounded context 依赖
- `local-architecture/no-types-to-core-imports`
  - 阻止 types 依赖 core

## 当前扫描结果

### Types -> Core

命令：

```bash
rg -n "from ['\"](@src/|src/)?core/|from ['\"]@core/|import\\(['\"](@src/|src/)?core/|require\\(['\"](@src/|src/)?core/" src/types -g '*.ts'
```

P3b 第一批已处理：

- `src/types/errors/exception-payload.types.ts` 不再依赖 `@core/common/errors`。
- `local-architecture/no-types-to-core-imports` 已移除该文件的 legacy allowlist。

### Boundary Port / Transaction Alias

命令：

```bash
rg -n "type\\s+\\w*TransactionManager\\s*=|interface\\s+\\w*TransactionManager|TransactionPort|UnitOfWork|\\.ports?\\.ts|from ['\"].*\\.ports?|transaction-runner\\.port" src -g '*.ts'
```

结果：

- legacy core `.ports.ts`：
  - `src/core/pagination/pagination.ports.ts`
  - `src/core/search/search.ports.ts`
  - `src/core/sort/sort.ports.ts`
- legacy transaction alias：
  - `AccountTransactionManager`
  - `VerificationRecordTransactionManager`
  - `AsyncTaskRecordTransactionManager`
- 多处现有代码仍 import legacy core `.ports.ts`。

处理：

- 当前白名单只允许这些既有 legacy。
- 新增同类文件、import 或 alias 会被 ESLint 拦截。
- P3a/P3b 再决定是否迁移为 `*.contract.ts` 和 transaction context。

### Cross-Domain Modules

命令：

```bash
rg -n "from ['\"](@src/modules/|@modules/|src/modules/)" src/modules -g '*.ts'
```

当前代表性结果：

- `auth` 依赖 `account`
- `register` 依赖 `account` / `third-party-auth`
- `third-party-auth` 依赖 `account` entity
- `verification-record` 依赖 `account`
- `account` / `verification-record` 依赖 `modules/common`

处理：

- `business -> common` 可接受。
- `business -> business` 和 `common -> business` 进入 P3a inventory。
- 不在 P2 中直接开启 `no-cross-domain-modules-imports`，否则当前主干会被既有问题阻塞。

### Entity Purity

命令：

```bash
rg -n "@(ObjectType|Field|InputType|ArgsType|InterfaceType)|@ApiProperty|@nestjs/graphql|@nestjs/swagger|class-validator|class-transformer" src/modules src/core src/infrastructure -g '*entity.ts' -g '*.entity.ts'
```

结果：

- `src/modules/account/base/entities/user-info.entity.ts` 仍 import `@nestjs/graphql` 并使用
  `@Field`。

处理：

- 进入 P3a inventory。
- P3b 迁出到 GraphQL DTO，不在 P2 修实体。

### QueryService -> Mixed Service

命令：

```bash
rg -n "from ['\"].*(\\.service|/services/|@modules/|@src/modules/)" src/modules -g '*query.service.ts'
```

当前代表性结果：

- `permission.query.service.ts` 依赖 `AccountService`
- `verification-record.query.service.ts` / `consumable.query.service.ts` 依赖 `verification-read.service`

处理：

- 进入 P3a inventory。
- P3b 再按同域 read repository / QueryService / stable View 拆分。
- P3b 第二批已将 `async-task-record.query.service.ts` 改为同域 repository 读侧实现，不再依赖
  `AsyncTaskRecordService`。
- P3b 第三批已将 `account.query.service.ts` 改为同域 repository 读侧实现，不再依赖
  `AccountService` / `AccountTransactionManager`。
- P3b 第四批已将 `ThirdPartyAuthEntity` 迁回 `third-party-auth` 模块，并移除对 account entity
  的 ORM relation。
- P3b 复核确认 `verification-read.service` 当前无写入、无事务入口，属于同域 read implementation；
  后续可作为命名或扫描降噪处理。

## 验证结果

- `npm run typecheck` 通过。
- `npx eslint "{src,apps,libs,test}/**/*.ts" --cache --cache-location .eslintcache` 通过。
- `git diff --check` 通过。

额外检查：

- `npm run lint:usecase-normalize-guard` 当前失败。
- 失败点在 `src/usecases/account/fetch-user-info.usecase.ts` 的历史手工 filter / Set 去重。
- 这不是 P2 新增 architecture lint 造成的问题，也不是本阶段分层验证阻塞项。
- 若后续要求 `npm run lint` 全量通过，应单独收口该 normalize guard 债务。

## 下一步

- P3a 基于本文件扫描结果输出真实分层违规 inventory。
- P3b 再按 inventory 分批修复，不在 P2 混入大规模代码迁移。
