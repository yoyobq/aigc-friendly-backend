<!-- docs/common/capability.rules.md -->

Purpose: Define semantic capability boundaries, code anchors, runtime contributions, and the human observation window.
Read when: Adding, splitting, merging, installing, disabling, or reviewing a capability, or changing capability runtime, providers, queues, operations, or session/API contributions.
Source of truth: Semantic decisions live in `docs/capabilities/*.md`; installed anchors and runtime contributions live in Nest provider metadata and are observed through the API/Worker module graphs.

# Capability Rules

## Governing Principle

- Derive facts that the module graph or runtime registry already knows.
- Declare only decisions that code or validation executes.
- Keep semantic explanation in stable capability decision documents, not provider metadata.
- Capability is a vertical functional boundary over the existing horizontal layers. It does not create another layer or relax any layer rule.

A delivery plan may establish or migrate a capability boundary. Once the boundary is current, record it under `docs/capabilities/` and point the code anchor to that stable decision. Files under `plans/` remain temporary execution material and never become permanent rule sources.

## Semantic Boundary

A capability owns a recognizable business fact, lifecycle, rule set, product outcome, or independently operated technical resource. Facts and their change reasons define business boundaries; module placement, dependency shape, deployment topology, and migration convenience do not.

Composition usecases, reports, prefills, transactions, dispatchers, facades, and consumers are not capabilities merely because they call several capabilities. Remove the candidate's dependencies during review: if no independently recognizable fact, lifecycle, outcome, or operated resource remains, model it as composition rather than assigning another capability ID.

Use [Capability Boundary Examples](./capability-boundary-examples.md) when this distinction is unclear. The current semantic decisions are listed in [Current Capability Decisions](../capabilities/current.md).

## Capability Anchor

Every installed capability has one minimal `@CapabilityAnchorProvider(...)` decision anchor:

- `capabilityId`: stable lowercase dotted join key.
- `mode`: `always-on` or `switchable`; the runtime state reader executes this decision.
- `decisionRef`: repository-relative `docs/capabilities/*.md` path containing a level-two heading whose code-formatted text is the exact capability ID.

The anchor is registered as a Nest provider in one entry module. API/Worker process membership and the entry module are derived from root-module reachability and must not be repeated in metadata. The same entry module may be reachable from both processes.

`always-on` and `switchable` are independent of whether a runtime contribution exists. An always-on capability may expose operations or resources. A switchable capability may be installed in multiple processes while contributing runtime resources in only some of them.

Do not add summaries, non-goals, file paths, public surfaces, process lists, dependency allowlists, or validation commands to the anchor unless an executable consumer is first introduced for that exact decision.

## Runtime Contribution

`@CapabilityRuntimeContributionProvider(...)` is optional. It declares only runtime facts consumed or validated by the registry:

- required or optional same-process runtime dependencies;
- commands, queries, and events;
- default runtime state and health-check requirement;
- provider, queue, session, and API contributions.

Every contribution requires the same capability anchor in that process. Required dependencies must be installed in that process and form no cycle. Declared handlers, provider bindings, queue bindings, health checks, session resolvers, and API operations must match the contribution.

There is no contribution-level version. Keep `version` only on an operation when the capability envelope needs `operationVersion` compatibility.

Provider and queue registries remain authoritative for concrete provider names, queue names, job names, and payload contracts. Runtime contribution metadata joins and validates those registries; it does not copy or replace them.

## Runtime State

- No current-process anchor means `not_installed`.
- `always-on` is enabled regardless of disabled IDs, kill switches, or contribution default state.
- `switchable` applies kill switch, disabled ID, contribution default state, and operation-disabled configuration in that order.
- Configured disabled or kill-switch IDs that are absent from the current process emit a startup warning.
- Configured disabled or kill-switch IDs that target `always-on` emit a startup warning because the configuration is ignored.
- Disabling a capability changes execution state. It does not delete data or remove GraphQL schema dynamically.

## Calls And Transports

- Same-capability calls remain ordinary usecase-to-module calls unless runtime governance is needed.
- Cross-capability business calls use narrow typed `*.contract.ts` clients; business code does not write raw dispatcher strings.
- Infrastructure implementations may wrap the capability command/query bus.
- API-to-Worker work uses the declared queue transport. In-process transport never crosses a process boundary.
- Dispatcher calls do not inherit a cross-capability transaction automatically. Callers define idempotency, compensation, and failure semantics.

## Human Observation Window

`npm run capability:list` is the single interactive view. It shows only:

- ID and mode;
- effective default state;
- derived entry module and installed processes;
- processes with runtime contributions and their declared resources;
- the semantic decision reference.

`npm run capability:docs` regenerates `docs/generated/capabilities-current.md`; `npm run capability:docs:check` verifies it. The projection is calculated from installed Nest graphs and must never be hand-edited.

This model intentionally does not claim a generated file-level boundary view. The entry module is a navigation seed, while semantic scope comes from the decision document and code responsibilities continue to come from horizontal layer rules. Human review of the decision, code, and behavior tests remains the accountability boundary.

## Validation

- Anchor IDs are valid and unique in each process.
- Each observed ID resolves to one entry module.
- Every `decisionRef` stays under `docs/capabilities/`, exists, and contains the exact capability heading.
- Runtime topology validation runs both at bootstrap and in the observation command.
- Only behavior or decisions with an executable validation loop belong in metadata.
