<!-- docs/capabilities/current.md -->

# Current Capability Decisions

This document is the stable semantic boundary record for the capabilities currently installed by the API or Worker graphs. It states what each capability owns and the nearest boundary that must not be absorbed into it. Horizontal layer rules still decide where adapter, orchestration, module, infrastructure, core, and shared type code belongs.

This document does not claim file-level ownership. Use the derived entry module in `npm run capability:list` as the navigation seed, then follow ordinary code references and behavior tests.

## `ai.local-mock`

Owns deterministic local AI provider execution and its provider health result. It does not own AI queue admission, workflow state, or provider-call audit facts.

## `ai.openai`

Owns OpenAI provider configuration, invocation binding, result/error normalization, and provider health. It does not own generic AI job admission, workflow state, or product decisions about when AI is used.

## `ai.provider-call-observation`

Owns the recorded observation of an individual AI provider request, response, timing, usage, and failure. It does not own the async task lifecycle or provider execution itself.

## `ai.queue`

Owns admission and queue transport for AI generate, embed, and workflow jobs. It does not own provider execution or AI workflow state and policy.

## `ai.qwen`

Owns Qwen provider configuration, invocation binding, result/error normalization, and provider health. It does not own generic AI job admission, workflow state, or product decisions about when AI is used.

## `ai.workflow`

Owns AI workflow context, admission policy, execution state, and housekeeping lifecycle. It may use AI queue transport, async-task audit, and provider-call observation without absorbing their facts.

## `notification.email`

Owns email enqueue, delivery execution, and worker delivery lifecycle. It does not own the business outcome that requested an email, such as registration or verification.

## `notification.email.sendmail`

Owns Sendmail provider configuration, delivery binding, and provider health. It does not own email queue admission or notification business semantics.

## `platform.account`

Owns account identity, profile, credential, access facts, and account-registration policy and completion semantics. Email registration and third-party quick registration are account-owned usecase flows; registration is not a separate capability. Authentication/session issuance, third-party provider binding, and verification challenge lifecycle remain outside this boundary.

## `platform.async-task-audit`

Owns cross-runtime async task state, trace, attempts, and audit history. It does not own AI workflow state or individual AI provider request/response observations.

## `platform.auth`

Owns authentication, token/session issuance, and current-user projection. It does not own account persistence, third-party binding persistence, or business principal facts contributed to a session.

## `platform.verification-record`

Owns verification challenge creation, lookup, consumption, revocation, and their persisted facts. Registration, password reset, login, or binding outcomes remain with the flow that requests verification.

## `third-party-auth.binding`

Owns local account-to-provider identity binding and unbinding facts and lifecycle. It does not own provider SDK/API exchange, account registration policy, or authentication/session issuance.

## `third-party-auth.weapp`

Owns WeApp external identity, QR-code, phone-number integration, provider configuration, and provider health. It does not own local account binding, registration outcomes, or authentication/session issuance.
