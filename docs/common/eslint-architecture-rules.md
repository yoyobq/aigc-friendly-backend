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
  This first runs `scripts/check-usecase-normalize-guard.js` and the architecture lint fixtures,
  then ESLint with `--fix`.
- No-fix full ESLint check:
  `npx eslint "{src,apps,libs,test}/**/*.ts" --cache --cache-location .eslintcache`
- Type-level confidence:
  `npm run typecheck`

Prefer `npx eslint <path>` or the no-fix full command while investigating because `npm run lint`
performs an automatic `--fix` pass.

## Rule Map

- `boundaries/dependencies`
  Enforces the main layer dependency matrix:
  adapters -> usecases/core/types, usecases -> modules/core/types,
  modules -> same-domain/common/core/types/infrastructure, infrastructure -> infrastructure/core/types,
  core -> core/types, types -> types.
  Module-owned `*.contract.ts` files are modeled separately so usecases/modules/infrastructure may
  depend on the contract without allowing imports of module services or internals.
  Usecase-owned `*.contract.ts` files are also modeled separately so usecases/infrastructure may
  depend on the narrow contract without exposing usecase implementations.
  `modules-contracts` must not depend on same-domain services, queries, or internals; contracts
  should only reference other contracts, stable module types, core contracts/types, or `@app-types/*`.
  It also allows adapters to `import type` same-domain module root `*.types.ts` files only.
  Runtime enum values needed by GraphQL DTO decorators or schema registration should therefore come
  from `types` / `@app-types/*` or adapter-local GraphQL-only enums, not from module root type files.
  TypeScript aliases and extensionless imports are resolved through `eslint-import-resolver-typescript`;
  architecture fixtures cover both forms so resolver regressions cannot silently disable the matrix.
  Module files are categorized as contracts/tokens, types, queries, Nest wiring, services, pure
  rules, capability gates, internal runtime support (including codecs/helpers), or other internals.
  Ordinary usecases cannot import Nest wiring or runtime support. Same-domain and common pure rules
  are reusable; cross-domain pure-module imports are rejected. Pure rules cannot import services,
  ORM entities or infrastructure. Framework/I/O imports and implicit clock/random/config reads
  receive additional checks; semantic purity and contract implementations still require review.
  Only adapter wiring imports usecase wiring. Guards may invoke usecases; shared schema, decorators
  and mappers may not. Cross-scope GraphQL DTO imports have no file allowlist.
  The matrix checks imports, re-exports, require and dynamic imports. Dependency fixtures exercise
  both accepted usage and forbidden paths. Capability admission and operation gates remain governed
  separately by accepted capability decisions and behavior tests.

- `local-architecture/no-infrastructure-to-usecases-imports`
  Blocks infrastructure importing usecase implementations, modules, helpers, barrels, or scene-local
  types. The only path-level exception is a usecase-owned `*.contract.ts`; code review still confirms
  that the importer actually implements or wires that contract.

- `local-architecture/no-adapter-to-queryservice-imports`
  Blocks API and Worker adapters importing `*.query.service.ts` implementations. Adapters obtain
  read-side results through usecases.

- `local-architecture/no-adapter-types-from-usecase-implementations`
  Allows adapters to import `*Usecase` execution classes from `*.usecase.ts` and Usecases modules for
  DI assembly. Flow parameters, results, and other reusable types must use type-only imports from a
  dedicated `*.types.ts` file. The rule blocks value imports from `*.types.ts` and type imports from
  usecase helpers, normalizers, registries, contracts, or other internal files.

- `local-architecture/no-boundary-port-naming-drift`
  Blocks new `*.port.ts` / `*.ports.ts` boundary files and imports.
  Also blocks `TransactionPort` / `UnitOfWork` naming drift.
  There is no current file/import allowlist for this rule.

- `local-architecture/no-transaction-manager-alias`
  Blocks local `*TransactionManager` aliases/interfaces in usecases and modules.
  Use `PersistenceTransactionContext` instead of restoring a `TransactionManager` alias.

- `local-architecture/no-usecase-transaction-manager-orm-api`
  Blocks usecases from directly calling ORM APIs on transaction contexts, such as `save`,
  `getRepository`, `createQueryBuilder`, `insert`, `update`, `delete`, and `query`.

- `local-architecture/no-infrastructure-to-modules-imports`
  Blocks infrastructure importing `src/modules/**` implementation files.
  The only modules-layer exception is a module-owned `*.contract.ts` boundary contract.

- `local-architecture/no-cross-domain-modules-imports`
  Blocks business-domain modules importing other business-domain modules.
  Allows business-domain modules importing `src/modules/common/*`.
  Blocks `src/modules/common/*` importing business-domain modules.

- `local-architecture/no-cross-domain-usecases-imports`
  Blocks usecases importing other usecase bounded contexts.
  The shared transaction runner contract is the current allowed common boundary exception.

- `local-architecture/no-types-to-core-imports`
  Blocks `src/types/**` from importing `src/core/**`.
  Types is the stable shared contract layer and must not depend on core implementation semantics.

- `local-architecture/no-adapter-decorators-on-entities`
  Blocks ORM Entity files from importing adapter / GraphQL / HTTP / Swagger / validation /
  transformer packages or using those protocol decorators.
  Entity files must remain persistence-only and must not become GraphQL DTOs or adapter shapes.

- `local-architecture/no-graphql-schema-registration-outside-schema`
  Blocks `registerEnumType` / `registerScalarType` imports or calls outside
  `src/adapters/api/graphql/schema/`.
  GraphQL enum and scalar registration must stay centralized in the schema registry.

- `local-architecture/no-graphql-decorators-outside-adapters`
  Blocks GraphQL decorators such as `@ObjectType`, `@Field`, `@InputType`, `@Resolver`,
  `@Query`, and `@Mutation` outside `src/adapters/api/graphql/**`.
  GraphQL protocol types must stay in the adapter layer and must not leak downward.

- `local-architecture/no-queryservice-to-mixed-service-imports`
  Blocks `*.query.service.ts` files under `src/modules/**` from importing ordinary
  `*.service.ts` files or files under `services/` / `service/`.
  QueryService may depend on same-domain QueryServices, read repositories, core, types, or
  infrastructure query implementations, but not mixed read/write services.

- `local-architecture/no-upper-types-from-module-implementations`
  Blocks adapter/usecase type-only imports, mixed type specifiers and erased interface/type imports
  from module implementation files. TypeScript symbol resolution distinguishes injected runtime
  service classes from borrowed interfaces. Inline import type queries use the same boundary.
  Stable module types belong in the bounded-context `*.types.ts`; contracts retain their owning layer.

- `local-architecture/no-upstream-entity-imports`
  Blocks `src/adapters/**` and `src/usecases/**` from importing ORM `*.entity.ts` files.
  Usecases must use View, ReadModel, record snapshot, result, or stable data-shape types;
  adapters may map those shapes into adapter-owned DTOs. Neither layer may import Entity classes,
  including through type-only imports.

- `local-architecture/no-runtime-config-outside-wiring`
  Blocks direct `process.env` outside infrastructure, bootstraps, and tests.
  Blocks `@nestjs/config` imports outside infrastructure, bootstraps, tests, or adapters/modules
  `*.module.ts` DI wiring. Service / Guard / Strategy / Usecase execution classes should receive
  already-normalized options through DI tokens instead of reading ConfigService directly.

- `no-restricted-imports`
  Blocks direct `src/types/**`, `@src/types/**`, and `**/src/types/**` imports.
  Shared global types must use `@app-types/*`.
  In `src/core/**`, it also blocks framework/runtime imports such as `@nestjs/*`, `graphql`,
  `typeorm`, `express`, `class-validator`, and `class-transformer`.
  In `src/types/**`, it blocks framework/runtime/protocol imports such as `@nestjs/*`,
  `graphql`, `typeorm`, `class-validator`, and `class-transformer`.

- `@typescript-eslint/no-explicit-any`
  Blocks `any` in source code covered by the main ESLint config.

- Type-aware strictness rules
  Current config inherits `typescript-eslint` `recommendedTypeChecked`, including
  `no-unnecessary-type-assertion`, and explicitly enables `no-floating-promises`,
  `no-unsafe-argument`, `no-unsafe-assignment`, `no-unsafe-call`, `no-unsafe-member-access`,
  `no-unsafe-return`, and `no-unused-vars`.

- Complexity and size warnings
  Current config warns on function complexity, max depth, and max lines per function.

- `scripts/check-usecase-normalize-guard.js`
  Runs before project lint through `npm run lint`.
  It is not an ESLint rule, but it is part of the repository lint gate.

## Not Yet Enforced By ESLint

These rules are documented review rules in the current project unless and until matching lint rules are added:

- Aggregate child-entity direct writes outside the aggregate root entry.
- ORM Entity purity beyond adapter decorator/import and upstream Entity import checks, including
  accidental Entity output leaks from QueryServices or module services.
- Infrastructure runtime contract naming drift such as BullMQ payload files using layer boundary
  `*.contract.ts` naming.

Do not treat missing lint coverage as permission to violate the docs.

## Supplemental Scans

Run these when reviewing architecture-sensitive patches or checking existing implementations.

- Types importing core:
  `rg -n "from ['\"](@src/|src/)?core/|from ['\"]@core/|import\\(['\"](@src/|src/)?core/|require\\(['\"](@src/|src/)?core/" src/types -g '*.ts'`
- Boundary port / transaction alias drift:
  `rg -n "type\\s+\\w*TransactionManager\\s*=|interface\\s+\\w*TransactionManager|TransactionPort|UnitOfWork|\\.ports?\\.ts|from ['\"].*\\.ports?|transaction-runner\\.port" src -g '*.ts'`
- Cross-domain modules imports:
  `rg -n "from ['\"](@src/modules/|@modules/|src/modules/)" src/modules -g '*.ts'`
- ORM Entity adapter decorators:
  `rg -n "@(ObjectType|Field|InputType|ArgsType|InterfaceType)|@ApiProperty|@nestjs/graphql|@nestjs/swagger|class-validator|class-transformer" src/modules src/core src/infrastructure -g '*entity.ts' -g '*.entity.ts'`
- Upstream Entity imports:
  `rg -n "from ['\"].*\\.entity(?:\\.ts)?['\"]|import\\(['\"].*\\.entity(?:\\.ts)?['\"]\\)|require\\(['\"].*\\.entity(?:\\.ts)?['\"]\\)" src/adapters src/usecases -g '*.ts'`
- QueryService depending on mixed read/write services:
  `rg -n "from ['\"].*(\\.service|/services/|@modules/|@src/modules/)" src/modules -g '*query.service.ts'`
- Infrastructure imports from usecases (every result must be an actually implemented/wired
  `*.contract.ts` plus only its minimal signature types):
  `rg -n "from ['\"](@src/|src/)?usecases/" src/infrastructure -g '*.ts'`
- Adapter imports of QueryService implementations (expected result: none):
  `rg -n "from ['\"](@src/|src/)?modules/.*(query\\.service|/queries/)" src/adapters -g '*.ts'`
- Adapter type imports from usecase implementations are enforced by ESLint; adapter imports from
  `*.usecase.ts` should name only `*Usecase` execution classes.
- Usecase direct ORM calls on transaction-like values are enforced by ESLint; broad text scans for
  `.update()` or `.query()` are noisy and should not be used as the primary signal.

## Notes

- Tests have a relaxed override for some strictness rules; do not infer production architecture exceptions from test-only imports.
- `boundaries/dependencies` is disabled for test files because co-located tests intentionally assemble
  collaborators across production layers. Production files and architecture fixtures remain enforced.
- Tests may define local GraphQL resolver fixtures, so the GraphQL decorator placement rule is disabled
  for test files.
- Root-level CommonJS helper files under `scripts/*.js` and `test/*.js` use a non-type-checked
  ESLint override because they are runtime scripts / Jest config files outside the TypeScript
  project service.
- Runtime checks not implemented in ESLint may still be documented in rule files.
- If a document says "ESLint blocks" a rule, keep this index and `eslint.config.mjs` aligned.
