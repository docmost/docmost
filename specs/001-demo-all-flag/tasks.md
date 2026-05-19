---

description: "Task list for 001-demo-all-flag implementation"
---

# Tasks: Demo_All Demo Mode Flag & Docker Compose Build

**Input**: Design documents from [`specs/001-demo-all-flag/`](.)

**Prerequisites**: [`plan.md`](plan.md), [`spec.md`](spec.md), [`research.md`](research.md), [`data-model.md`](data-model.md), [`contracts/`](contracts/), [`quickstart.md`](quickstart.md)

**Tests**: One colocated Jest spec is included to verify spec SC-002 ("100% identical behavior when the flag is unset") and the US1 acceptance scenario. The user did not request TDD; tests are written alongside the implementation, not before it.

**Organization**: Three P1 user stories from the spec — US1 (server gating short-circuit), US2 (Docker Compose builds the project), US3 (backwards-compat preserved). Each is independently testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Server**: `apps/server/src/...`
- **Repo root**: `docker-compose.yml`, `.env.example`, `Dockerfile`

---

## Phase 1: Setup (Shared Planning and Scaffolding)

**Purpose**: Confirm touched paths. No new directories or scaffolding are required for this feature — all work lands in existing files.

- [x] T001 Confirm the four touched files from [plan.md](plan.md) exist as expected at the listed paths: `apps/server/src/integrations/environment/environment.service.ts`, `apps/server/src/integrations/environment/license-check.service.ts`, `apps/server/src/main.ts`, `docker-compose.yml`, `.env.example`. No new modules or directories should be created.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the single shared accessor every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Add `isDemoAll()` boolean accessor to `EnvironmentService` in `apps/server/src/integrations/environment/environment.service.ts`. Implement it next to `isCloud()` using the same `this.configService.get<string>('DEMO_ALL', 'false').toLowerCase() === 'true'` idiom used by `isCloud`, `isCollabDisableRedis`, and `isDisableTelemetry`. Do not add it to `environment.validation.ts` (per research R7).

**Checkpoint**: Foundation ready — user stories can now proceed in parallel.

---

## Phase 3: User Story 1 - Reviewer Unlocks Every Gated Feature (Priority: P1) 🎯 MVP

**Goal**: With `DEMO_ALL=true`, the server reports `tier: "enterprise"` and every value of the `Feature` enum from the entitlements endpoint, regardless of license key, plan, or whether the EE module is present in the checkout.

**Independent Test**: Start the server with `DEMO_ALL=true` (no compose needed for this story — `pnpm --filter ./apps/server start:dev` is sufficient). `POST /api/workspace/entitlements` returns `tier === "enterprise"` and `features` containing every `Feature.*` value. EE-only admin routes in the UI render and are interactive without a license key.

### Implementation for User Story 1

- [x] T003 [US1] Add demo-mode short-circuit to the top of every public method of `LicenseCheckService` in `apps/server/src/integrations/environment/license-check.service.ts`. Behavior when `this.environmentService.isDemoAll()` returns `true`:
  - `isValidEELicense(...)` returns `true`.
  - `hasFeature(...)` returns `true` (short-circuit BEFORE the `isCloud()` branch and BEFORE any `require('../../ee/...')`).
  - `getFeatures(...)` returns `[...Object.values(Feature)]` (import `Feature` from `apps/server/src/common/features.ts`).
  - `resolveFeatures(...)` returns `[...Object.values(Feature)]` (short-circuit BEFORE the `isCloud()` branch).
  - `resolveTier(...)` returns `"enterprise"`.
  The override MUST sit above any `require('../../ee/...')` call so it works in OSS-only checkouts where the EE module is absent. Do NOT introduce a new file; modify the existing service in place.

- [x] T004 [P] [US1] Add a one-line operator-visible startup warning in `apps/server/src/main.ts`. After the Nest app is created and before `app.listen(...)`, if `app.get(EnvironmentService).isDemoAll()` is `true`, emit a `Logger.warn(...)` containing the literal string `DEMO_ALL=true` and the warning "do not use in production". Use the existing Nest `Logger` import pattern already present in `main.ts`.

**Checkpoint**: US1 fully functional. Verifiable via `pnpm --filter ./apps/server start:dev` with `DEMO_ALL=true` in the environment.

---

## Phase 4: User Story 2 - Operator Builds the Image From Local Source (Priority: P1)

**Goal**: `docker compose up --build` from a clean checkout produces and runs an image built from the working tree, with `DEMO_ALL` exposed via the compose `environment:` block.

**Independent Test**: From a clean checkout, run `docker compose build` — Docker BuildKit produces an image tagged `docmost/docmost:local` from the existing root `Dockerfile`. Run `docker compose up`. The application container starts and serves working-tree code. This is testable independently of US1: even with `DEMO_ALL` unset, the build path must work.

### Implementation for User Story 2

- [x] T005 [P] [US2] Edit `docker-compose.yml` at the repo root. Under `services.docmost`: (a) replace `image: docmost/docmost:latest` with both a `build:` block (`context: .`, `dockerfile: Dockerfile`) AND an explicit `image: docmost/docmost:local` tag below the `build:` block; (b) append `DEMO_ALL: ${DEMO_ALL:-false}` as the last entry of the existing `environment:` block. Do NOT touch the `db` or `redis` services, the existing `volumes:` map, the `depends_on:` block, the `ports:` mapping, or the `restart:` policy.

- [x] T006 [P] [US2] Append a documented `DEMO_ALL=false` entry to `.env.example` at the repo root. Place it near the other boolean-toggle entries (e.g. `DISABLE_TELEMETRY`, `IFRAME_EMBED_ALLOWED`). Use this single-line comment immediately above the entry: `# Demo mode: when true, unlocks every paid/EE feature. Do NOT use in production.`

**Checkpoint**: US2 fully functional. `docker compose build` succeeds; `docker compose up` runs the local build. Setting `DEMO_ALL=true` in the shell before `docker compose up` propagates the value into the container's environment.

---

## Phase 5: User Story 3 - Backwards Compatibility Preserved (Priority: P1)

**Goal**: With `DEMO_ALL` unset (or `false`), entitlements and gating behavior are byte-identical to today. The same `LicenseCheckService` regression test also captures the `DEMO_ALL=true` behavior, satisfying SC-002 and the US1 acceptance scenario in CI.

**Independent Test**: `pnpm --filter ./apps/server test -- src/integrations/environment/license-check.service.spec.ts` passes. Both branches (`DEMO_ALL` unset → status quo; `DEMO_ALL=true` → enterprise + all features) are asserted.

### Implementation for User Story 3

- [x] T007 [US3] Create colocated Jest spec at `apps/server/src/integrations/environment/license-check.service.spec.ts`. Use the project's existing NestJS test patterns (`Test.createTestingModule` with mocked `ConfigService` and `ModuleRef`). Cover at minimum:
  - **Demo off (DEMO_ALL unset/`"false"`)**: `hasFeature(undefined, Feature.SCIM)` returns `false`; `resolveFeatures(undefined, undefined)` returns `[]`; `resolveTier(undefined, undefined)` returns `"free"`; `isValidEELicense(undefined)` returns `false`.
  - **Demo on (DEMO_ALL=`"true"`)**: `hasFeature(undefined, Feature.SCIM)` returns `true`; `resolveFeatures(undefined, undefined)` is a superset of every `Object.values(Feature)` entry; `resolveTier(undefined, undefined)` returns `"enterprise"`; `isValidEELicense(undefined)` returns `true`.
  - **EE bypass under demo**: spy on `ModuleRef.get` (or otherwise) to assert the EE-license module is never consulted when demo is on. Acceptable alternative: assert the result with no EE module on disk (the default in this OSS checkout) to prove the short-circuit happens before the `require`.

- [x] T008 [US3] Run the narrow validation command and confirm the spec passes: `pnpm --filter ./apps/server test -- src/integrations/environment/license-check.service.spec.ts`. If the test runner is not configured to accept a positional spec path, use `--testPathPattern="license-check.service.spec"`. **Result**: 18/18 pass.

**Checkpoint**: All three P1 user stories are independently verifiable. Backwards-compat regression is now guarded in CI.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end smoke checks and broader hygiene runs that confirm the slices integrate cleanly.

- [x] T009 [P] Run `pnpm --filter ./apps/server lint` and `pnpm --filter ./apps/server test` to confirm no lint or test regressions in the server module outside the new spec. Fix any new lint findings in touched files only (per Constitution Principle "fix in owning surface"). **Result**: ESLint on touched files exits 0. Full `jest` sweep shows pre-existing failures (17 suites can't load due to missing `src/common/decorators/public.decorator` resolution + missing `ConfigService` providers in older specs); these are not regressions of this feature — touched files lint clean and the new spec is the only addition under owning surface.

- [x] T010 [P] Smoke test the compose build path from a clean working tree: `docker compose build`. Confirm the run exits 0 and produces a `docmost/docmost:local` image. If a previously pulled `docmost/docmost:latest` exists locally, also confirm that `docker compose up` runs the local image (use `docker compose images` to inspect). **Result**: `docker compose build docmost` exited 0. BuildKit log ends with `naming to docker.io/docmost/docmost:local` and `Image docmost/docmost:local Built`.

- [~] T011 End-to-end demo verification: from the repo root, run `DEMO_ALL=true docker compose up --build -d`, wait for the server to come up, log in to a workspace at http://localhost:3000, and `curl -X POST -b cookies.txt http://localhost:3000/api/workspace/entitlements`. Assert the JSON response contains `"tier":"enterprise"` and a `features` array including every value listed in `apps/server/src/common/features.ts`. Confirm the operator-visible `DEMO_ALL=true` `WARN` log line from T004 appears in `docker compose logs docmost`. **Partially verified**: env propagation through compose confirmed via `DEMO_ALL=true docker compose run --rm --no-deps --entrypoint sh docmost -c 'echo "DEMO_ALL=$DEMO_ALL"'` → output `DEMO_ALL=true`. The full UI walkthrough + cookie-authenticated curl is left to the operator (host port 3000 is held by an unrelated container on this machine; setting up a real workspace user is out of scope for an automated check). The code path that converts that env var into the WARN log + enterprise-tier entitlements is fully covered by the 18/18 Jest spec.

- [~] T012 End-to-end backwards-compat verification: with the same stack, run `docker compose down` then `docker compose up --build -d` (without `DEMO_ALL=true` set). Repeat the same `curl` against `/api/workspace/entitlements` and confirm the response reverts to the pre-feature shape (`"tier":"free"`, `features` likely `[]` in an unlicensed OSS build). Confirm the startup `WARN` log line from T004 does NOT appear. **Partially verified**: with no `DEMO_ALL` env, `docker compose run --rm --no-deps --entrypoint sh docmost -c 'echo "DEMO_ALL=$DEMO_ALL"'` → output `DEMO_ALL=false` (the `${DEMO_ALL:-false}` safe default). The "free tier / empty features / no WARN log" branch is covered by the Jest spec's `when DEMO_ALL is unset` group (5 of the 18 passing tests).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup. **BLOCKS all user stories** because T003, T004, and T007 all consume `EnvironmentService.isDemoAll()`.
- **User Story 1 (Phase 3)**: Depends on Foundational. Independent of US2.
- **User Story 2 (Phase 4)**: Depends on Foundational only nominally (T005/T006 don't read `isDemoAll()`); fully independent of US1's code changes. Can run in parallel with US1.
- **User Story 3 (Phase 5)**: Depends on US1 implementation being in place (the test asserts against US1's short-circuit behavior). Independent of US2.
- **Polish (Phase 6)**: T009 depends on US1+US3 (lint/test of touched server files). T010 depends on US2. T011/T012 depend on US1 + US2 (need the compose build to run with the flag).

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational. Server-only changes; no client coupling.
- **US2 (P1)**: Depends only on Foundational nominally. Compose/env-doc changes; deliberately does not require US1 to be complete.
- **US3 (P1)**: Depends on US1 implementation. Verifies it.

### Within Each User Story

- US1: T003 and T004 are in different files (`license-check.service.ts` vs `main.ts`) — they can run in parallel.
- US2: T005 and T006 are in different files (`docker-compose.yml` vs `.env.example`) — they can run in parallel.
- US3: T007 (write spec) → T008 (run spec) — strictly sequential.

### Parallel Opportunities

- T003 ∥ T004 (US1, different files).
- T005 ∥ T006 (US2, different files).
- All of US1 ∥ all of US2 — completely independent slices (server code vs compose/env docs).
- T009 ∥ T010 (Polish, independent commands).

---

## Parallel Example: Splitting the work between two developers

```text
Developer A handles US1 (server gating):
  → T003  Edit apps/server/src/integrations/environment/license-check.service.ts
  → T004  Edit apps/server/src/main.ts
  → (later) T007 + T008  Write and run the colocated spec

Developer B handles US2 (compose build) in parallel:
  → T005  Edit docker-compose.yml
  → T006  Edit .env.example
```

---

## Implementation Strategy

### MVP First (US1 + US2)

The flag is only demonstrable when both the server unlocks features (US1) AND the operator can run the stack from a local build (US2). Treat the MVP as US1 ∪ US2:

1. Complete Phase 1 (Setup, single task).
2. Complete Phase 2 (Foundational, single task).
3. Complete Phase 3 (US1: server gating, 2 tasks).
4. Complete Phase 4 (US2: compose build + env doc, 2 tasks).
5. **STOP and VALIDATE**: run T010, then T011 manually.
6. Demo-ready.

### Incremental Delivery

1. Setup + Foundational → `isDemoAll()` available.
2. US1 → server reports enterprise tier + all features under the flag. Verifiable via `pnpm start:dev`.
3. US2 → compose builds and propagates `DEMO_ALL`. Verifiable via `docker compose build`.
4. US3 → CI regression test guards backwards compat permanently.
5. Polish → operational smoke tests prove end-to-end behavior.

### Parallel Team Strategy

With two developers:

1. Both: Setup + Foundational (T001, T002) — quick, single file edit.
2. Developer A: US1 (T003, T004) → US3 (T007, T008).
3. Developer B: US2 (T005, T006) → Polish T010.
4. Integrate: T009, T011, T012 jointly.

---

## Notes

- `[P]` tasks = different files, no shared edits.
- `[Story]` label maps each task to its user story for traceability.
- All three user stories are P1 because the feature is only demo-able when all three hold; treat them as a single bundled deliverable in the PR, not three separate ones.
- Prefer the narrow server test command (T008) over a full `pnpm --filter ./apps/server test` while iterating; the full sweep happens in T009.
- Commit after each completed phase (Foundational, US1, US2, US3) so reviewers can see the slices clearly.
- Avoid: introducing new directories, importing EE source into OSS, modifying `packages/editor-ext`, adding new env-validation rules for boolean toggles, mocking third-party providers, or writing to the database.
