<!-- docs/common/capability-plugin-authoring.guide.md -->

Purpose: Give AI agents a practical checklist for adding, changing, reviewing, or merging capability plugin code.
Read when: You are creating a new capability manifest, adding a capability contribution, wiring a capability module, or resolving capability-related merge conflicts.
Do not read when: You are changing a normal same-domain usecase or module with no capability manifest, contribution, runtime state, or transport impact.
Source of truth: `docs/common/capability-plugin.rules.md` defines the rules. This file is an execution guide and does not override those rules.

# Capability Plugin Authoring Guide

## Before Coding

1. Read `docs/common/capability-plugin.rules.md`.
2. Check the current ids with `npm run capability:list`.
3. Identify the owner bounded context.
4. Decide the capability kind:
   - `platform`: base system capability, normally only existing declarations.
   - `technical`: provider, queue, email, AI, third-party integration, or infrastructure-facing feature.
   - `business`: business domain capability with its own semantics and usecases.
5. Decide the process surface: `api`, `worker`, or both.
6. Confirm whether the change needs capability runtime at all. If the code is a normal same-domain usecase or module change, keep it in the existing layer flow.

## Manifest Checklist

Every capability manifest must provide:

- `id`: stable id used by runtime config, generated docs, dependency checks, and logs.
- `kind`: `platform`, `technical`, or `business`.
- `displayName`: human-readable name for logs and local observation.
- `version`: current capability contract version.
- `processes`: processes where the capability is assembled.

Use existing id style:

- Technical capability examples: `ai.queue`, `ai.openai`, `notification.email`, `third-party-auth.weapp`.
- Platform declaration examples: `platform.account`, `platform.auth`.

Manifest provider files should stay lightweight:

- Class declarations and decorators are fine.
- Imports should be limited to constants, types, decorators, and local declaration classes.
- Do not perform runtime I/O in manifest declaration files.
- Do not connect to database, Redis, HTTP, SDKs, or start Nest application contexts from manifest declaration files.

## Contribution Checklist

Add only the contribution types the capability actually owns.

- Provider binding:
  - Use `contributions.providers` in the manifest.
  - Add `@CapabilityProviderBindingProvider(...)` when the runtime registry must verify the implementation binding.
  - Keep external HTTP / SDK implementation in `infrastructure`.

- Queue binding:
  - Use `contributions.queues` in the manifest.
  - Add `@CapabilityQueueBindingProvider(...)` for operation to BullMQ queue/job binding.
  - Keep `queueName` and `jobName` aligned with BullMQ registries.
  - Choose `dedupKeyMapping` explicitly when deduplication matters.

- Operation:
  - Declare `operations.commands`, `operations.queries`, or `operations.events` only when the operation is a stable capability boundary.
  - Operation handlers should call usecases or usecase-owned boundaries.
  - Do not move business flow into dispatcher, registry, transport, or handler glue.

- Session:
  - Use `contributions.session.principals` for stable session principal codes.
  - Use `contributions.session.authorityClaims` for scoped authority claims.
  - Register resolver / authorizer providers when the registry requires them.
  - Keep concrete business meaning inside the owner capability.

- API surface:
  - Use `contributions.api.graphqlOperations` for GraphQL surface declaration.
  - Resolver implementation remains in adapters.
  - Resolver should call usecase, not module service or dispatcher as a general shortcut.

- Data resource:
  - Use `data.resources` and `resourceClaims` to document ownership and dependency.
  - `readShared` does not permit bypassing owner query semantics.
  - Cross-capability read should prefer owner query operation or owner usecase / QueryService path according to current layer rules.

## Typed Capability Client Checklist

When a usecase needs to call another capability's operation, create a typed client instead of injecting the raw bus.

### When to create

- Only when a usecase actually calls a cross-capability command / query.
- Same-domain usecase -> module service / QueryService calls do not need a typed client.
- Do not pre-generate clients for capabilities that are not yet called cross-domain.

### File placement

| Artifact                                    | Location                                   | Naming                            |
| ------------------------------------------- | ------------------------------------------ | --------------------------------- |
| Operation contract (payload / result types) | `src/types/<domain>/` or domain types file | `<domain>-<entity>.types.ts`      |
| Typed client interface + DI token           | `src/usecases/common/ports/`               | `<capability>-client.contract.ts` |
| Typed client implementation                 | `src/infrastructure/capability/`           | `<capability>.client.ts`          |
| Typed client DI module                      | `src/infrastructure/capability/`           | `<capability>-client.module.ts`   |

### Steps

1. Define operation contract types in `src/types/<domain>/` with `as const` capability ID and operations constants.
2. Create `<capability>-client.contract.ts` in `src/usecases/common/ports/` with a Symbol token and a narrow interface.
3. Create `<capability>.client.ts` in `src/infrastructure/capability/` that injects `CAPABILITY_COMMAND_BUS` or `CAPABILITY_QUERY_BUS` and calls `execute` / `ask` with typed payload.
4. Create `<capability>-client.module.ts` that provides the implementation and binds it to the token via `useExisting`.
5. Consumer usecase injects the typed client token, not the raw bus.
6. Typed client returns `CapabilityResult<T>`; the consumer usecase checks `.ok` and propagates errors.

### Reference

See `src/usecases/reference/` for a working pilot: `reference.profile` capability, `ReferenceProfileClient` typed client, and `BuildReferenceReportUsecase` as the consumer.

## Wiring Checklist

- Assemble capability declarations through explicit Nest module imports or providers.
- Keep `CapabilityModule` as runtime infrastructure. Do not make it import business modules.
- Keep adapters protocol-only: parse input, call usecase, map output.
- Keep write orchestration and transactions in usecases.
- Keep external SDK / HTTP / queue implementation in infrastructure.
- Keep generated docs generated. Do not edit `docs/generated/capabilities-current.md` manually.

After changing manifests or contributions, run:

```bash
npm run capability:list
npm run capability:docs
npm run capability:docs:check
```

## Merge Checklist

When merging capability-related PRs:

1. Preserve all distinct capability manifests unless ids conflict.
2. If ids conflict, stop and resolve the owner bounded context first.
3. Merge explicit Nest module assembly carefully; do not drop either side's capability declarations.
4. Check `dependsOn` after adding or removing manifest declarations.
5. Check `processes` against API / Worker assembly.
6. Check queue bindings against BullMQ queue/job registries.
7. Regenerate generated docs with `npm run capability:docs`.
8. Run `npm run capability:docs:check`.

Generated docs conflicts should be resolved by regeneration, not manual line editing.

## Validation

Use the narrowest useful validation:

```bash
npm run capability:list
npm run capability:docs:check
npm run typecheck
npm run lint
```

Add focused tests when the change affects:

- Registry validation.
- Runtime state or kill switch behavior.
- Dispatcher / bus behavior.
- Queue transport mapping.
- GraphQL capability guard.
- Session principal or authority claim contribution.

For worker behavior, also read `docs/worker/qm-worker-integration.rules.md` and use the relevant worker tests.

## Common Review Questions

- Is this actually a capability boundary, or just a normal same-domain change?
- Does the manifest owner match the bounded context owner?
- Are adapter, usecase, module, and infrastructure responsibilities still separated?
- Does any module perform cross-domain business orchestration?
- Does any adapter call module service or infrastructure implementation directly?
- Does any runtime implementation import business modules directly?
- Are config ids, queue ids, provider names, and generated docs aligned?
- Is disabled / unavailable behavior represented as capability error where it crosses capability runtime?
