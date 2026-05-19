# Implementation Plan: Demo_All Demo Mode Flag & Docker Compose Build

**Branch**: `001-demo-all-flag` | **Date**: 2026-05-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from [`specs/001-demo-all-flag/spec.md`](spec.md)

**Note**: This plan was filled in by `/speckit-plan`. Companion artifacts: [`research.md`](research.md), [`memory-synthesis.md`](memory-synthesis.md), [`data-model.md`](data-model.md), [`contracts/`](contracts/), [`quickstart.md`](quickstart.md).

## Summary

Add a single OSS-only environment variable `DEMO_ALL`. When `true`, every public method on `LicenseCheckService` short-circuits (before any attempt to load the dynamic EE module) so the workspace entitlements endpoint reports `tier: "enterprise"` and the full `Feature` enum, unlocking every gated UI surface for reviewers. The flag never touches persistent data, never changes the `CLOUD` routing semantics, and never auto-configures third-party integrations. In parallel, the root [`docker-compose.yml`](../../docker-compose.yml) is flipped from `image: docmost/docmost:latest` to a `build:` of the existing root [`Dockerfile`](../../Dockerfile) (with a `docmost/docmost:local` tag and a `DEMO_ALL: ${DEMO_ALL:-false}` env entry), so a reviewer can run a single `docker compose up --build` and see every feature.

## Technical Context

**Language/Version**: TypeScript 5.x across `apps/client`, `apps/server`, `packages/editor-ext`.

**Primary Dependencies**: NestJS 11 + Fastify on the server, Vite + React + Mantine on the client, Kysely + Postgres for persistence, Redis for caching/queues, `@docmost/editor-ext` workspace package, pnpm workspaces with Nx.

**Storage**: Postgres for primary data, Redis for cache/queue. **This feature writes nothing to either.** Docker volumes for app storage, db data, and redis data are unchanged.

**Testing**: Jest for server (colocated `*.spec.ts`); Vitest for client (colocated `*.test.tsx`). This feature adds one colocated Jest spec file alongside `LicenseCheckService`.

**Target Platform**: Web app served by Fastify; production runtime is a Docker image built from the root `Dockerfile`. The demo path runs locally via `docker compose up --build`.

**Project Type**: pnpm + Nx monorepo (frontend app, backend app, shared editor package).

**Performance Goals**: No new hot path. The added `isDemoAll()` check is an O(1) string compare on each gating call; entitlements is an admin-area query whose volume is negligible. No latency or throughput target changes.

**Constraints**:

- OSS code MUST NOT depend on EE modules. The override sits in OSS (`apps/server/src/integrations/environment`) and short-circuits **before** any `require('../../ee/...')` attempt.
- The entitlements response shape MUST NOT change — only its values when `DEMO_ALL=true`.
- The `CLOUD` env var continues to be the sole driver of cloud-vs-self-hosted routing.
- Demo mode MUST be opt-in and operator-visible at startup; production builds must remain byte-identical when the flag is unset.
- `packages/editor-ext` is not touched.

**Scale/Scope**: Single workspace-resolved endpoint affected; one server module gains an env getter; one license-resolver class gains a short-circuit; one compose file and one env example file are edited. No client gating system changes.

## Affected Surfaces

- **Client**: None. The client transparently picks up the doctored entitlements payload via existing [`useEntitlements()`](../../apps/client/src/ee/entitlement/use-entitlements.ts).
- **Server**: [`apps/server/src/integrations/environment/environment.service.ts`](../../apps/server/src/integrations/environment/environment.service.ts) (new `isDemoAll()`), [`apps/server/src/integrations/environment/license-check.service.ts`](../../apps/server/src/integrations/environment/license-check.service.ts) (short-circuit in every public method), [`apps/server/src/main.ts`](../../apps/server/src/main.ts) (one-line startup warning), colocated `license-check.service.spec.ts` (new).
- **Shared Package**: None.
- **Enterprise Edition**: None — the override lives in OSS by design. EE modules continue to load dynamically per the existing pattern in [`apps/server/src/app.module.ts`](../../apps/server/src/app.module.ts).
- **Repo root**: [`docker-compose.yml`](../../docker-compose.yml) gains a `build:` block and a `DEMO_ALL` env line; [`.env.example`](../../.env.example) gains a documented `DEMO_ALL=false` entry.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Question                                                                                         | Status | Evidence |
| ------------------------------------------------------------------------------------------------ | ------ | -------- |
| Are all touched files placed in their owning surface?                                            | PASS   | Env logic lives in `apps/server/src/integrations/environment`; license-resolver override lives in the same module; compose and `.env.example` live at the repo root. No parallel structure. |
| Does OSS remain independent from EE code?                                                        | PASS   | The override short-circuits **before** any `require('../../ee/...')` and is implemented in OSS files only. EE module loading in `app.module.ts` is unchanged. |
| Are API, websocket, collaboration, migration, and env/config impacts called out where relevant?  | PASS   | Spec Impact Assessment + plan's "Affected Surfaces"; env impact documented in [`.env.example`](../../.env.example) update and `contracts/demo-all.env.contract.md`. No API, websocket, collaboration, or migration impact. |
| Does the validation plan include the narrowest meaningful client/server/package checks?          | PASS   | Server: `pnpm --filter ./apps/server test -- src/integrations/environment/license-check.service.spec.ts` (narrow), plus broader `pnpm --filter ./apps/server lint/test` if other code is touched. Client unchanged. |
| If `packages/editor-ext` changes, are consuming surfaces and regression risks identified?        | N/A    | `packages/editor-ext` is not changed. |

**Result**: All gates PASS. No complexity-tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/001-demo-all-flag/
├── plan.md                # this file
├── spec.md                # feature specification
├── memory-synthesis.md    # memory-first synthesis
├── research.md            # Phase 0 decisions
├── data-model.md          # Phase 1 entities/contracts overview
├── contracts/
│   ├── entitlements.contract.md
│   ├── demo-all.env.contract.md
│   └── compose-build.contract.md
├── quickstart.md          # operator/reviewer walkthrough
├── checklists/
│   └── requirements.md    # spec quality checklist
└── tasks.md               # generated by /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
docker-compose.yml          # MODIFY: add build block, image tag, DEMO_ALL env entry
Dockerfile                  # READ-ONLY for this feature (no edits unless build fails)
.env.example                # MODIFY: add documented DEMO_ALL=false entry
apps/
└── server/
    └── src/
        ├── main.ts                                  # MODIFY: one-line startup WARN when isDemoAll()
        └── integrations/
            └── environment/
                ├── environment.service.ts           # MODIFY: add isDemoAll()
                ├── license-check.service.ts        # MODIFY: short-circuit in 5 public methods
                └── license-check.service.spec.ts   # CREATE: colocated Jest spec
```

**Structure Decision**: Stay inside the existing `apps/server/src/integrations/environment` module — it already owns environment toggles, license/feature resolution, and dynamic EE module discovery. No new top-level modules, no new client code paths, no `packages/editor-ext` work. The compose and env-example edits live at the repo root where they always have.

## Delivery Slices

- **Server slice (single slice)**:
  1. Add `isDemoAll()` accessor on `EnvironmentService` matching the existing boolean-toggle idiom.
  2. Add a top-of-method short-circuit in each public method of `LicenseCheckService` that consults `EnvironmentService.isDemoAll()` and returns the "everything enabled" answer **before** any `require('../../ee/...')` attempt.
  3. Add a `Logger.warn` one-liner in `main.ts` (after the Nest app is created) that fires only when `isDemoAll()` is true.
  4. Add a colocated `license-check.service.spec.ts` covering: (a) `DEMO_ALL` unset → status quo for every method; (b) `DEMO_ALL=true` → `tier === "enterprise"`, `resolveFeatures` is a superset of every `Feature.*` value, and the EE-require path is not reached.
- **Compose / packaging slice**: Edit `docker-compose.yml` (add `build:` block, change `image:` to `docmost/docmost:local`, add `DEMO_ALL: ${DEMO_ALL:-false}` to the env block). Edit `.env.example` (add the documented `DEMO_ALL` line).
- **No client slice**. No editor-ext slice. No EE slice.

## Validation Plan

- **Client**: N/A — no client changes. (If a future iteration adds a UI banner, run `pnpm --filter ./apps/client lint` and `pnpm --filter ./apps/client test`.)
- **Server**: narrowest first — `pnpm --filter ./apps/server test -- src/integrations/environment/license-check.service.spec.ts`. Broader sweep when the slice is complete: `pnpm --filter ./apps/server lint`, `pnpm --filter ./apps/server test`. `pnpm --filter ./apps/server test:e2e` is **not** required because the controller wiring is unchanged.
- **Shared Package**: N/A.
- **Workspace / packaging**:
  - `docker compose build` from a clean checkout must exit 0.
  - `docker compose up` must show a build phase (not just an image pull) and the running container must reflect a working-tree change made before the rebuild.
  - With `DEMO_ALL=true`, `POST /api/workspace/entitlements` must return `tier === "enterprise"` and `features` containing every `Feature.*` value.
  - With `DEMO_ALL` unset, the same endpoint must return today's values (free tier, empty features in an unlicensed OSS build).

## Project-Specific Risks

- **EE module absence**: in OSS-only checkouts, `apps/server/src/ee` does not exist. Mitigated by placing the demo short-circuit at the **top** of each `LicenseCheckService` method (the existing `try { require('../../ee/...') } catch {}` blocks become unreachable in demo mode).
- **Accidental production use**: a careless `DEMO_ALL=true` in a production environment unlocks every gated feature. Mitigated by (a) opt-in default of `false`, (b) operator-visible startup `WARN` log, (c) prominent warning in `.env.example` and in this feature's `quickstart.md`, (d) explicit "do not use in production" note in the documentation slice.
- **Stale `docmost/docmost:latest` image**: a developer who has previously pulled the published image could unintentionally run it instead of the local build. Mitigated by tagging the local build `docmost/docmost:local` and documenting the troubleshooting step in `quickstart.md`.
- **Dockerfile build regressions**: the existing `Dockerfile` already runs `pnpm install` + `pnpm build`; if a future commit breaks that path, the compose flow breaks too. Mitigated by adding the compose-build smoke step (`docker compose build` from clean) to the validation plan so the regression is caught here, not in production.
- **`Feature` enum drift**: any new entry added to `Feature` is automatically included in demo mode (intentional). Reviewers should be aware that adding an entry to that enum has demo-mode implications.

## Complexity Tracking

> No Constitution Check violations. This table intentionally left empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| —         | —          | —                                    |

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1 artifacts (data-model, contracts, quickstart) were generated. All five gates still PASS. No new files outside their owning surface; OSS independence preserved; env/config impact documented in `.env.example` and contracts; validation plan still scoped to the narrowest meaningful surface; `packages/editor-ext` untouched.
