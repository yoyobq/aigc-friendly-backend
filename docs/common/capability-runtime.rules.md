<!-- docs/common/capability-runtime.rules.md -->

Purpose: Define runtime installation, operation, transport, state, and contribution rules for owned capabilities.
Read when: Changing Runtime Manifest metadata, registry/discovery, dispatcher/bus, providers, queues, session contributions, or capability-aware API/Worker integration.
Do not read when: Deciding whether a business concept is a capability; read capability-ownership.rules.md first.
Source of truth: `@CapabilityRuntimeManifestProvider(...)` metadata and the API/Worker Nest root module graphs.

# Capability Runtime Rules

## Boundary

- Runtime Manifest answers how an already-owned capability runs. It never decides what the capability means.
- A runtime provider declares `capabilityId`, `version`, optional runtime dependencies, operations, state policy, and contributions.
- Process membership is derived from reachability from `ApiModule` and `WorkerModule`; do not repeat `processes` in metadata.
- Runtime dependencies describe required installation, not semantic ownership. Required dependencies must be installed in the same process and form no cycle.
- Owner-only capabilities need no Runtime Manifest. Every Runtime Manifest must resolve to one ownership provider.
- Runtime Manifest installation follows the executable implementation. Provider manifests are installed with their binding and health check; queue manifests are installed with their queue binding.
- Ownership and Runtime Manifest providers may be assembled by different Nest modules and may have different process reachability.
- Registry/discovery/bootstrap checks belong to infrastructure and inspect only providers installed in the current Nest container.

## Layers And Calls

- Adapters parse protocol input, call usecases, and map output. They do not use the dispatcher as a general entry point.
- Usecases retain orchestration, permissions, transactions, cross-domain coordination, and write semantics.
- Modules retain same-domain reusable services and persistence encapsulation.
- Dispatcher/bus is a usecase-owned runtime boundary for optional installation, state, transport, and stable operation contracts.
- Same-capability calls stay ordinary usecase-to-module calls unless runtime governance is genuinely required.
- Cross-capability business calls use a narrow typed client contract; the infrastructure implementation may wrap the command/query bus.
- Typed clients return `CapabilityResult<T>` and do not own orchestration or transaction semantics.
- Cross-capability commands do not inherit the caller's transaction automatically.

## State And API

- Installation state comes from Nest assembly; runtime disablement and kill switches come from configuration/runtime policy.
- Platform manifests with `disableable: false` remain enabled.
- Disabling a capability or operation returns a stable capability error and does not delete data or dynamically remove GraphQL schema.
- Health failure does not automatically imply disabled state.
- API contributions are declarations for validation and permission projection; resolvers remain adapters.
- Session principals and authority claims use globally stable codes; business scope decisions remain with the owner.

## Operations And Transport

- Operations are stable runtime boundaries, not a wrapper around every method.
- Operation handlers call usecases or usecase-owned boundaries; registry and transport code do not contain business flows.
- In-process transport invokes only operations installed in the current process.
- API/Worker collaboration uses BullMQ queue transport until a real independent deployment boundary requires another adapter.
- Queue binding maps `capabilityId + operation + operationKind` to the existing queue/job registries.
- Queue envelopes retain request context, trace/request IDs, idempotency/dedup keys, payload, and creation time.
- Events publish facts or asynchronous effects; synchronous results use commands or queries.

## Validation And Observation

- Registry and CLI share process-topology validation for installed ownership, manifests, dependencies, handlers, bindings, health checks, and contributions.
- `npm run capability:list` joins ownership and runtime and derives API/Worker membership from the root module graphs.
- `npm run capability:docs` writes `docs/generated/capabilities-current.md`.
- `npm run capability:docs:check` fails when that generated projection is stale.
- Build and lint invoke the same check; a generated projection cannot be green while application topology is invalid.
- There are no public `--view`, `--process`, or output-format switches.
