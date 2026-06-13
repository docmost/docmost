# AGENTS.md — Cuervodocs

Fork of Docmost with all enterprise paywalls removed. Goal: 100% feature compatibility, no license gates, no subscription checks.

## Commands

```bash
pnpm dev                       # Both client + server concurrently
pnpm build                     # Full build (nx run-many)

# Server
pnpm --filter ./apps/server run start:dev
pnpm --filter ./apps/server run test            # Jest: **/*.spec.ts
pnpm --filter ./apps/server run lint            # ESLint --fix

# Client
pnpm --filter ./apps/client run dev
pnpm --filter ./apps/client run test            # Vitest
pnpm --filter ./apps/client run lint

# DB migrations (server only)
pnpm --filter ./apps/server run migration:latest
pnpm --filter ./apps/server run migration:create
pnpm --filter ./apps/server run migration:codegen  # → src/database/types/db.d.ts (AUTO-GENERATED, DO NOT EDIT)
```

## Project structure

```
apps/server/               NestJS + Fastify (CommonJS, Jest)
apps/client/               React + Vite + Mantine UI v8 (ESM, Vitest)
packages/editor-ext/       Shared editor extensions (TipTap)
packages/ee/               License file only — no code (can be removed)
```

## Key architecture

- **Global prefix** `api` in `main.ts`, excluding: `robots.txt`, `share/:shareId/p/:pageSlug`, `mcp`
- **All controllers use `@Post()`** for every endpoint (RPC-style, not REST)
- **Kysely ORM** with PostgreSQL — no ActiveRecord/TypeORM. Types in `apps/server/src/database/types/db.d.ts` auto-generated
- **Multi-tenant by workspace**: `DomainMiddleware` resolves `workspaceId` from hostname. JWT payload carries `workspaceId`
- **Collaboration**: separate Hocuspocus server entry (`collab:prod` / `collab:dev` commands)
- **CASL** for authorization (`apps/server/src/core/casl/`)

### Path aliases

| Scope | Alias | Resolves to |
|---|---|---|
| Server | `@docmost/db/*` | `./src/database/*` |
| Server | `@docmost/ee/*` | `./src/ee/*` |
| Server | `@docmost/transactional/*` | `./src/integrations/transactional/*` |
| Client | `@/*` | `./src/*` |

## Enterprise feature gating — what to remove/unlock

The fork removes all license checks so every feature is always available. Key gating mechanisms:

### Backend (`apps/server/src/`)

1. **`LicenseCheckService`** (`integrations/environment/license-check.service.ts`) — every method (`hasFeature`, `getFeatures`, `resolveFeatures`, `resolveTier`, `isValidEELicense`) tries to `require('../../ee/licence/license.service')` and returns `false`/`[]`/`null` on failure. **Rewrite to always return all features.**

2. **Dynamic `require()` for EE modules** in `app.module.ts:32-43` — loads `./ee/ee.module` if present. The server `src/ee/` directory is **empty**. Code that does `require('./../../../ee/...')` falls back gracefully:
   - `attachment.processor.ts` — `AttachmentEeService`
   - `file-task.processor.ts` / `file-import-task.service.ts` / `import.service.ts` — Confluence/DOCX/PDF import
   - `search.controller.ts` — Typesense search
   - `notification.processor.ts` — Page verification scheduler
   - `jwt.strategy.ts` — API key auth
   - `auth.controller.ts` — MFA service

   **These features need reimplementation** in `apps/server/src/ee/` (or move into core). Currently they 404/fail silently because the `require()` returns nothing.

3. **`workspace.licenseKey`** column and `licenseKey` checks throughout controllers/services — strip all references. The `POST /api/workspace/entitlements` endpoint should return all features unconditionally.

### Frontend (`apps/client/src/ee/`)

The `ee/` directory **contains real UI code** (not empty). Feature gating uses:
- `useHasFeature(Feature.X)` from `@/ee/hooks/use-feature.ts` — checks `entitlementAtom`
- `entitlementAtom` (Jotai atom) — populated from `POST /workspace/entitlements` response

**Fix**: make `useHasFeature()` always return `true`, or make the entitlements endpoint return all features. The `entitlement.types.ts` defines `Tier = "free" | "standard" | "business" | "enterprise"`.

### Feature keys (both sides)

Defined in `apps/server/src/common/features.ts` and `apps/client/src/ee/features.ts`:
`sso:custom`, `sso:google`, `mfa`, `api:keys`, `comment:resolution`, `page:permissions`, `ai`, `import:confluence`, `import:docx`, `import:pdf`, `attachment:indexing`, `security:settings`, `mcp`, `scim`, `page:verification`, `audit:logs`, `retention`, `sharing:controls`, `comment:viewer`, `templates`

Client also has: `pdf-export` (server `features.ts` lacks this — possible sync issue).

### Other gatekeeping

- **Stripe billing**: migrations exist (`billing.ts`, `more-billing-columns.ts`) with `stripeCustomerId`, `stripeSubscriptionId` etc columns. Remove.
- **`CLOUD=true`**: makes `app.module.ts` exit if EE module fails to load. The `EnvironmentService.isCloud()` method reads env `CLOUD`. Strip cloud-only logic.
- **`packages/ee/LICENSE`** and **`apps/client/src/ee/LICENSE`** — Docmost Enterprise License text. Remove.

## Key invariants

- **Never edit** `apps/server/src/database/types/db.d.ts` — generated by `kysely-codegen`. Run `migration:codegen` instead.
- **strictNullChecks is off** in both tsconfigs. Don't assume strict null safety.
- **No `.env` committed** — copy `.env.example`. `APP_SECRET` must be ≥32 chars.
- **Style**: server uses `@HttpCode(HttpStatus.OK)` + `@Post()` for every route.
- **Dependencies**: PostgreSQL + Redis required (see `docker-compose.yml`). Optional: Typesense, pgvector.