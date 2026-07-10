<!-- docs/common/capability-ownership.rules.md -->

Purpose: Define semantic capability identity and ownership.
Read when: Adding, splitting, merging, naming, or moving a capability owner.
Do not read when: Changing only runtime installation, transport, provider, queue, or operation state.
Source of truth: `@CapabilityOwnershipProvider(...)` metadata on providers installed through the API or Worker Nest module graph.

# Capability Ownership Rules

## Meaning

- Capability ownership answers what functionality exists, which facts or resources it owns, and where a change belongs.
- Horizontal layers still answer technical responsibility. A capability may cross layers but never overrides their rules.
- Business ownership follows facts, lifecycle, rules, write semantics, and stable product language.
- Technical ownership follows independently installed or operated runtime resources.
- Physical placement, consumer demand, dependency cycles, QueryService reuse, and migration convenience are not ownership evidence.
- Composition usecases, reports, flows, dispatchers, facades, and runtime consumers are not capabilities by default.
- Owner-only capabilities are valid. Missing Runtime Manifest does not mean missing semantic ownership.

## Logical Catalog

- Ownership provider metadata is the logical Capability Ownership Catalog. There is no separately maintained JSON catalog.
- Each owner declares one stable `capabilityId`, `kind`, `semanticScope`, `owns`, `nonGoals`, physical scopes, public surfaces, allowed dependencies, foundation classification, and validation entrypoints.
- `owns` states recognizable facts, resources, policies, or product outcomes. It must not restate a directory name.
- `nonGoals` prevents composition and runtime concerns from silently expanding the semantic boundary.
- `physicalScopes` uses `primary`, `transitional`, or `shared-implementation`; non-primary scopes require a reason.
- `publicSurfaces` records an existing owner-facing path or an explicit `deferred` / `not-required` decision.
- `allowedDependencies` is a reviewed cross-capability collaboration allowlist. It is not evidence that the owner exists and does not contain provider selection or runtime transport relationships.
- Paths remain authoritative in the same Nest metadata and are checked against the repository; there is no second catalog or copied process list.
- Runtime metadata cannot create, merge, rename, or imply an owner.

## Placement

- Put the ownership provider in the module or usecase assembly that owns the declared semantics.
- Install it through explicit Nest module providers. Files found by a filesystem scan do not count as installed ownership.
- Owner-facing public contracts follow the existing layer and boundary-contract rules; capability metadata is not an import barrel.
- A cross-owner typed client is an access mechanism. Its consumer does not become a capability.

## Validation

- IDs are unique lowercase dotted identifiers.
- Every owner declares at least one owned fact/resource/result and at least one non-goal.
- Every physical scope, present public surface, and validation entrypoint resolves in the repository.
- Primary scopes do not overlap across owners; transitional and shared scopes are explicit.
- Every allowed dependency resolves to another installed owner and is not self-referential.
- Every Runtime Manifest references an installed owner.
- `npm run capability:list` is the single human-readable joined view.
- `npm run capability:docs` regenerates the one combined snapshot; generated output is never edited manually.
