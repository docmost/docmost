# Feature Specification: Demo_All Demo Mode Flag & Docker Compose Build

**Feature Branch**: `001-demo-all-flag`

**Created**: 2026-05-19

**Status**: Draft

**Input**: User description: "I want to start a new building a new feature flag where I want an an environment variable called \"Demo_All\" and if that it set to true I want to enable all enterprise features and all other features that is being disabled in this project so that it can be accessed. And I want the Docker compose file to build the project as part of the composition."

## Affected Surfaces *(mandatory)*

- **Client**: Entitlement/license/feature-gate readers, route guards, and cloud-aware UI must treat the workspace as fully entitled when the flag is on.
- **Server**: Environment configuration, license/feature resolution, and entitlements endpoint must short-circuit gating when the flag is on.
- **Shared Package**: No changes expected (`packages/editor-ext` does not own gating).
- **Enterprise Edition**: EE module loading and EE-only routes/pages must be reachable in demo mode even without a valid license key.

## Impact Assessment *(fill when relevant)*

- **API / WebSocket / Collaboration**: The `/api/workspace/entitlements` response shape stays the same, but its values are forced to the highest-tier / all-features state when demo mode is on. No new endpoints. No socket contract changes.
- **Database / Migrations**: None. The flag is environment-driven and stateless; nothing is persisted to the workspace, user, or license tables.
- **Environment / Config**: Introduces a new boolean environment variable `DEMO_ALL` (canonical uppercase form of `Demo_All`). Docker Compose now builds the application image from the repository instead of pulling a pre-built image.
- **Imports / Exports / Background Jobs**: No queue or background-job behavior changes. Demo mode does not enqueue jobs or alter import/export pipelines.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reviewer evaluates every gated feature in one demo container (Priority: P1)

A reviewer (sales engineer, evaluator, contributor) wants to spin up a single container and see every paid/EE/gated feature in the product without buying a license, configuring a tenant plan, or wiring up real third-party credentials. They set `DEMO_ALL=true`, start the stack, and the UI exposes every feature that would normally be hidden behind license, plan, tier, or feature-flag checks.

**Why this priority**: This is the entire purpose of the feature — without it, evaluators cannot see the full surface area of the product, which blocks adoption, contribution, and qualified review of EE work.

**Independent Test**: Start the stack with `DEMO_ALL=true`. Log into a fresh workspace. Verify the entitlements payload reports the top tier and the full feature list, and that every EE-gated admin page (SSO, SCIM, security settings, MFA enforcement, page permissions, API keys, AI, templates, PDF export, audit, etc.) is reachable from the admin UI without any license key configured.

**Acceptance Scenarios**:

1. **Given** a stack started with `DEMO_ALL=true` and no license key, **When** a logged-in user queries the entitlements endpoint, **Then** the response reports the highest tier and all feature flags as enabled.
2. **Given** a stack started with `DEMO_ALL=true` and no license key, **When** the user navigates to an EE-only admin section in the UI, **Then** the page renders and is interactive (not blocked by an "upgrade required" or "license required" message).
3. **Given** a stack started with `DEMO_ALL=true`, **When** server-side code asks the license/feature resolver whether a specific gated feature is available, **Then** the resolver answers yes for every defined feature without consulting an actual license payload.

---

### User Story 2 - Operator builds the running image from local source via Docker Compose (Priority: P1)

A contributor or operator wants `docker compose up` to build the application image from the current working tree instead of pulling `docmost/docmost:latest`. This lets them run a stack that reflects their local changes — including the demo-mode flag from User Story 1 — without publishing an image first.

**Why this priority**: The demo flag is only useful if a reviewer can stand up a stack that actually contains it. The default compose file pulling a published image makes the demo flow uncontributable and uncontrollable. Pairing the flag with a buildable compose unblocks the entire demo flow.

**Independent Test**: From a clean checkout, run the documented compose-up command. Confirm a local image is built (compose log shows a build step rather than a pull) and the running container serves the current working-tree code. This is testable independently of User Story 1: even with `DEMO_ALL` unset, the build path must work.

**Acceptance Scenarios**:

1. **Given** a fresh checkout with no pre-pulled image, **When** the operator runs the compose-up command, **Then** Docker builds the application image from the repository's Dockerfile and starts the stack with that local image.
2. **Given** an operator changes a file in the application source, **When** they rebuild and restart the stack, **Then** the running container reflects the local change.
3. **Given** the operator sets `DEMO_ALL=true` in the compose environment block (or via a `.env` file consumed by compose), **When** the stack starts, **Then** the flag is propagated into the running application container.

---

### User Story 3 - Existing self-hosted deployments are unaffected when the flag is unset or false (Priority: P1)

A self-hosted operator who upgrades to a release containing this feature, but who never sets `DEMO_ALL`, must see identical license, feature, and routing behavior to today. Demo mode must be opt-in.

**Why this priority**: Demo mode bypasses paid-feature gating. If it leaked on by default or via a different mode change, it would silently expose unpaid features in production. Backwards compatibility is a release blocker.

**Independent Test**: Start the stack with `DEMO_ALL` unset and with `DEMO_ALL=false`. Confirm entitlements and gating behave identically to a current build with no demo flag in either case.

**Acceptance Scenarios**:

1. **Given** the stack starts without `DEMO_ALL` defined, **When** the entitlements endpoint is called, **Then** the response matches today's behavior (free / configured tier, only the features the license actually grants).
2. **Given** the stack starts with `DEMO_ALL=false`, **When** any gated feature is requested, **Then** the gate behaves exactly as if the flag were absent.
3. **Given** the stack starts with `DEMO_ALL=true`, **When** the operator restarts with `DEMO_ALL=false`, **Then** all gated features lock back down without requiring data fixes or migrations.

---

### Edge Cases

- **Ambiguous truthy values**: `Demo_All` is set to non-boolean text such as `1`, `yes`, `True`, `TRUE`, or `enabled`. The parsing rule must be explicit and consistent with how the project parses other boolean env vars; anything not matching the allowed truthy set must be treated as false to fail safe.
- **Casing of the variable name**: The user wrote `Demo_All`, but POSIX environments and Docker Compose normalize/respect case differently. The application must read a single canonical casing (uppercase `DEMO_ALL`) so it works consistently in shells, `.env` files, Compose, and Kubernetes manifests.
- **License key present alongside demo mode**: A real license key is also set in the environment. Demo mode must take precedence (or at minimum never reduce entitlements below what the license grants) so the demo behavior is predictable.
- **Cloud mode interaction**: `CLOUD=true` is also set. Demo mode unlocks license-gated features but must not change the cloud-vs-self-hosted routing/onboarding flow, because that is a different operating mode with different URLs and side effects.
- **Third-party-credential features**: Features that need real external credentials to operate (AI provider keys, SAML IdP metadata, S3 keys, SMTP) appear in the UI but cannot function end-to-end without configuration. The UI must surface them without crashing — empty/"not configured" states are acceptable.
- **Build-time secrets in compose**: The Dockerfile build must not require secrets the user has not provided. Build must succeed on a clean checkout with only the default compose `.env`.
- **Stale published image**: The user has previously pulled `docmost/docmost:latest`. The compose change must clearly cause a local build rather than reuse the stale image.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST read a boolean environment variable named `DEMO_ALL` (canonical uppercase form of the requested `Demo_All`) on application startup.
- **FR-002**: System MUST treat `DEMO_ALL` as opt-in: unset, empty, `false`, or any value outside the documented truthy set MUST disable demo mode.
- **FR-003**: When demo mode is enabled, the server-side feature/license resolver MUST report every defined product feature as available, regardless of license key validity, expiration, plan, or tier.
- **FR-004**: When demo mode is enabled, the workspace entitlements response MUST report the highest available tier and the full feature list, so the client UI unlocks all gated views.
- **FR-005**: When demo mode is enabled, every EE-only admin page and EE-only route in the client MUST be reachable, and EE-gated UI controls MUST render in their enabled state.
- **FR-006**: Demo mode MUST NOT alter persistent data (no writes to workspaces, users, licenses, or plans), so toggling the flag off restores prior gating with no migration required.
- **FR-007**: Demo mode MUST NOT change cloud-vs-self-hosted routing or onboarding behavior; the existing `CLOUD` environment variable remains the sole driver of those flows.
- **FR-008**: Demo mode MUST NOT auto-provision or mock third-party integrations that require real credentials (AI providers, SAML IdP, S3, SMTP); such features expose their UI but remain non-functional without real configuration.
- **FR-009**: Demo mode's effect MUST be visible to operators via a startup log line (or equivalent observable signal) so accidental activation in production is auditable.
- **FR-010**: The Docker Compose file at the repository root MUST build the application image from the repository's `Dockerfile` rather than pull a pre-published image.
- **FR-011**: The Docker Compose build path MUST succeed from a clean checkout using only the credentials/values present in the default compose environment; no additional secret files are required to build.
- **FR-012**: The Docker Compose environment block MUST expose `DEMO_ALL` as a configurable variable (with a safe default of off) so operators can flip demo mode without editing application source.
- **FR-013**: Compose-driven builds MUST reflect the current working-tree application source: changes to client or server source code MUST be picked up by a rebuild.
- **FR-014**: System documentation that mentions running with Docker MUST be updated to describe the new build-based compose flow and the `DEMO_ALL` flag, including a prominent warning against using `DEMO_ALL=true` in production.

### Module Constraints *(mandatory for implementation planning)*

- **MC-001**: Feature code MUST be placed in the owning module path instead of creating a parallel structure. The flag is read in the server's environment configuration module; gating overrides live in the server license/feature resolution path and the workspace entitlements path; the client consumes the existing entitlements/config channels (no new client gating system).
- **MC-002**: OSS code MUST NOT depend on EE modules. The flag's read and parse logic lives in OSS environment config; only the override behavior may live alongside the EE license-feature resolver, and OSS callers MUST keep using the existing resolver interface.
- **MC-003**: If both client and server change, the client-server contract MUST be described explicitly. The entitlements endpoint response shape does not change; only its values are forced when demo mode is on. The client MUST NOT need to learn about `DEMO_ALL` directly — it reads the existing entitlements/config channels.
- **MC-004**: If `packages/editor-ext` changes, consuming surfaces that rely on it MUST be identified. This feature is expected to leave `packages/editor-ext` untouched; if that changes during planning, downstream consumers must be re-evaluated.

### Key Entities *(include if feature involves data)*

- **Demo Mode Flag**: Runtime, process-scoped boolean derived from `DEMO_ALL`. Not persisted. Read once at startup (or per request, depending on existing env-service patterns).
- **Entitlements Payload**: Existing client-visible record describing `cloud`, `tier`, and `features`. Demo mode overrides its values without changing its shape.
- **License / Feature Set**: Existing server-side concept describing which features a workspace may access. Demo mode short-circuits its evaluation to "everything enabled, highest tier."

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With `DEMO_ALL=true`, a fresh reviewer can reach every EE-gated admin section in the product within 5 minutes of `docker compose up`, with zero license-key configuration.
- **SC-002**: With `DEMO_ALL` unset, the entitlements response and gated-UI behavior are 100% identical (byte-for-byte where applicable) to a build of the same commit without this feature.
- **SC-003**: A `docker compose up --build` from a clean checkout produces a running stack in which the application container's behavior reflects the current working-tree application source on at least one verifiable change (e.g., a string changed in the UI appears in the running container).
- **SC-004**: Toggling `DEMO_ALL` from true to false and restarting the stack restores full gating within one application restart, with no manual data cleanup.
- **SC-005**: The application emits an observable signal on startup whenever demo mode is active, so an operator can confirm or detect activation without reading application logic.
- **SC-006**: Operators get a clear "this is a demo mode, do not use in production" warning in documentation and in the startup signal, reducing the risk of accidental production use.

## Assumptions

- "All enterprise features and all other features that is being disabled" is interpreted as: features gated by **license, plan, tier, or feature-flag checks** internal to this project. Features that require external third-party credentials (AI keys, SAML IdP, S3, SMTP) are made *reachable* in the UI but are not auto-configured to work end-to-end.
- The canonical environment-variable name is `DEMO_ALL` (uppercase). `Demo_All`, `demo_all`, etc. are not separately supported; documentation will use the canonical form.
- The `CLOUD` environment variable continues to govern cloud-vs-self-hosted onboarding/routing. Demo mode is orthogonal to deployment mode.
- The existing `docker-compose.yml` at the repository root is the file to modify; no new compose variants (e.g., `docker-compose.dev.yml`) are introduced in this feature unless the implementation plan finds a strong reason.
- The existing `Dockerfile` is used as the build context. If the build path requires changes to the Dockerfile to support a clean local build, those changes are in scope as part of this feature.
- The implementation is expected to run inside the existing environment-config and license-resolution modules; no new top-level subsystems or abstractions are created.
- Backwards compatibility with current `docmost/docmost:latest` consumers is preserved at the documentation level (operators who want the published image can still pull it); the repository's compose file, however, defaults to building from source.

## Validation Plan *(mandatory)*

- **Client Validation**: `pnpm --filter ./apps/client test` — covers any updated entitlement/feature-gating tests and route-guard tests in the client.
- **Server Validation**: `pnpm --filter ./apps/server test` — covers the environment-config parsing of `DEMO_ALL`, license/feature resolver short-circuit behavior, and entitlements controller behavior. If end-to-end coverage of the entitlements endpoint is added, `pnpm --filter ./apps/server test:e2e` is also required.
- **Shared Package Validation**: N/A — `packages/editor-ext` is not expected to change.
- **Additional Validation**: 
  - `docker compose build` and `docker compose up` from a clean checkout to confirm the local-build path works and the running container reflects working-tree source.
  - Manual UI walkthrough with `DEMO_ALL=true` to confirm every EE/admin route renders.
  - Manual confirmation that `DEMO_ALL=false` / unset produces unchanged gating behavior.
  - Startup-log inspection to confirm demo mode emits its operator-visible signal.
