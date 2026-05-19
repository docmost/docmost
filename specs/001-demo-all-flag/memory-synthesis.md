# Memory Synthesis

## Current Scope

Add the `DEMO_ALL` environment variable. When true, the server reports every gated/EE feature as enabled and the workspace entitlements endpoint returns the highest tier with the full feature list, without modifying persistent data. Also flip `docker-compose.yml` from pulling `docmost/docmost:latest` to building from the local `Dockerfile`.

Affected surfaces: `apps/server/src/integrations/environment` (env getter, license short-circuit), `apps/server/src/core/workspace` (entitlements path consumes the resolver), `docker-compose.yml`, `Dockerfile` (only if needed), `.env.example`. The client consumes the existing entitlements endpoint — no client gating system needs to change.

## Relevant Decisions

- No durable technical decisions captured in `docs/memory/DECISIONS.md` or `.specify/memory/DECISIONS.md` yet (templates only). (Reason Included: required by retrieval flow, Status: empty, Source: docs/memory/DECISIONS.md)

## Active Architecture Constraints

- OSS code MUST NOT depend on EE modules; EE code lives under `*/ee` and is dynamically loaded. (Reason Included: feature must short-circuit BEFORE attempting to `require` `ee/licence/license.service`, since OSS checkouts lack that module. Source: `.specify/memory/constitution.md`, [apps/server/src/app.module.ts](apps/server/src/app.module.ts#L32-L43))
- Environment/config changes MUST be documented in spec, plan, and quickstart. (Reason Included: feature is env-driven; quickstart and `.env.example` updates are in scope. Source: `.specify/memory/constitution.md` Principle V)
- Server file naming follows Nest-style `*.module.ts`, `*.service.ts`, `*.controller.ts`, `*.spec.ts`; tests are colocated. (Reason Included: any new test file lives next to the service it tests. Source: `.specify/memory/constitution.md` Principle II)
- `apps/server/src/integrations/environment` owns env-driven configuration; new env accessors belong there. (Reason Included: `DEMO_ALL` getter goes on `EnvironmentService` next to `isCloud()`. Source: existing structure, [apps/server/src/integrations/environment/environment.service.ts](apps/server/src/integrations/environment/environment.service.ts#L186-L191))
- Tests on the touched server module use Jest with colocated `*.spec.ts`. (Reason Included: license short-circuit and entitlements behavior get colocated specs. Source: `AGENTS.md`)

## Accepted Deviations

- None recorded.

## Relevant Security Constraints

- Demo mode bypasses paid-feature and license gating. It MUST be opt-in (off by default) and operator-observable on startup so accidental production use is auditable. (Reason Included: spec FR-002, FR-009; security risk of silent activation.)
- Demo mode MUST NOT auto-provision third-party credentials (AI keys, SAML IdP metadata, S3, SMTP). (Reason Included: spec FR-008; avoids leaking demo posture into integrations that send real network traffic.)
- Demo mode MUST NOT modify persistent data so toggling it off restores prior gating cleanly. (Reason Included: spec FR-006; protects production workspaces if the flag is ever set in error.)

## Related Historical Lessons

- No historical lessons captured in `docs/memory/WORKLOG.md` yet (template only).

## Conflict Warnings

- None. The feature is internally consistent with constitution principles and with the dynamic-EE-loading pattern in `app.module.ts`. The Docker Compose change moves from a published image to a local build, which is consistent with the project's existing `Dockerfile` and `.dockerignore`.

## Retrieval Notes

- Index entries considered: `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `DECISIONS.md` (empty), `BUGS.md` (empty), `WORKLOG.md` (empty), `.specify/memory/constitution.md`, `AGENTS.md`.
- Active decisions read: 0 (none captured). Architecture constraints read: 5 (within budget). Accepted deviations: 0. Security constraints derived from spec: 3. Bug patterns: 0. Worklog: 0.
- Code anchors read (smallest necessary sections): `LicenseCheckService` (full file, 99 lines), `EnvironmentService.isCloud()`, `app.module.ts` EE loader, `WorkspaceController.getEntitlements`, `apps/client/src/lib/config.ts`, `static.module.ts` `window.CONFIG` injection, `Dockerfile`, `docker-compose.yml`, `.env.example`, `apps/server/src/common/features.ts`. All within retrieval budget.
- Synthesis word count under 900-word budget. No full durable-memory dumps performed.
