# Phase 1 Data Model: Demo_All Flag

This feature introduces no persistent schema. The "entities" below are configuration and response-shape contracts that the implementation must honor exactly.

## E1 — `DemoAllFlag` (runtime configuration)

**Source**: process environment, variable name `DEMO_ALL`.

**Shape**: `boolean` (parsed from a case-insensitive string).

**Lifecycle**: process-scoped. Read on demand via `EnvironmentService.isDemoAll()`; not persisted.

**Validation rules**:

- Unset, empty, or any value other than the case-insensitive string `"true"` resolves to `false`.
- Only the canonical name `DEMO_ALL` is honored. Case-variant spellings (`Demo_All`, `demo_all`) MUST be ignored.

**State transitions**: none. The value is fixed for the lifetime of the process; restart is required to change it (matches every other env-driven toggle in `EnvironmentService`).

**Producers**: operator-set environment variable (host shell, Docker Compose `environment:` block, container orchestrator manifest, `.env` file consumed by Compose).

**Consumers**:

- `LicenseCheckService` (every public method short-circuits when `true`).
- One bootstrap callsite that emits the operator-visible startup warning.

## E2 — `Feature` (enum, unchanged)

**Source**: [`apps/server/src/common/features.ts`](apps/server/src/common/features.ts).

**Shape**: frozen object mapping symbolic names to dot-separated string keys (`SCIM`→`"scim"`, `PAGE_PERMISSIONS`→`"page:permissions"`, etc.). Exported `FeatureKey` type is the value union.

**Used by this feature**: `LicenseCheckService.resolveFeatures` returns `Object.values(Feature)` when demo mode is on. No additions to the enum.

**Invariant**: every entry added to this enum in the future is automatically included in demo mode's feature list without further wiring. This is intentional — it's the safety net for spec FR-005.

## E3 — `Entitlements` (response payload, unchanged shape)

**Source on server**: built inline in [`WorkspaceController.getEntitlements`](apps/server/src/core/workspace/controllers/workspace.controller.ts#L66-L80).

**Source on client**: [`Entitlements` type](apps/client/src/ee/entitlement/entitlement.types.ts#L3-L7).

**Fields**:

| Field      | Type                                                  | Demo-mode value                                  | Non-demo value                                                                 |
| ---------- | ----------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| `cloud`    | `boolean`                                             | unchanged — driven by `CLOUD` env                | unchanged                                                                      |
| `tier`     | `"free" \| "standard" \| "business" \| "enterprise"`  | always `"enterprise"`                            | resolved by `licenseCheckService.resolveTier(licenseKey, plan)` (status quo)   |
| `features` | `string[]`                                            | every `Object.values(Feature)` entry             | resolved by `licenseCheckService.resolveFeatures(licenseKey, plan)` (status quo) |

**Contract guarantees**:

- Shape is identical with and without demo mode (no new fields, no field removals, no type widenings).
- The set of valid `tier` values is unchanged.
- The set of valid `features` values is bounded by the existing `Feature` enum.

## E4 — `LicenseCheckService` method contract (semantic change only)

**Source**: [`apps/server/src/integrations/environment/license-check.service.ts`](apps/server/src/integrations/environment/license-check.service.ts).

**Method-by-method demo-mode behavior**:

| Method                                         | Non-demo result                                         | Demo-mode result                                |
| ---------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| `isValidEELicense(licenseKey)`                 | cloud → `true`; otherwise EE-or-`false`                 | `true`                                          |
| `hasFeature(licenseKey, feature, plan)`        | cloud-plan map or EE-or-`false`                         | `true`                                          |
| `getFeatures(licenseKey)`                      | EE-or-`[]`                                              | `[...Object.values(Feature)]`                   |
| `resolveFeatures(licenseKey, plan)`            | cloud-plan list or EE-or-`[]`                           | `[...Object.values(Feature)]`                   |
| `resolveTier(licenseKey, plan)`                | cloud → `plan ?? "standard"`; otherwise EE-or-`"free"`  | `"enterprise"`                                  |
| `getLicenseType(licenseKey)` (private)         | EE-or-`null`                                            | not called (parents short-circuit)              |

**Ordering invariant**: the demo-mode check runs **first** in each public method, before any `require('../../ee/...')` attempt. This satisfies spec MC-002 and ensures demo mode works in OSS-only checkouts where the EE module is absent.

## E5 — Docker Compose service contract

**Source**: [`docker-compose.yml`](docker-compose.yml).

**Pre-change**:

- `services.docmost.image = "docmost/docmost:latest"` (pull-only).

**Post-change** (shape, not literal YAML):

- `services.docmost.build = { context: ".", dockerfile: "Dockerfile" }`.
- `services.docmost.image = "docmost/docmost:local"` (tag for the built image).
- `services.docmost.environment` gains `DEMO_ALL: ${DEMO_ALL:-false}` (operator can override via shell env or a Compose `.env` file).

**Invariants preserved**:

- `db` and `redis` services and their `volumes` are unchanged.
- The existing `volumes: docmost` mount at `/app/data/storage` is preserved.
- The exposed port `3000:3000` is preserved.
