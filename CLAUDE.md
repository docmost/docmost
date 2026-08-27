# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Docmost — open-source collaborative wiki/documentation app. Nx monorepo, pnpm workspaces.

- `apps/server` — NestJS (Fastify) API + real-time collaboration server (Hocuspocus/Yjs)
- `apps/client` — React 19 + Vite SPA (Mantine UI, TipTap editor, Jotai, TanStack Query)
- `packages/editor-ext` — shared TipTap editor extensions (workspace package, used by both apps)
- `packages/base-formula` — shared formula engine, built for both server and client targets
- `packages/ee` — enterprise-edition package (mostly a stub in this checkout, see Licensing below)

## Common commands

Run from repo root unless noted.

```bash
pnpm dev                    # run client + server together (concurrently)
pnpm client:dev             # client only (vite dev server)
pnpm server:dev             # server only (nest start --watch)
pnpm build                  # nx build all projects
pnpm server:build           # build server only
pnpm client:build           # build client only
pnpm collab:dev             # run the standalone collaboration server (dev)
```

Server (`apps/server`):
```bash
pnpm --filter server test               # jest unit tests
pnpm --filter server test -- <pattern>  # run a single test file/suite, e.g. auth.service.spec
pnpm --filter server test:watch
pnpm --filter server test:e2e           # jest e2e (test/jest-e2e.json)
pnpm --filter server lint               # eslint --fix
pnpm --filter server migration:create   # new kysely migration (src/database/migrations)
pnpm --filter server migration:up / :down / :latest / :redo
pnpm --filter server migration:codegen  # regenerate src/database/types/db.d.ts from the DB schema
pnpm --filter server email:dev          # preview react-email templates on :5019
```

Client (`apps/client`):
```bash
pnpm --filter client test        # vitest run
pnpm --filter client test:watch
pnpm --filter client lint
```

Local infra (Postgres + Redis) for dev: `docker-compose.yml` at the root spins up `db` and `redis`; the `docmost` service there is the production image, not needed for local dev.

## Architecture

### Server (`apps/server/src`)

- `main.ts` / `app.module.ts` — main API process. `collaboration/server/collab-main.ts` is a **separate entry point** that can run the collaboration (Yjs/Hocuspocus) server as its own process (`pnpm collab`), independent of the main API.
- `core/` — one Nest module per domain, wired together in `core/core.module.ts`: `auth`, `user`, `workspace`, `space`, `page`, `group`, `attachment`, `comment`, `share`, `label`, `notification`, `watcher`, `favorite`, `session`, `search`, `casl`. This is the primary place to add new domain features.
- `casl/` — CASL-based authorization (abilities), the source of truth for permission checks across spaces/pages.
- `database/` — Kysely (not an ORM/TypeORM). `database/types/db.d.ts` is generated from the live schema via `migration:codegen`; keep it in sync after writing/running migrations. `database/repos/` holds query repositories; `database/migrations/` is the migration history — check existing migrations for naming/shape conventions before adding one.
- `integrations/` — infra-facing modules: `environment` (typed config service reading env vars — add new env vars here, not via raw `process.env` elsewhere), `storage` (local/S3/Azure drivers), `mail` (smtp/postmark drivers + `transactional/` react-email templates), `queue` (BullMQ), `redis`, `security`, `telemetry`, `export`/`import`, `health`, `throttle`, `encryption`.
- `ws/` — WebSocket gateway (Socket.io) for app-level real-time events (distinct from the Yjs collab server).
- `ee/` — **git submodule** (`docmost/ee`, private repo), **not checked out in this workspace** (`apps/server/src/ee` is an empty directory here). `app.module.ts` loads it dynamically via a `require('./ee/ee.module')` wrapped in try/catch, so the app runs fine without it — enterprise-only server features (e.g. SSO/SAML config, SCIM, licensing) are unavailable in this checkout unless the submodule is initialized. If `CLOUD=true`, a missing EE module is fatal.

### Client (`apps/client/src`)

- `features/<domain>/` — API hooks/services and domain logic per feature (mirrors server `core/` domains: `auth`, `space`, `page`, `group`, `user`, `workspace`, etc.).
- `pages/` — route-level components (`react-router-dom`), grouped by area (`auth`, `settings`, `space`, `page`, `share`, ...).
- `components/` — shared/presentational components (`common`, `layouts`, `settings`, `ui`).
- `ee/` — enterprise-only client code **is** present in this checkout (unlike the server submodule) — e.g. `mfa`, `scim`, `billing`, `entitlement`, `licence`, `audit`, `page-permission`, `ai`. Check `ee/entitlement`/`ee/licence` for how EE features are feature-flagged at runtime.
- Vite reads a limited set of env vars at build time via `loadEnv` in `vite.config.ts` (`APP_URL`, `CLOUD`, `COLLAB_URL`, `SUBDOMAIN_HOST`, etc.) — new client-visible env vars must be added there explicitly, not just to `.env`.

### Cross-cutting

- Auth: JWT-based (`@nestjs/jwt`, `passport-jwt`), with `passport-google-oauth20`, `openid-client`, and `@node-saml/passport-saml` already present as server dependencies for OAuth/OIDC/SAML SSO flows; `ldapts` for LDAP. A `sso-auth` migration already exists (`database/migrations/20250118T194658-sso-auth.ts`) — check it and `core/auth` before adding new SSO-related schema.
- Licensing boundary: `apps/server/src/ee`, `apps/client/src/ee`, `packages/ee` are AGPL-excluded and covered by the Enterprise License (see root `README.md` / `packages/ee/LICENSE`). Don't move enterprise-only logic into non-`ee` paths, and don't assume `apps/server/src/ee` source is available locally — it's an uninitialized submodule here.
- Real-time collaboration is Hocuspocus/Yjs based (`collaboration/` on the server, `@hocuspocus/*` + `yjs` packages on the client), separate from the Socket.io `ws/` gateway used for app notifications/presence.
