Purpose: Define admission, granularity, ownership and verification of cross-capability consumer promises.
Read when: Adding or changing a cross-capability business dependency, its public surface or its consumer expectations.
Source of truth: This file governs collaboration agreements. Layer rules still govern dependencies; accepted capability decisions and API current contracts govern business meaning.

# Capability Collaboration Agreement

## Meaning And Admission

A Capability Collaboration Agreement records the stable promises a consumer capability relies on
from a provider capability. It is a governance and verification unit, not a layer, runtime component,
boundary contract, new capability, or permission to reverse dependencies.

Create an agreement when all of the following hold:

- the consumer and provider are existing, accepted capabilities;
- a real consumer depends on business meaning, state, failure or side-effect semantics beyond field types;
- a provider change could preserve its own local correctness while breaking that consumption;
- the public consumption path and scenarios that can verify the promises are identifiable.

One consequential consumer is sufficient. Call count, file count and the number of consumers are not
admission thresholds. Ordinary utility reuse, shared types and same-capability calls do not qualify
by themselves. Introduce agreements when real work exposes this need; do not inventory every call.

## Granularity

The unit is **one consumer × one provider × one cohesive set of promises that evolve together**.

- Group multiple methods or entrypoints when they serve the same consumption purpose and rely on
  the same semantics. Preflight and generation may share an agreement.
- Missing data, unavailable capabilities, conflicts and failures are scenarios within the agreement,
  not separate agreements.
- Split independent consumption purposes, write semantics or lifecycles even for the same pair of
  capabilities. A local history read and an upstream refresh need not evolve together.
- Evaluate each provider relationship in a multi-capability workspace; do not create one agreement
  for an entire page, bounded context or business workflow.
- Do not recursively copy the provider's prerequisite agreements or implementation details. Identify
  prerequisites that can affect the promises when choosing regression scope.

Use one practical check: can these promises be explained and reviewed together when their meaning
changes? Neither one agreement per method nor one agreement per capability pair is an absolute rule.
Merge redundant agreements; split only when independent change reasons are demonstrated.

## Ownership And Authority

- The consumer owns the consumption purpose, relied-on expectations and consumer scenario tests.
- The provider owns its public capability's meaning and facts. Agreements reference its accepted
  decisions instead of independently redefining those semantics for each consumer.
- An agreement records expectations supported by accepted decisions or current contracts. When a
  proposed expectation changes a promise, resolve the owning decision first. A consumer cannot
  unilaterally impose semantics on the provider.
- Applicable layer rules remain binding. An agreement neither creates an infrastructure import
  exception nor allows module cross-domain orchestration or adapter access to modules.
- Boundary contracts retain their existing layer ownership and `*.contract.ts` convention. An
  agreement can be implemented through an existing Service, QueryService or narrow contract; do not
  create an interface, token, facade or source-file suffix merely to represent the agreement.
- Agreements do not change capability ownership, mode, `requires`, authorization or runtime health.
  Existing capability decision authority and rule precedence still apply.

## Record And Discovery

Store an agreement at `docs/collaborations/<consumer-id>/<provider-id>--<purpose>.md`, using the
accepted dotted IDs and a short business-purpose slug. No separate agreement ID or version is needed.
Each agreement contains only:

1. consumer, provider and consumption purpose;
2. accepted semantic sources and the existing public entrypoint;
3. the minimum relied-on promises;
4. missing/unavailable/failure behavior and permitted side effects;
5. executable scenarios, test entrypoints and what they actually prove;
6. change triggers that require revalidation.

Both capability decision documents link to the agreement so edits on either side can discover it.
Keep those links short; test commands and public entrypoint details belong in the agreement, not in
capability Anchor metadata or duplicated decision inventories.

Do not copy full type definitions, algorithm descriptions or file ownership lists. Do not introduce
an ownership catalog, runtime manifest, agreement registry, generated dispatcher or parallel
prerequisite graph. Unimplemented work stays in plans/followups; evidence that has not been obtained
must not be represented as verified behavior.

Maintain one current account of coverage, known limits and executable entrypoints. Update it when
evidence changes instead of appending delivery-by-delivery verification logs. Retain concise evidence
of the assertions reached, mutation detection and restored regression; distinguish composition,
unit and bounded live-data evidence. Superseded results and execution chronology belong in Git
history. Known limits stay in agreements; unfinished actions, blockers and acceptance steps belong only in
the relevant plan/followup, linked without duplicating its task list.

## Evidence And Change Review

Consumer scenarios derive their expected behavior from accepted promises, not by copying the current
provider implementation. Provider unit tests, consumer unit tests and real composition tests have
different evidence scopes; none substitutes for the others.

Composition evidence must execute the real provider-to-consumer path under examination, including
its DI binding. Do not mock the provider's final result and call that compatibility verification.
Use real persistence where storage and roster facts determine the promise. External I/O may be
replaced at its boundary; production business behavior must remain unchanged in tests.

Assert prohibited effects as well as successful results: no reads from an unavailable provider, no
implicit refresh, no unexpected writes, and no failure disguised as missing data. Specify legitimate
consumer writes, such as document generation audit, separately from prohibited provider writes.

Review evidence must identify its scope and authorship. Independent review means a reviewer who
did not author the implementation or its expected assertions, checking the accepted promises and
coverage independently. Author self-review, historical-assertion comparison and mutation detection
are distinct evidence and must not be presented as independent review. If no independent review
was obtained, record that limit explicitly; a passing command does not imply a review occurred.

For a relevant change:

- Find agreements from both capability decision links and the actual public calls, implementation,
  DI wiring and shared dependencies. `requires` controls runtime admission; it is not a change-impact
  graph. Optional consumption can still break, and absence of an agreement does not prove isolation.
- Run the affected consumer scenarios and provider checks. Record why the chosen scope covers the
  potentially changed promises; this first iteration uses review, not automatic test routing.
- Expand regression for shared authorization, transactions, persistence, configuration, protocol or
  assembly changes, including adjacent capabilities and regular full E2E when needed. Live smoke is
  separate and only runs when the external boundary itself needs verification.
- Preserve promises during internal changes. Change established meaning explicitly as a cross-capability
  change with the required decision evidence and coordinated consumers.
- Changing historical assertions requires an independent reason: an accepted changed promise, an
  incorrectly expressed promise, or an unreachable scenario with replacement coverage where needed.
  A failing new implementation is not that reason.

For consequential agreements, use bounded fault injection or temporary mutations in isolation to
check that a plausible semantic regression is detected. Restore the real implementation afterward;
never add production fixture branches or success fallbacks to satisfy tests. A green result supports
only its executed scenarios. Agreement and test counts are not success metrics.
