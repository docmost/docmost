# Phase 0 Research: Demo_All Flag & Compose Build

This document resolves the unknowns surfaced by the spec's Technical Context and the EE/feature-gating audit. Every decision below is grounded in an existing pattern in the repo so the implementation stays inside owning surfaces and the OSS/EE boundary.

## R1 — Canonical env-var name and parsing

**Decision**: Use the canonical name `DEMO_ALL` (uppercase) and parse it with the same `"true"`-string convention used by every existing boolean env var on `EnvironmentService` (see [`isCloud`](apps/server/src/integrations/environment/environment.service.ts#L186-L191), [`isCollabDisableRedis`](apps/server/src/integrations/environment/environment.service.ts#L217-L222), [`isDisableTelemetry`](apps/server/src/integrations/environment/environment.service.ts#L224-L229)).

**Rationale**: The repo already standardizes on the `getConfig.get<string>('X','false').toLowerCase() === 'true'` idiom for booleans. Reusing it keeps `DEMO_ALL` indistinguishable from every other boolean toggle, and keeps `.env.example` documentation consistent. The spec's "ambiguous truthy values" edge case is automatically satisfied: anything that isn't the literal string `"true"` (case-insensitive) is false.

**Alternatives considered**:

- A bespoke truthy parser (`1`, `yes`, `on`, etc.) — rejected because it would diverge from every other boolean toggle in `EnvironmentService` and surprise operators.
- Reading both `DEMO_ALL` and `Demo_All` — rejected: POSIX env-var lookups are case-sensitive, the existing convention is uppercase, and supporting both creates two ways to spell the same flag.

## R2 — Where the gating short-circuits live

**Decision**: Add a single helper `isDemoAll()` on [`EnvironmentService`](apps/server/src/integrations/environment/environment.service.ts) and consult it at the top of every public method of [`LicenseCheckService`](apps/server/src/integrations/environment/license-check.service.ts). When `isDemoAll()` is true, each method returns the "everything enabled, highest tier" answer **before** any `require('../../ee/licence/...')` attempt.

**Rationale**: In OSS checkouts the `ee/licence/license.service` and `ee/licence/feature-registry` modules do not exist; today the catch blocks silently return `false`/`[]`/`null`. Short-circuiting at the top of each method (a) avoids paying the failed-require cost, (b) makes the override behavior obvious in code review, and (c) keeps the override in OSS code where the spec MC-002 requires it. The cloud branch in `hasFeature` is also short-circuited so `CLOUD=true` does not silently override `DEMO_ALL`.

**Alternatives considered**:

- Returning demo answers from the EE `license.service` itself — rejected: EE module is not present in OSS, so this would not work in the most common demo target (a clean OSS checkout).
- A new wrapper service — rejected: violates "use existing infrastructure" (Constitution Principle IV) and creates a parallel gating surface.

## R3 — Source of truth for "all features"

**Decision**: The full feature list returned in demo mode is `Object.values(Feature)` from [`apps/server/src/common/features.ts`](apps/server/src/common/features.ts). The reported tier is the string `"enterprise"` (the highest value in the client-side [`Tier` type](apps/client/src/ee/entitlement/entitlement.types.ts#L1)).

**Rationale**: `Feature` is the canonical OSS enum of every gated capability; using it means new features added to the enum are automatically included in demo mode without further wiring. `"enterprise"` is the client's documented top tier and is what the UI expects when unlocking every gated view.

**Alternatives considered**:

- Importing the EE `feature-registry`'s plan map — rejected: that file lives in the EE module that may be absent.
- Returning a magic string like `"demo"` — rejected: requires changes to every client-side `tier === 'enterprise'` comparison and breaks the spec's "no contract change" requirement (MC-003).

## R4 — Client-side surface (or lack of one)

**Decision**: No client gating code changes. The client continues to read entitlements via [`useEntitlements()`](apps/client/src/ee/entitlement/use-entitlements.ts), which hits the unchanged `/api/workspace/entitlements` endpoint. When demo mode is on, the server returns `{cloud, tier: "enterprise", features: [...all]}` and the existing client gates open.

**Rationale**: Per spec MC-003, the client-server contract shape does not change; only the values change. Keeping the client untouched eliminates the risk of regressing `isCloud()` or `useEntitlements` behavior for production self-hosted and cloud deployments.

**Alternatives considered**:

- Injecting `DEMO_ALL` into [`window.CONFIG`](apps/server/src/integrations/static/static.module.ts#L34-L52) and reading it on the client — rejected: would create a second client-side gating signal and increase the chance of UI divergence from the server's authoritative entitlements.
- A demo banner driven by a new `demo` boolean on the entitlements payload — deferred: not required by the spec; can be added later if requested without breaking the contract.

## R5 — Operator-visible startup signal

**Decision**: Emit a `WARN`-level log on application bootstrap when `DEMO_ALL=true`, sourced from a single bootstrap callsite (preferred location: a one-line check in [`apps/server/src/main.ts`](apps/server/src/main.ts) right after the Nest app is created, or inside `EnvironmentService` on first access). The message must include the literal string "DEMO_ALL=true" and a "do not use in production" warning.

**Rationale**: Spec FR-009 / SC-005 require an observable signal. NestJS's built-in `Logger` is already used across the codebase; a one-line `Logger.warn(...)` is the smallest possible footprint and matches existing project conventions.

**Alternatives considered**:

- An always-on banner in the UI — deferred: not required by spec, and would couple this feature to client code unnecessarily.
- A startup-time environment-validation failure unless an explicit `DEMO_ALL_CONFIRM=true` is set — rejected: too heavyweight for an opt-in flag and would surprise CI/test environments.

## R6 — Docker Compose build path

**Decision**: Replace the `image: docmost/docmost:latest` line in [`docker-compose.yml`](docker-compose.yml) with a `build:` block (`context: .`, `dockerfile: Dockerfile`) and keep an explicit `image: docmost/docmost:local` tag so successive runs reuse the locally built image. Add `DEMO_ALL: ${DEMO_ALL:-false}` to the existing `environment:` block so operators can flip the flag via shell env or a compose `.env` file without editing source.

**Rationale**: The existing [`Dockerfile`](Dockerfile) already produces a runnable image from `COPY . . && pnpm install --frozen-lockfile && pnpm build`. The existing [`.dockerignore`](.dockerignore) excludes `node_modules`, `.git`, `dist`, `/data`, `.env*`, and `.nx`, so a clean local checkout will build deterministically. Adding `image: docmost/docmost:local` (alongside `build:`) tells Compose to tag the build output, which prevents accidental reuse of a previously pulled `docmost/docmost:latest`.

**Alternatives considered**:

- A separate `docker-compose.dev.yml` overlay that adds `build:` — rejected per spec Assumptions: the user asked for the existing compose file to build the project.
- Removing the `image:` line entirely — rejected: Compose then auto-tags the build with a project-prefixed name that depends on the host's CWD and is harder to reference manually.
- Multi-stage caching tweaks to the Dockerfile — deferred: out of scope for this feature unless `docker compose build` fails on a clean checkout during implementation.

## R7 — Environment validation impact

**Decision**: Do **not** add `DEMO_ALL` to the `class-validator` schema in [`environment.validation.ts`](apps/server/src/integrations/environment/environment.validation.ts). Treat it as an undeclared optional boolean, the same way `DISABLE_TELEMETRY`, `COLLAB_DISABLE_REDIS`, and `IFRAME_EMBED_ALLOWED` are handled (all are read from `ConfigService` but absent from the validator class).

**Rationale**: The validator class currently only enforces shape on a curated subset of env vars (DB URL, redis URL, AI driver, search driver, etc.). Boolean toggles are intentionally absent — the validation cost would exceed the value for a single `"true"|"false"` comparison.

**Alternatives considered**:

- Add `@IsOptional() @IsIn(['true','false']) DEMO_ALL: string;` — rejected as inconsistent with peer boolean flags.

## R8 — Backwards-compat verification

**Decision**: Add two colocated Jest spec cases on `LicenseCheckService`:

1. `DEMO_ALL` unset → `hasFeature(undefined, Feature.SCIM)` returns `false`, `resolveFeatures(...)` returns `[]`, `resolveTier(...)` returns `"free"` (unchanged behavior).
2. `DEMO_ALL=true` → `hasFeature(undefined, Feature.SCIM)` returns `true`, `resolveFeatures(...)` includes every `Feature.*` value, `resolveTier(...)` returns `"enterprise"`.

**Rationale**: Spec SC-002 demands byte-identical behavior when the flag is unset. A focused unit test on the gating service is the cheapest evidence and lives in the owning module.

**Alternatives considered**:

- An e2e test exercising the entitlements endpoint — deferred: the unit test already covers the only branch that changes; e2e is appropriate only if the controller wiring is altered.

## R9 — `.env.example` update

**Decision**: Append a documented `DEMO_ALL=false` entry to [`.env.example`](.env.example) with a single-line comment warning against production use. Match the comment style already present for `DISABLE_TELEMETRY` / `IFRAME_EMBED_ALLOWED`.

**Rationale**: Spec FR-014 requires documentation alignment. `.env.example` is the canonical place operators discover toggles in this project.

## Open items resolved

All `NEEDS CLARIFICATION` markers from the spec phase are resolved here. No remaining unknowns block Phase 1.
