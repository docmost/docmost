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
packages/ee/               (removed — was license file only, no code)
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

## Completed work

### UI Rebrand: Docmost → Cuervodocs 

All user-facing "Docmost" branding replaced with "Cuervodocs". Internal code references (`@docmost/` package namespaces, variable names, export format) kept unchanged for upstream compatibility.

**Client changes:**
- `apps/client/index.html` — page title + apple-mobile-web-app-title
- `apps/client/public/manifest.json` — PWA name + short_name
- `apps/client/src/lib/config.ts` — `getAppName()` returns `"Cuervodocs"`
- `apps/client/src/features/auth/components/auth-layout.tsx` — logo alt + brand text
- `apps/client/src/components/layouts/global/app-header.tsx` — aria-label, alt, brand text
- `apps/client/src/features/home/components/home-ai-prompt.tsx` — fallback workspace name
- `apps/client/src/ee/ai-chat/components/chat-empty-state.tsx` — "Cuervodocs AI"
- `apps/client/src/ee/ai/pages/ai-settings.tsx` — enterprise edition text
- `apps/client/src/ee/ai/components/mcp-settings.tsx` — enterprise edition text + stubbed docmost.com link
- `apps/client/src/components/settings/settings-sidebar.tsx` — replaced `help@docmost.com` with generic support text
- `apps/client/src/ee/api-key/pages/user-api-keys.tsx` — stubbed `docmost.com/api-docs` and `docmost.com/docs` links
- `apps/client/src/ee/api-key/pages/workspace-api-keys.tsx` — stubbed `docmost.com/api-docs` link
- All 12 locale `translation.json` files — "Docmost" → "Cuervodocs", removed `sales@docmost.com`

**Server changes:**
- `apps/server/src/integrations/transactional/partials/partials.tsx` — email footer copyright
- `apps/server/src/integrations/transactional/emails/invitation-email.tsx` — invitation text
- `apps/server/src/core/workspace/services/workspace-invitation.service.ts` — email subjects
- `apps/server/src/integrations/environment/environment.service.ts` — default `MAIL_FROM_NAME`
- `apps/server/src/core/auth/token.module.ts` — JWT issuer
- `apps/server/src/core/share/share-seo.controller.ts` — share page fallback title

**Telemetry disabled:**
- `apps/server/src/integrations/telemetry/telemetry.service.ts` — gutted entirely, no outbound requests

**License files removed:**
- `packages/ee/LICENSE` — deleted (was Docmost Enterprise License, no code in this dir)
- `apps/client/src/ee/LICENSE` — deleted (was one-line Enterprise license notice)

**Intentionally unchanged (upstream compat):**
- `@docmost/editor-ext` package namespace and all `@docmost/*` path aliases
- Internal variable/function names (`readDocmostMetadata`, `docmostMetadata`, etc.)
- Export metadata format (`source: 'docmost'`, `docmost-metadata.json` filename)
- `version.service.ts` — still checks `docmost/docmost` GitHub releases
- `app-version.tsx` — still links to `docmost/docmost` releases
- Docker compose service names, image names, volume names
- `workspace.constants.ts` DISALLOWED_HOSTNAMES `'docmost'`
- `posthog-user.tsx` analytics source identifier
- `sso-login.tsx` localStorage key
- `workspace.service.ts` `@deleted.docmost.com` placeholder email
- `embed-provider.ts` third-party embed params (`embed_host=docmost`, `embedSource=docmost`)

## Key invariants

- **Never edit** `apps/server/src/database/types/db.d.ts` — generated by `kysely-codegen`. Run `migration:codegen` instead.
- **strictNullChecks is off** in both tsconfigs. Don't assume strict null safety.
- **No `.env` committed** — copy `.env.example`. `APP_SECRET` must be ≥32 chars.
- **Style**: server uses `@HttpCode(HttpStatus.OK)` + `@Post()` for every route.
- **Dependencies**: PostgreSQL + Redis required (see `docker-compose.yml`). Optional: Typesense, pgvector.