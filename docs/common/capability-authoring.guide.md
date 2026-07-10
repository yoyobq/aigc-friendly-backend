<!-- docs/common/capability-authoring.guide.md -->

Purpose: Provide the smallest implementation checklist for capability ownership and runtime metadata.
Source of truth: capability-ownership.rules.md and capability-runtime.rules.md.

# Capability Authoring Guide

## Decide Ownership First

1. Run `npm run capability:list`.
2. Name the fact, resource, policy, lifecycle, or independent product result the candidate owns.
3. Write its non-goals before adding runtime concerns.
4. If removing dependencies leaves only composition, forwarding, reporting, or deployment convenience, keep it as a usecase/read model/facade.
5. Record semantic scope, primary/transitional/shared paths, public-surface decision, allowed dependencies, foundation classification, and validation entrypoints in one `@CapabilityOwnershipProvider(...)`.

Use `platform` for base system facts/control, `technical` for independently operated technical resources, and `business` for business facts and lifecycle.

## Add Runtime Only When Needed

Add `@CapabilityRuntimeManifestProvider(...)` only for real operations, state, providers, queues, session/API contributions, or installation dependencies.

- Use the same `capabilityId` as ownership.
- Do not declare process lists; install the provider in the relevant API/Worker module.
- Install provider Runtime Manifests on or beside the provider binding/health implementation; do not register worker provider manifests through an API-shared declaration module.
- Use `runtimeDependencies` only for required/optional runtime installation.
- Keep operation handlers thin and business flow in usecases.
- Keep provider/queue implementations in infrastructure.
- Add typed clients only for real cross-capability calls.

The executable boundary example is in `test/support/capability/reference-profile.fixture.ts`: `reference.profile` owns facts and exposes a query; `BuildReferenceReportUsecase` composes the query without becoming another capability. Account registration is likewise governed as a `platform.account` usecase rather than a separate owner.

## Validate

```bash
npm run capability:list
npm run capability:docs
npm run capability:docs:check
npm run typecheck
```

Add focused registry/dispatcher/transport tests for runtime behavior. Generated capability docs are always regenerated, never hand-edited.
