<!-- 文件位置: plans/layered-governance-p3a-inventory.md -->

# Layered Governance P3a Inventory

## 状态

P3a 已完成，日期：2026-05-21。

本文件只盘点旧项目当前代码相对新分层治理规则的真实违规点，不在本阶段修复代码。
P3b 应按本 inventory 分批修复。

## 输入

- P1 文档对齐产物：[layered-governance-alignment-plan.md](./layered-governance-alignment-plan.md)
- P2 验证口径：[layered-governance-p2-validation.md](./layered-governance-p2-validation.md)
- 规则入口：
  - `docs/common/eslint-architecture-rules.md`
  - `docs/common/modules.rules.md`
  - `docs/common/queryservice.rules.md`
  - `docs/common/usecase-write-flow-boundaries.rules.md`
  - `docs/common/entity.rules.md`
  - `docs/common/type.rules.md`
  - `docs/common/boundary-contract.rules.md`

## 总结

当前没有发现新的 P0 阻塞项：

- `npm run typecheck` 通过。
- no-fix ESLint 通过。
- adapter 未直接依赖 modules / infrastructure。
- 下游层未依赖 adapters。
- core 未发现框架、ORM、配置、I/O 依赖。
- infrastructure 未发现依赖 modules 实现。
- usecases 未发现跨 bounded context usecase import。

真实分层债务集中在：

- transaction boundary legacy。
- business modules 跨域依赖。
- QueryService 依赖混合读写 service 或跨域 entity。
- legacy `*.ports.ts` 命名。

P3b 已处理：

- `src/types/errors/exception-payload.types.ts` 不再依赖 core。
- `src/modules/account/base/entities/user-info.entity.ts` 已移除 GraphQL decorator。
- `src/modules/async-task-record/queries/async-task-record.query.service.ts` 不再依赖混合读写
  `AsyncTaskRecordService`，读侧已改为同域 repository 实现。
- `src/modules/account/queries/account.query.service.ts` 不再依赖混合读写 `AccountService`
  或 `AccountTransactionManager`，读侧已改为同域 repository 实现。
- `ThirdPartyAuthEntity` 已从 `account/base/entities` 迁回 `third-party-auth` 模块，
  并移除对 `AccountEntity` 的 ORM relation，保留 `accountId` 字段契约。

## P1 级问题：应优先修复

### 1. Transaction boundary 仍由 modules(service) 持有

规则：

- `docs/common/usecase-write-flow-boundaries.rules.md`
- `docs/common/modules.rules.md`
- `docs/common/boundary-contract.rules.md`

现状：

- `src/modules/account/base/services/account.service.ts`
  - `AccountTransactionManager = EntityManager`
  - `AccountService.runTransaction()`
- `src/modules/verification-record/verification-record.service.ts`
  - `VerificationRecordTransactionManager = EntityManager`
  - `VerificationRecordService.runTransaction()`
- `src/modules/async-task-record/async-task-record.service.ts`
  - `AsyncTaskRecordTransactionManager = EntityManager`
  - `AsyncTaskRecordService.runTransaction()`

主要调用点：

- `src/usecases/registration/register-with-email.usecase.ts`
- `src/usecases/registration/weapp-register.usecase.ts`
- `src/usecases/account/create-account.usecase.ts`
- `src/usecases/account/update-visible-user-info.usecase.ts`
- `src/usecases/verification/consume-verification-flow.usecase.ts`
- `src/usecases/verification-record/consume-verification-record.usecase.ts`
- `src/usecases/verification/password/reset-password.usecase.ts`
- `src/usecases/verification/types/consume.types.ts`

建议修复：

- 引入目标 `TransactionRunner` / transaction context 口径。
- usecase 持有事务入口。
- modules(service) 只接收 transaction context。
- 移除给上层使用的 `*TransactionManager = EntityManager` alias。
- 先处理 account / verification，再处理 async-task-record。

### 2. Business modules 存在跨域依赖

规则：

- `docs/common/modules.rules.md`
- `docs/common/usecase.rules.md`

扫描命令：

```bash
rg -n "from ['\"](@src/modules/|@modules/|src/modules/)" src/modules -g '*.ts'
```

代表性问题：

- `src/modules/auth/auth.module.ts` 依赖 `AccountInstallerModule`。
- `src/modules/auth/strategies/jwt.strategy.ts` 依赖 `AccountService`。
- `src/modules/auth/queries/permission.query.service.ts` 依赖 `AccountService`。
- `src/modules/register/register.module.ts` 依赖 `AccountInstallerModule` 与 `ThirdPartyAuthModule`。
- `src/modules/verification-record/verification-record.module.ts` 依赖 `AccountInstallerModule`。

可接受项：

- business modules 依赖 `src/modules/common/*` 属于允许方向。
- `src/modules/third-party-auth/*` 对 account entity 的依赖已在 P3b 第四批修复。

建议修复：

- 跨域读取上提到 usecase。
- 需要稳定读模型时，由被读域提供 QueryService / stable View。
- module assembly 不应把业务域模块直接串成隐式依赖网。

### 3. QueryService 依赖混合读写 service 或跨域 entity

规则：

- `docs/common/queryservice.rules.md`
- `docs/common/modules.rules.md`

扫描命令：

```bash
rg -n "from ['\"].*(\\.service|/services/|@modules/|@src/modules/)" src/modules -g '*query.service.ts'
```

问题：

- `src/modules/account/queries/account.query.service.ts`
  - 状态：P3b 第三批已修复。
  - 原问题：依赖混合读写 `AccountService` 与 `AccountTransactionManager`。
- `src/modules/auth/queries/permission.query.service.ts`
  - 依赖 `AccountService`
- `src/modules/third-party-auth/queries/third-party-auth.query.service.ts`
  - 状态：P3b 第四批已修复。
  - 原问题：依赖 account 内部 entity。
- `src/modules/verification-record/queries/verification-record.query.service.ts`
  - 状态：P3b 复核后暂不作为 P1 阻塞。
  - 说明：`VerificationReadService` 当前无写入、无事务入口，是同域 read implementation；
    后续可作为命名/扫描降噪收口。
- `src/modules/verification-record/queries/consumable.query.service.ts`
  - 状态：P3b 复核后暂不作为 P1 阻塞。
  - 说明同上。
- `src/modules/async-task-record/queries/async-task-record.query.service.ts`
  - 状态：P3b 第二批已修复。
  - 原问题：依赖混合读写 `AsyncTaskRecordService`。

建议修复：

- QueryService 下游优先依赖同域只读 repository / read implementation /同域 entity。
- 不依赖混合读写 service。
- 跨域读取上提到 usecase。
- 事务内只读参数使用 transaction context，不复用 service transaction alias。

### 4. ORM Entity 混入 GraphQL decorator

状态：P3b 第一批已修复。

规则：

- `docs/common/entity.rules.md`
- `docs/api/adapters.rules.md`

扫描命令：

```bash
rg -n "@(ObjectType|Field|InputType|ArgsType|InterfaceType)|@ApiProperty|@nestjs/graphql|@nestjs/swagger|class-validator|class-transformer" src/modules src/core src/infrastructure -g '*entity.ts' -g '*.entity.ts'
```

原问题：

- `src/modules/account/base/entities/user-info.entity.ts`
  - import `@nestjs/graphql`
  - 使用 `@Field`

建议修复：

- 移除 entity 上的 GraphQL decorator。
- 确认 adapter DTO 已覆盖对外字段。
- 不改变数据库字段、索引、迁移语义。

### 5. `src/types` 依赖 core

状态：P3b 第一批已修复。

规则：

- `docs/common/type.rules.md`
- `docs/common/eslint-architecture-rules.md`

原问题：

- `src/types/errors/exception-payload.types.ts`
  - import `DomainErrorCode` from `@core/common/errors`

建议修复：

- 若 `DomainErrorCode` 是稳定跨层 contract，应上收到 `src/types`。
- 或者将 exception payload colocate 到 adapter / infrastructure，不再放在 `src/types`。
- 修复后移除 P2 ESLint 白名单。

## P2 级问题：legacy 命名与后续收口

### 1. Core legacy `*.ports.ts`

规则：

- `docs/common/boundary-contract.rules.md`
- `docs/common/core.rules.md`

现状：

- `src/core/pagination/pagination.ports.ts`
- `src/core/search/search.ports.ts`
- `src/core/sort/sort.ports.ts`

现有依赖：

- `src/infrastructure/security/hmac-signer.ts`
- `src/infrastructure/typeorm/pagination/typeorm-paginator.ts`
- `src/infrastructure/typeorm/search/typeorm-search.ts`
- `src/infrastructure/typeorm/sort/typeorm-sort.ts`
- `src/modules/common/pagination.service.ts`
- `src/modules/common/search.module.ts`

建议修复：

- 若仍是 core-owned boundary contract，迁移为 `*.contract.ts`。
- 若只是算法/类型，改为 `*.types.ts` 或纯 helper。
- 修复后移除 ESLint legacy allowlist。

### 2. `lint:usecase-normalize-guard` 既有失败

命令：

```bash
npm run lint:usecase-normalize-guard
```

当前失败：

- `src/usecases/account/fetch-user-info.usecase.ts`
  - 手工 `filter(...length > 0)`
  - 手工 `new Set(...)` 去重

说明：

- 这不是 P3a 分层违规主线。
- 但它会阻止 `npm run lint` 全量通过。
- 若后续收口要求 `npm run lint`，需要单独修复。

## 未发现问题的边界

### Adapter 边界

扫描命令：

```bash
rg -n "from ['\"](@src/modules/|@modules/|src/modules/)|from ['\"](@src/infrastructure/|@infrastructure/|src/infrastructure/)" src/adapters -g '*.ts'
```

结果：无匹配。

### 下游依赖 adapters

扫描命令：

```bash
rg -n "from ['\"](@src/adapters/|@adapters/|src/adapters/)" src/usecases src/modules src/core src/infrastructure src/types -g '*.ts'
```

结果：无匹配。

### Core 纯度

扫描命令：

```bash
rg -n "@nestjs/|graphql|typeorm|ConfigService|process\\.env|DataSource|Repository|Injectable|Module\\(" src/core -g '*.ts'
```

结果：无匹配。

### Infrastructure -> Modules

扫描命令：

```bash
rg -n "from ['\"](@src/|src/)?modules/|from ['\"]@modules/|import\\(['\"](@src/|src/)?modules/|require\\(['\"](@src/|src/)?modules/" src/infrastructure -g '*.ts'
```

结果：无匹配。

### Cross-domain Usecase Import

P2 ESLint 已覆盖。

`npx eslint "{src,apps,libs,test}/**/*.ts" --cache --cache-location .eslintcache` 当前通过。

### Usecase direct ORM API on transaction context

P2 ESLint 已覆盖。

当前 no-fix ESLint 通过。宽泛文本扫描会把 `createHash().update()` 误判成 ORM `update()`，不作为主信号。

## P3b 建议批次

1. `type/error` 小切口：已完成。
2. `entity purity` 小切口：已完成。
3. `queryservice read split`：
   account / async-task-record / third-party-auth 已完成；auth 属于跨域依赖，应单独批次处理。
4. `modules cross-domain`：
   处理 auth / register / third-party-auth / verification-record 对 account 或其他业务模块的直接依赖。
5. `transaction boundary`：
   引入目标 transaction context / runner 后，分 account、verification、async-task-record 三批迁移。
6. `legacy core ports`：
   在依赖面稳定后迁移 `*.ports.ts` 命名。

## 验证

- `npm run typecheck` 通过。
- `npx eslint "{src,apps,libs,test}/**/*.ts" --cache --cache-location .eslintcache` 通过。
- `git diff --check` 通过。
