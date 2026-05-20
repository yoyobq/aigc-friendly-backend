<!-- docs/common/eslint-architecture-rules.md -->

Purpose: Map architecture rules in docs to the ESLint checks that enforce them.
Read when: You need to verify whether layer, type, boundary contract, or transaction rules are automatically checked.
Do not read when: You only need behavior tests or API contract details.
Source of truth: `eslint.config.mjs` is the executable source of truth; this file is the human index.

# ESLint Architecture Rules

## How To Run

- File-scoped architecture check:
  `npx eslint <path>`
- Full lint:
  `npm run lint`
  This also runs `scripts/check-usecase-normalize-guard.js` first and then ESLint with `--fix`.
- No-fix full ESLint check:
  `npx eslint "{src,apps,libs,test}/**/*.ts" --cache --cache-location .eslintcache`
- Type-level confidence:
  `npm run typecheck`

Prefer `npx eslint <path>` or the no-fix full command while investigating because `npm run lint`
performs an automatic `--fix` pass.

## Current Rule Map

- `boundaries/dependencies`
  Enforces the main layer dependency matrix currently modeled in `eslint.config.mjs`:
  adapters -> usecases/core/types, usecases -> modules queries/services/core/types,
  modules services -> infrastructure/core/types, modules queries -> same-domain queries/core/types,
  infrastructure -> infrastructure/core/types, core -> core/types, types -> types.
  This is still coarser than the target governance model; use the review rules below for uncovered
  aggregate, entity, QueryService, boundary contract, and transaction details.

- `local-architecture/no-boundary-port-naming-drift`
  Blocks new `*.port.ts` / `*.ports.ts` boundary files and imports.
  Also blocks `TransactionPort` / `UnitOfWork` naming drift.
  Current legacy core `pagination/search/sort` `.ports.ts` files are allowlisted until P3 migration.

- `local-architecture/no-transaction-manager-alias`
  Blocks new local `*TransactionManager` aliases/interfaces in usecases and modules.
  Current legacy aliases in account, verification-record, and async-task-record are allowlisted until
  transaction boundary migration.

- `local-architecture/no-usecase-transaction-manager-orm-api`
  Blocks usecases from directly calling ORM APIs on transaction contexts, such as `save`,
  `getRepository`, `createQueryBuilder`, `insert`, `update`, `delete`, and `query`.

- `local-architecture/no-infrastructure-to-modules-imports`
  Blocks infrastructure importing `src/modules/**` implementation files.
  Module-owned contract exceptions are not modeled in the old project yet; if module-owned contracts
  are introduced, update this rule and this document together.

- `local-architecture/no-cross-domain-usecases-imports`
  Blocks usecases importing other usecase bounded contexts.
  Same-domain usecase module wiring remains allowed.

- `local-architecture/no-types-to-core-imports`
  Blocks `src/types/**` from importing `src/core/**`.
  There is no current allowlist for this rule.

- `no-restricted-imports`
  Blocks direct `src/types/**`, `@src/types/**`, and `**/src/types/**` imports.
  Shared global types must use `@app-types/*`.
  In `src/core/**`, it also blocks framework/runtime imports such as `@nestjs/*`, `graphql`,
  and `typeorm`.

- `@typescript-eslint/no-explicit-any`
  Blocks `any` in source code covered by the main ESLint config.

- Type-aware strictness rules
  Current config enables `no-floating-promises`, `no-unsafe-argument`, `no-unsafe-assignment`,
  `no-unsafe-call`, `no-unsafe-member-access`, `no-unsafe-return`, and `no-unused-vars`.

- Complexity and size warnings
  Current config warns on function complexity, max depth, and max lines per function.

- `scripts/check-usecase-normalize-guard.js`
  Runs before project lint through `npm run lint`.
  It is not an ESLint rule, but it is part of the repository lint gate.

## Not Yet Enforced By ESLint

These rules are documented review rules in the current project unless and until matching lint rules are added:

- Module-owned `*.contract.ts` exceptions and detailed contract dependency modeling.
- Aggregate child-entity direct writes outside the aggregate root entry.
- ORM Entity purity, including accidental GraphQL / HTTP / Swagger / adapter decorators.
- Adapter type-only import exceptions for bounded-context root `*.types.ts`.
- QueryService depending on mixed read/write services.
- Cross-domain modules imports.
- Infrastructure runtime contract naming drift such as BullMQ payload files using layer boundary
  `*.contract.ts` naming.

Do not treat missing lint coverage as permission to violate the docs.

## Supplemental Scans

Run these when preparing P3a inventory or reviewing architecture-sensitive patches.

- Types importing core:
  `rg -n "from ['\"](@src/|src/)?core/|from ['\"]@core/|import\\(['\"](@src/|src/)?core/|require\\(['\"](@src/|src/)?core/" src/types -g '*.ts'`
- Boundary port / transaction alias drift:
  `rg -n "type\\s+\\w*TransactionManager\\s*=|interface\\s+\\w*TransactionManager|TransactionPort|UnitOfWork|\\.ports?\\.ts|from ['\"].*\\.ports?|transaction-runner\\.port" src -g '*.ts'`
- Cross-domain modules imports:
  `rg -n "from ['\"](@src/modules/|@modules/|src/modules/)" src/modules -g '*.ts'`
- ORM Entity adapter decorators:
  `rg -n "@(ObjectType|Field|InputType|ArgsType|InterfaceType)|@ApiProperty|@nestjs/graphql|@nestjs/swagger|class-validator|class-transformer" src/modules src/core src/infrastructure -g '*entity.ts' -g '*.entity.ts'`
- QueryService depending on mixed read/write services:
  `rg -n "from ['\"].*(\\.service|/services/|@modules/|@src/modules/)" src/modules -g '*query.service.ts'`
- Usecase direct ORM calls on transaction-like values are enforced by ESLint; broad text scans for
  `.update()` or `.query()` are noisy and should not be used as the primary signal.

## Notes

- Tests have a relaxed override for some strictness rules; do not infer production architecture exceptions from test-only imports.
- Runtime checks not implemented in ESLint may still be documented in rule files.
- If a document says "ESLint blocks" a rule, keep this index and `eslint.config.mjs` aligned.
