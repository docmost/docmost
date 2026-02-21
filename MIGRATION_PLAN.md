# Docmost Bun Server: Implementation Plan

## Executive Summary

This document outlines a plan to build a new Bun-native server for Docmost from
scratch in a dedicated `server/` directory. The new server mirrors all existing
Docmost server functionality using a simplified architecture: SQLite (via
`bun:sqlite`), Drizzle ORM, Better Auth, Hono, and Bun's native WebSocket with
built-in pub/sub. The existing NestJS codebase is used solely as a **reference**
for business logic and API contracts — it is not modified or executed under Bun.

---

## Reference Architecture (Existing Server)

The existing server in `apps/server/` serves as the feature reference:

| Layer | Existing Technology |
|---|---|
| Runtime | Node.js |
| Framework | NestJS + Fastify adapter |
| Database | PostgreSQL (via `postgres` driver + Kysely ORM) |
| Auth | Custom JWT + Passport.js (JWT, Google OAuth, SAML, LDAP, OIDC) |
| Real-time Collab | Hocuspocus (Y.js) over raw `ws` WebSocket, Redis Sync Extension |
| UI WebSocket | Socket.io + `@socket.io/redis-adapter` (page tree, notifications) |
| Queue | BullMQ (Redis-backed) — email, search, AI, history, notifications |
| Cache | Redis (ioredis) |
| Search | PostgreSQL full-text search (`tsvector`, `ts_rank`, `f_unaccent`) + optional Typesense |
| Storage | Local filesystem or S3 (AWS SDK) |
| Email | Nodemailer (SMTP) / Postmark + React Email templates |
| AI | AI SDK (OpenAI, Google, Ollama) + LangChain embeddings |
| Enterprise | SSO, MFA, API Keys |

### Key Database Entities (19 tables)
`workspaces`, `users`, `user_tokens`, `user_mfa`, `groups`, `group_users`,
`spaces`, `space_members`, `pages`, `page_history`, `comments`, `attachments`,
`backlinks`, `shares`, `workspace_invitations`, `auth_providers`, `auth_accounts`,
`notifications`, `watchers`, `file_tasks`, `api_keys`

---

## Target Architecture (New Server)

| Layer | Technology |
|---|---|
| Runtime | Bun |
| Framework | Hono on `Bun.serve()` |
| Database | SQLite via `bun:sqlite` + Drizzle ORM |
| Auth | Better Auth (email/password, OAuth, SAML, MFA, organizations) |
| Real-time Collab | Hocuspocus (Y.js) over Bun native WebSocket |
| UI WebSocket | Bun native WebSocket with built-in pub/sub |
| Queue | In-process task scheduler (no external service) |
| Cache | In-memory Map + SQLite |
| Search | SQLite FTS5 |
| Storage | Local filesystem (Bun.file API) or S3 |
| Email | Nodemailer or Resend |
| AI | AI SDK (compatible with Bun) |
| Validation | Zod |
| Frontend | React + Vite (unchanged, served as static build) |

### External Services
- **None required** for core functionality
- S3 remains optional for cloud storage
- SMTP/Postmark remains for email delivery
- AI providers remain external by nature

---

## Project Structure

The new server lives in its own top-level directory, completely independent of
the existing `apps/server/` NestJS codebase:

```
docmost/
├── apps/
│   ├── client/                ← existing React frontend (unchanged)
│   └── server/                ← existing NestJS server (reference only, not modified)
├── packages/                  ← existing shared packages
│   └── editor-ext/            ← TipTap extensions (reused by new server)
├── server/                    ← NEW Bun server (this plan)
│   ├── src/
│   │   ├── index.ts           ← Bun.serve() entry point
│   │   ├── app.ts             ← Hono app setup, middleware, route mounting
│   │   ├── database/
│   │   │   ├── db.ts          ← bun:sqlite connection + Drizzle instance
│   │   │   ├── schema/        ← Drizzle table definitions (one file per domain)
│   │   │   │   ├── workspaces.ts
│   │   │   │   ├── users.ts
│   │   │   │   ├── groups.ts
│   │   │   │   ├── spaces.ts
│   │   │   │   ├── pages.ts
│   │   │   │   ├── comments.ts
│   │   │   │   ├── attachments.ts
│   │   │   │   ├── auth.ts
│   │   │   │   ├── shares.ts
│   │   │   │   ├── notifications.ts
│   │   │   │   ├── api-keys.ts
│   │   │   │   ├── jobs.ts
│   │   │   │   └── index.ts   ← re-exports all schemas
│   │   │   └── repos/         ← data access layer (one file per domain)
│   │   │       ├── workspace.repo.ts
│   │   │       ├── user.repo.ts
│   │   │       ├── group.repo.ts
│   │   │       ├── space.repo.ts
│   │   │       ├── page.repo.ts
│   │   │       ├── comment.repo.ts
│   │   │       ├── attachment.repo.ts
│   │   │       ├── share.repo.ts
│   │   │       ├── notification.repo.ts
│   │   │       └── watcher.repo.ts
│   │   ├── routes/            ← Hono route handlers
│   │   │   ├── auth.routes.ts
│   │   │   ├── pages.routes.ts
│   │   │   ├── spaces.routes.ts
│   │   │   ├── users.routes.ts
│   │   │   ├── groups.routes.ts
│   │   │   ├── comments.routes.ts
│   │   │   ├── attachments.routes.ts
│   │   │   ├── search.routes.ts
│   │   │   ├── shares.routes.ts
│   │   │   ├── workspaces.routes.ts
│   │   │   ├── notifications.routes.ts
│   │   │   └── health.routes.ts
│   │   ├── services/          ← business logic (plain classes/functions)
│   │   │   ├── page.service.ts
│   │   │   ├── space.service.ts
│   │   │   ├── workspace.service.ts
│   │   │   ├── comment.service.ts
│   │   │   ├── attachment.service.ts
│   │   │   ├── search.service.ts
│   │   │   ├── share.service.ts
│   │   │   ├── notification.service.ts
│   │   │   └── email.service.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── workspace.middleware.ts
│   │   │   └── error.middleware.ts
│   │   ├── auth/
│   │   │   └── auth.ts        ← Better Auth configuration
│   │   ├── ws/
│   │   │   ├── ui-websocket.ts       ← Bun native WebSocket for UI events
│   │   │   ├── collab-websocket.ts   ← Hocuspocus integration
│   │   │   └── bun-ws-adapter.ts     ← Bun WS → ws API adapter for Hocuspocus
│   │   ├── lib/
│   │   │   ├── task-queue.ts         ← in-process job queue
│   │   │   ├── cache.ts             ← in-memory TTL cache
│   │   │   ├── uuid.ts              ← UUIDv7 generation
│   │   │   └── fts.ts               ← FTS5 helpers
│   │   └── validation/
│   │       └── schemas.ts           ← Zod schemas (mirror existing DTOs)
│   ├── scripts/
│   │   └── migrate-pg-to-sqlite.ts  ← one-time data migration from PostgreSQL
│   ├── drizzle/               ← generated migration files
│   ├── drizzle.config.ts
│   ├── package.json
│   ├── bunfig.toml
│   └── tsconfig.json
└── MIGRATION_PLAN.md          ← this file
```

---

## Implementation Phases

---

### Phase 1: Project Scaffolding & Database Layer

**Goal:** Set up the new `server/` directory with Bun, Drizzle ORM, and a
complete SQLite schema covering all 19 tables.

#### 1.1 Initialize the Project

```bash
mkdir server && cd server
bun init
bun add drizzle-orm hono zod
bun add -d drizzle-kit typescript @types/bun
```

```toml
# bunfig.toml
[install]
peer = false
```

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["bun-types"]
  },
  "include": ["src/**/*"]
}
```

#### 1.2 Database Connection

```typescript
// src/database/db.ts
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

const dbPath = Bun.env.DATABASE_PATH || './data/docmost.db';
const sqlite = new Database(dbPath);

// Performance pragmas
sqlite.run('PRAGMA journal_mode = WAL');
sqlite.run('PRAGMA synchronous = NORMAL');
sqlite.run('PRAGMA cache_size = -64000');    // 64MB page cache
sqlite.run('PRAGMA temp_store = MEMORY');
sqlite.run('PRAGMA foreign_keys = ON');
sqlite.run('PRAGMA busy_timeout = 5000');
sqlite.run('PRAGMA mmap_size = 30000000000');

export const db = drizzle(sqlite, { schema });
export { sqlite };
```

#### 1.3 Drizzle Configuration

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/database/schema/*',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/docmost.db',
  },
});
```

#### 1.4 Define All Drizzle Schemas

Column type mapping from the existing PostgreSQL schema:

| PostgreSQL Feature | SQLite/Drizzle Equivalent |
|---|---|
| `uuid` primary key (v7) | `text('id').primaryKey().$defaultFn(() => generateUUIDv7())` |
| `timestamp` / `timestamptz` | `text('created_at').$defaultFn(() => new Date().toISOString())` |
| `jsonb` columns | `text('content', { mode: 'json' })` |
| `text[]` (arrays) | `text('items', { mode: 'json' })` — store as JSON array |
| `boolean` | `integer('is_enabled', { mode: 'boolean' })` |
| `bigint` | `integer('file_size')` |
| `bytea` (ydoc) | `blob('ydoc')` |
| `tsvector` (FTS) | Separate FTS5 virtual table (see Phase 6) |
| `DEFAULT gen_random_uuid()` | Application-layer UUID generation |
| `DEFAULT now()` | Application-layer `new Date().toISOString()` |

**Schema files** (one per domain):

- `schema/workspaces.ts` — workspaces, workspace_invitations
- `schema/users.ts` — users, user_tokens, user_mfa
- `schema/groups.ts` — groups, group_users
- `schema/spaces.ts` — spaces, space_members
- `schema/pages.ts` — pages, page_history, backlinks
- `schema/comments.ts` — comments
- `schema/attachments.ts` — attachments, file_tasks
- `schema/auth.ts` — auth_providers, auth_accounts (may be managed by Better Auth)
- `schema/shares.ts` — shares
- `schema/notifications.ts` — notifications, watchers
- `schema/api-keys.ts` — api_keys
- `schema/jobs.ts` — _jobs (persistent task queue)

Example schema:

```typescript
// schema/pages.ts
import { sqliteTable, text, integer, blob, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { users } from './users';
import { spaces } from './spaces';
import { workspaces } from './workspaces';
import { generateUUIDv7 } from '../lib/uuid';

export const pages = sqliteTable('pages', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  title: text('title'),
  slugId: text('slug_id').notNull(),
  content: text('content', { mode: 'json' }),
  textContent: text('text_content'),
  ydoc: blob('ydoc'),
  icon: text('icon'),
  coverPhoto: text('cover_photo'),
  position: text('position'),
  isLocked: integer('is_locked', { mode: 'boolean' }).default(false),
  parentPageId: text('parent_page_id').references((): AnySQLiteColumn => pages.id),
  spaceId: text('space_id').notNull().references(() => spaces.id),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  creatorId: text('creator_id').references(() => users.id),
  lastUpdatedById: text('last_updated_by_id').references(() => users.id),
  deletedById: text('deleted_by_id').references(() => users.id),
  contributorIds: text('contributor_ids', { mode: 'json' }).$type<string[]>(),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  deletedAt: text('deleted_at'),
}, (table) => [
  index('pages_space_idx').on(table.spaceId),
  index('pages_workspace_idx').on(table.workspaceId),
  index('pages_creator_idx').on(table.creatorId),
  index('pages_parent_idx').on(table.parentPageId),
  index('pages_slug_idx').on(table.slugId),
]);

export const pageHistory = sqliteTable('page_history', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  pageId: text('page_id').notNull().references(() => pages.id),
  title: text('title'),
  content: text('content', { mode: 'json' }),
  textContent: text('text_content'),
  ydoc: blob('ydoc'),
  version: integer('version').notNull().default(1),
  lastUpdatedById: text('last_updated_by_id').references(() => users.id),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const backlinks = sqliteTable('backlinks', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  sourcePageId: text('source_page_id').notNull().references(() => pages.id),
  targetPageId: text('target_page_id').notNull().references(() => pages.id),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});
```

#### 1.5 Implement Repository Layer

Build repositories as plain classes that accept the Drizzle `db` instance.
Reference the existing Kysely repositories in `apps/server/src/` for the
exact query logic, translating each method to Drizzle.

**Repositories to implement (mirroring existing repos):**

| Repository | Reference File | Key Operations |
|---|---|---|
| `WorkspaceRepo` | `apps/server/.../workspace.repo.ts` | CRUD, find by hostname/domain |
| `UserRepo` | `apps/server/.../user.repo.ts` | CRUD, find by email, paginated list |
| `GroupRepo` | `apps/server/.../group.repo.ts` | CRUD, member management |
| `GroupUserRepo` | `apps/server/.../group-user.repo.ts` | Add/remove users from groups |
| `SpaceRepo` | `apps/server/.../space.repo.ts` | CRUD, member access |
| `SpaceMemberRepo` | `apps/server/.../space-member.repo.ts` | Membership queries, role checks |
| `PageRepo` | `apps/server/.../page.repo.ts` | CRUD, tree queries, descendants |
| `PageHistoryRepo` | `apps/server/.../page-history.repo.ts` | Version history |
| `CommentRepo` | `apps/server/.../comment.repo.ts` | Threaded comments |
| `AttachmentRepo` | `apps/server/.../attachment.repo.ts` | File metadata |
| `UserTokenRepo` | `apps/server/.../user-token.repo.ts` | Password reset tokens |
| `BacklinkRepo` | `apps/server/.../backlink.repo.ts` | Page cross-references |
| `ShareRepo` | `apps/server/.../share.repo.ts` | Public sharing |
| `NotificationRepo` | `apps/server/.../notification.repo.ts` | User notifications |
| `WatcherRepo` | `apps/server/.../watcher.repo.ts` | Page/space watchers |

Example Drizzle repository method:

```typescript
// repos/user.repo.ts
import { eq, and } from 'drizzle-orm';
import { users } from '../schema/users';

export class UserRepo {
  constructor(private db: typeof db) {}

  async findById(userId: string, workspaceId: string) {
    return this.db.query.users.findFirst({
      where: and(eq(users.id, userId), eq(users.workspaceId, workspaceId)),
    });
  }

  async findByEmail(email: string, workspaceId: string) {
    return this.db.query.users.findFirst({
      where: and(eq(users.email, email), eq(users.workspaceId, workspaceId)),
    });
  }
}
```

#### 1.6 SQLite-Specific Considerations

**Transactions** — SQLite provides SERIALIZABLE isolation. No `SELECT FOR UPDATE`
needed; use `db.transaction()` for atomic multi-statement operations:

```typescript
db.transaction(async (tx) => {
  // all operations within are atomic
}, { behavior: 'immediate' }); // acquire write lock immediately
```

**Array columns** — Stored as JSON text columns with `{ mode: 'json' }`.

**UUID v7 generation** — Application-layer via `uuidv7` package:
```typescript
import { uuidv7 } from 'uuidv7';
export const generateUUIDv7 = () => uuidv7();
```

**Unaccent function** — Register as custom SQLite function:
```typescript
sqlite.function('unaccent', (str: string) => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
});
```

#### 1.7 Generate and Apply Initial Migration

```bash
cd server
bunx drizzle-kit generate
bunx drizzle-kit migrate
```

#### Deliverable
Complete database layer: Drizzle schemas for all 19 tables, all repositories
implemented, migrations generated and applied. The database can be used
standalone in tests.

#### Risk Assessment
- **Medium risk** — Schema translation is mechanical but thorough
- JSON columns lose PostgreSQL's JSONB indexing — mitigate with SQLite indexes
  on extracted JSON fields via `json_extract()` if needed
- Binary data (ydoc blobs) works natively in SQLite

---

### Phase 2: HTTP Server & Routing

**Goal:** Build the Hono application with all API routes, middleware, validation,
and static file serving on `Bun.serve()`.

#### 2.1 Hono Application Setup

```typescript
// src/app.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authMiddleware } from './middleware/auth.middleware';
import { workspaceMiddleware } from './middleware/workspace.middleware';
import { errorMiddleware } from './middleware/error.middleware';

const app = new Hono();

// Global middleware
app.use('*', errorMiddleware);
app.use('*', cors());
app.use('*', logger());

// Auth routes (handled by Better Auth, no session required)
app.route('/api/auth', authRoutes);

// All other API routes require authentication + workspace context
app.use('/api/*', authMiddleware);
app.use('/api/*', workspaceMiddleware);

app.route('/api/pages', pageRoutes);
app.route('/api/spaces', spaceRoutes);
app.route('/api/users', userRoutes);
app.route('/api/groups', groupRoutes);
app.route('/api/comments', commentRoutes);
app.route('/api/attachments', attachmentRoutes);
app.route('/api/search', searchRoutes);
app.route('/api/shares', shareRoutes);
app.route('/api/workspaces', workspaceRoutes);
app.route('/api/notifications', notificationRoutes);
app.get('/api/health', (c) => c.json({ status: 'ok' }));

export default app;
```

```typescript
// src/index.ts — entry point
import app from './app';
import { setupWebSocket } from './ws/ui-websocket';
import { setupCollab } from './ws/collab-websocket';

Bun.serve({
  port: Number(Bun.env.PORT) || 3000,
  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade paths
    if (url.pathname === '/ws') return setupWebSocket(req, server);
    if (url.pathname === '/collab') return setupCollab(req, server);

    // HTTP routing via Hono
    return app.fetch(req);
  },
  websocket: {
    // ... WebSocket handlers (Phase 4)
  },
});

console.log(`Server running on port ${Bun.env.PORT || 3000}`);
```

#### 2.2 Middleware

**Auth middleware** — validates Better Auth session:
```typescript
// middleware/auth.middleware.ts
import { auth } from '../auth/auth';

export async function authMiddleware(c, next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: 'Unauthorized' }, 401);
  c.set('user', session.user);
  c.set('session', session.session);
  await next();
}
```

**Workspace middleware** — resolves workspace from domain/hostname:
```typescript
// middleware/workspace.middleware.ts
export async function workspaceMiddleware(c, next) {
  const hostname = c.req.header('host');
  const workspace = await workspaceRepo.findByHostname(hostname);
  if (!workspace) return c.json({ error: 'Workspace not found' }, 404);
  c.set('workspace', workspace);
  await next();
}
```

**Error middleware** — global error handler:
```typescript
// middleware/error.middleware.ts
export async function errorMiddleware(c, next) {
  try {
    await next();
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
}
```

#### 2.3 Validation with Zod

Define Zod schemas mirroring the existing `class-validator` DTOs in
`apps/server/src/`:

```typescript
// validation/schemas.ts
import { z } from 'zod';

export const createPageSchema = z.object({
  title: z.string().optional(),
  parentPageId: z.string().uuid().optional(),
  spaceId: z.string().uuid(),
  icon: z.string().optional(),
});

export const updatePageSchema = z.object({
  title: z.string().optional(),
  icon: z.string().optional(),
  coverPhoto: z.string().optional(),
  // ...
});
```

Use with Hono:
```typescript
import { zValidator } from '@hono/zod-validator';

pages.post('/create', zValidator('json', createPageSchema), async (c) => {
  const dto = c.req.valid('json');
  const user = c.get('user');
  // ...
});
```

#### 2.4 Route Handlers

Implement each route group by referencing the corresponding NestJS controller
for the API contract (HTTP method, path, request/response shape):

| Route File | Reference Controller | Endpoints |
|---|---|---|
| `auth.routes.ts` | `auth.controller.ts` | signup, login, forgot-password, etc. |
| `pages.routes.ts` | `page.controller.ts` | CRUD, move, tree, ordering |
| `spaces.routes.ts` | `space.controller.ts` | CRUD, members, permissions |
| `users.routes.ts` | `user.controller.ts` | profile, list, role changes |
| `groups.routes.ts` | `group.controller.ts` | CRUD, member management |
| `comments.routes.ts` | `comment.controller.ts` | CRUD, threading |
| `attachments.routes.ts` | `attachment.controller.ts` | upload, list, delete |
| `search.routes.ts` | `search.controller.ts` | full-text search, suggest |
| `shares.routes.ts` | `share.controller.ts` | create/revoke public shares |
| `workspaces.routes.ts` | `workspace.controller.ts` | settings, invitations |
| `notifications.routes.ts` | `notification.controller.ts` | list, mark read |

#### 2.5 Business Logic Services

Implement service classes as plain TypeScript — no decorators, no DI container.
Dependencies are passed via constructor or module-level singletons:

```typescript
// services/page.service.ts
export class PageService {
  constructor(
    private pageRepo: PageRepo,
    private backlinkRepo: BacklinkRepo,
    private taskQueue: TaskQueue,
  ) {}

  async createPage(dto: CreatePageInput, userId: string, workspaceId: string) {
    const page = await this.pageRepo.create({ ...dto, creatorId: userId, workspaceId });
    this.taskQueue.add('update-backlinks', { pageId: page.id });
    return page;
  }
}
```

Wire everything at startup:
```typescript
// src/startup.ts
import { db } from './database/db';
import { PageRepo } from './database/repos/page.repo';
import { PageService } from './services/page.service';
import { taskQueue } from './lib/task-queue';

export const pageRepo = new PageRepo(db);
export const pageService = new PageService(pageRepo, backlinkRepo, taskQueue);
// ... etc.
```

#### 2.6 Static File Serving & SPA Fallback

Serve the Vite-built frontend from the existing `apps/client/dist/`:

```typescript
import { serveStatic } from 'hono/bun';

// Serve frontend static assets
app.use('/*', serveStatic({ root: '../apps/client/dist' }));

// SPA fallback — all non-API routes serve index.html
app.get('*', (c) => {
  return c.html(Bun.file('../apps/client/dist/index.html'));
});
```

#### 2.7 File Upload Handling

```typescript
app.post('/api/attachments/upload', authMiddleware, async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const buffer = await file.arrayBuffer();
  const filename = `${generateUUIDv7()}-${file.name}`;
  await Bun.write(`./data/storage/${filename}`, buffer);
  // save metadata to attachments table
});
```

#### 2.8 Authorization (CASL)

Retain CASL for permission checks. CASL is framework-agnostic — it operates on
the authenticated user object regardless of how it was obtained:

```typescript
import { defineAbility } from '@casl/ability';

function buildAbility(user, workspaceRole, spaceMemberships) {
  return defineAbility((can, cannot) => {
    if (workspaceRole === 'owner') can('manage', 'all');
    // ... space-level permissions
  });
}
```

#### Deliverable
Fully functional HTTP server with all API routes, middleware, validation, file
uploads, and static file serving. The server responds to all the same API
endpoints as the existing NestJS server.

#### Risk Assessment
- **Medium risk** — Large surface area but each route is a straightforward translation
- CASL needs to work without NestJS guard decorators — use middleware instead
- File upload size limits need manual enforcement via Hono middleware

---

### Phase 3: Authentication (Better Auth)

**Goal:** Implement authentication using Better Auth with Drizzle adapter,
covering email/password, OAuth, MFA, and session management.

#### 3.1 Install and Configure

```bash
bun add better-auth
```

```typescript
// src/auth/auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../database/db';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'sqlite' }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 90, // 90 days
    },
  },
});
```

#### 3.2 Feature Coverage

| Feature | Implementation |
|---|---|
| Email/password login | Built-in `emailAndPassword` plugin |
| Session management | Built-in session cookies (replaces JWT) |
| Google OAuth | `@better-auth/social` plugin |
| SAML SSO | `@better-auth/saml` plugin or custom plugin |
| LDAP | Custom plugin wrapping `ldapts` |
| OIDC | `@better-auth/oidc` plugin |
| MFA/2FA (TOTP) | `@better-auth/two-factor` plugin |
| Password reset | Built-in forgot/reset password flow |
| Workspace invitation | Custom logic (workspace-specific tokens) |
| Collab token (WS auth) | Custom short-lived JWT via `jose` library |

#### 3.3 Better Auth Database Tables

Better Auth manages its own tables. Map them to the existing entity model:

- `user` → maps to `users` table (extend Better Auth's user model with workspace fields)
- `session` → new table (server-side sessions in SQLite)
- `account` → maps to `auth_accounts` table (OAuth provider links)
- `verification` → maps to `user_tokens` table (email verification, password reset)

Use Better Auth's schema customization to add workspace-specific fields (role,
workspaceId, etc.) to the user model.

#### 3.4 Auth Route Handler

```typescript
// routes/auth.routes.ts
import { auth } from '../auth/auth';

// Better Auth handles all /api/auth/* routes
export const authRoutes = new Hono();
authRoutes.all('/*', (c) => auth.handler(c.req.raw));
```

#### 3.5 Collab Token

The collaboration WebSocket uses a separate short-lived JWT. This is outside
Better Auth's scope:

```typescript
import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(Bun.env.APP_SECRET);

export async function generateCollabToken(userId: string, workspaceId: string) {
  return new SignJWT({ sub: userId, workspaceId, type: 'collab' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(secret);
}

export async function verifyCollabToken(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload;
}
```

#### Deliverable
Complete authentication system: login, registration, OAuth, password reset,
MFA, and session management via Better Auth. Collab tokens work for WebSocket
authentication.

#### Risk Assessment
- **Medium risk** — Auth is critical but Better Auth is well-tested
- SAML and LDAP may require custom plugins if Better Auth doesn't have official ones
- Workspace-scoped auth (multi-tenant) needs careful integration

---

### Phase 4: Real-Time & Collaboration

**Goal:** Implement UI WebSocket events and Y.js collaboration using Bun's
native WebSocket with built-in pub/sub.

#### 4.1 UI WebSocket (page tree, notifications, presence)

```typescript
// ws/ui-websocket.ts
export function setupWebSocket(req: Request, server: Server) {
  const session = await validateSession(req);
  if (!session) return new Response('Unauthorized', { status: 401 });
  server.upgrade(req, {
    data: { type: 'ui', userId: session.userId, workspaceId: session.workspaceId },
  });
}

// In Bun.serve websocket handlers:
const websocket = {
  open(ws) {
    if (ws.data.type === 'ui') {
      ws.subscribe(`user-${ws.data.userId}`);
      ws.subscribe(`workspace-${ws.data.workspaceId}`);
      // Subscribe to space channels based on membership
      const spaceIds = await getSpaceMemberships(ws.data.userId);
      for (const spaceId of spaceIds) {
        ws.subscribe(`space-${spaceId}`);
      }
    }
  },
  message(ws, message) {
    if (ws.data.type === 'ui') {
      const data = JSON.parse(message);
      if (data.spaceId) {
        ws.publish(`space-${data.spaceId}`, message);
      } else {
        ws.publish(`workspace-${ws.data.workspaceId}`, message);
      }
    }
  },
  close(ws) {
    // Bun automatically unsubscribes on close
  },
};
```

**Key Bun pub/sub features:**
- `ws.subscribe(topic)` — subscribe to a named channel
- `ws.publish(topic, message)` — broadcast to all subscribers (except self)
- Automatic cleanup on disconnect
- Per-process, in-memory — zero external dependencies

#### 4.2 Collaboration (Hocuspocus + Y.js)

Hocuspocus runs in the same `Bun.serve()` process. Since this is a single-process
server, no Redis Sync Extension is needed.

**Bun WebSocket → ws API adapter:**

Hocuspocus expects a Node.js `ws` WebSocket object. A thin adapter bridges
Bun's `ServerWebSocket` to the `ws` API:

```typescript
// ws/bun-ws-adapter.ts
import type { ServerWebSocket } from 'bun';

export class BunWsAdapter {
  private listeners = new Map<string, Set<Function>>();

  constructor(private bunWs: ServerWebSocket) {}

  send(data: string | Buffer) { this.bunWs.send(data); }
  close(code?: number, reason?: string) { this.bunWs.close(code, reason); }

  on(event: string, handler: Function) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
  }

  emit(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach(handler => handler(...args));
  }

  get readyState() { return this.bunWs.readyState; }
}
```

**Hocuspocus integration:**

```typescript
// ws/collab-websocket.ts
import { Hocuspocus } from '@hocuspocus/server';
import { BunWsAdapter } from './bun-ws-adapter';

const hocuspocus = new Hocuspocus({
  // Extensions for persistence (save ydoc to pages table), auth, etc.
});

export function setupCollab(req: Request, server: Server) {
  const token = new URL(req.url).searchParams.get('token');
  const payload = await verifyCollabToken(token);
  if (!payload) return new Response('Unauthorized', { status: 401 });
  server.upgrade(req, {
    data: { type: 'collab', userId: payload.sub, workspaceId: payload.workspaceId },
  });
}

// In Bun.serve websocket handlers, when ws.data.type === 'collab':
// Wrap the Bun WebSocket and hand off to Hocuspocus
// const adapter = new BunWsAdapter(ws);
// hocuspocus.handleConnection(adapter, req);
```

#### 4.3 Client-Side Changes

The frontend needs to use native `WebSocket` instead of `socket.io-client` for
UI events:

```typescript
// In apps/client/ — replace socket.io usage:
const ws = new WebSocket(`${WS_URL}/ws`);
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // handle page tree updates, notifications, presence
};
```

The `@hocuspocus/provider` for collaboration already uses standard WebSocket —
no client-side changes needed for collab.

#### Deliverable
UI events (page tree, notifications) and real-time collaboration both work over
Bun native WebSocket. No Socket.io, no Redis.

#### Risk Assessment
- **Medium-High risk** — Real-time collaboration is complex and latency-sensitive
- Hocuspocus ↔ Bun WebSocket adapter needs thorough testing
- Client-side WebSocket needs reconnection/retry logic

---

### Phase 5: Background Jobs

**Goal:** Implement an in-process task queue for email, search indexing, history,
notifications, and other background work.

#### 5.1 Job Types

| Job | Description | Approach |
|---|---|---|
| Email sending | Send verification/notification emails | Queue with retry |
| Search indexing | Update FTS5 index after page changes | Inline or queued |
| Page backlinks | Parse and update cross-references | Inline or queued |
| Page history | Save periodic snapshots | Debounced queue |
| Notifications | Generate and deliver notifications | Queue with retry |
| Attachments | Process uploaded files | Queue |
| AI embeddings | Generate/update embeddings | Queue |
| File import/export | Bulk operations | Queue |

#### 5.2 In-Process Task Queue

```typescript
// lib/task-queue.ts
type TaskHandler = (payload: any) => Promise<void>;

class TaskQueue {
  private handlers = new Map<string, TaskHandler>();
  private processing = false;
  private queue: Array<{ name: string; payload: any; attempts: number }> = [];

  register(name: string, handler: TaskHandler) {
    this.handlers.set(name, handler);
  }

  async add(name: string, payload: any, options?: { delay?: number }) {
    if (options?.delay) {
      setTimeout(() => this.enqueue(name, payload), options.delay);
    } else {
      this.enqueue(name, payload);
    }
  }

  private enqueue(name: string, payload: any) {
    this.queue.push({ name, payload, attempts: 0 });
    this.process();
  }

  private async process() {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      try {
        await this.handlers.get(job.name)?.(job.payload);
      } catch (err) {
        if (job.attempts < 3) {
          job.attempts++;
          this.queue.push(job); // retry
        } else {
          console.error(`Job ${job.name} failed after 3 attempts`, err);
        }
      }
    }
    this.processing = false;
  }
}

export const taskQueue = new TaskQueue();
```

#### 5.3 Debounced History Queue

```typescript
const historyDebouncer = new Map<string, Timer>();

function enqueuePageHistory(pageId: string, delay: number) {
  const existing = historyDebouncer.get(pageId);
  if (existing) clearTimeout(existing);
  historyDebouncer.set(pageId, setTimeout(async () => {
    historyDebouncer.delete(pageId);
    await savePageHistory(pageId);
  }, delay));
}
```

#### 5.4 Optional: SQLite-Backed Persistent Queue

For critical jobs (email) that must survive server restarts:

```typescript
const jobsTable = sqliteTable('_jobs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  payload: text('payload', { mode: 'json' }),
  status: text('status').default('pending'), // pending, processing, completed, failed
  attempts: integer('attempts').default(0),
  runAt: text('run_at'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});
```

On server startup, reprocess any jobs with `status = 'pending'` or
`status = 'processing'` (crashed mid-flight).

#### Deliverable
All background work runs in-process with retry logic. Critical jobs persist to
SQLite for crash recovery.

#### Risk Assessment
- **Low risk** — Jobs are mostly fire-and-forget
- Server restart loses in-flight non-persisted jobs (mitigated by SQLite fallback)

---

### Phase 6: Full-Text Search (SQLite FTS5)

**Goal:** Implement full-text search using SQLite FTS5 virtual tables with
automatic sync triggers.

#### 6.1 FTS5 Virtual Tables

```sql
-- Pages full-text search
CREATE VIRTUAL TABLE pages_fts USING fts5(
  title,
  text_content,
  content='pages',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

-- Attachments full-text search
CREATE VIRTUAL TABLE attachments_fts USING fts5(
  file_name,
  text_content,
  content='attachments',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);
```

FTS5's `unicode61 remove_diacritics 2` tokenizer handles diacritics natively,
replacing PostgreSQL's `f_unaccent` function.

#### 6.2 Sync Triggers

```sql
CREATE TRIGGER pages_fts_insert AFTER INSERT ON pages BEGIN
  INSERT INTO pages_fts(rowid, title, text_content)
  VALUES (NEW.rowid, NEW.title, NEW.text_content);
END;

CREATE TRIGGER pages_fts_update AFTER UPDATE ON pages BEGIN
  INSERT INTO pages_fts(pages_fts, rowid, title, text_content)
  VALUES ('delete', OLD.rowid, OLD.title, OLD.text_content);
  INSERT INTO pages_fts(rowid, title, text_content)
  VALUES (NEW.rowid, NEW.title, NEW.text_content);
END;

CREATE TRIGGER pages_fts_delete AFTER DELETE ON pages BEGIN
  INSERT INTO pages_fts(pages_fts, rowid, title, text_content)
  VALUES ('delete', OLD.rowid, OLD.title, OLD.text_content);
END;
```

These triggers are created via raw SQL in a Drizzle migration (Drizzle does not
have native FTS5/virtual table support).

#### 6.3 Search Service

```typescript
// services/search.service.ts
import { sql } from 'drizzle-orm';
import { sqlite } from '../database/db';

export class SearchService {
  async searchPages(query: string, workspaceId: string, spaceIds: string[], limit = 20, offset = 0) {
    const fts5Query = toFts5Query(query);
    return sqlite.prepare(`
      SELECT
        p.id, p.slug_id, p.title, p.icon, p.parent_page_id,
        p.creator_id, p.created_at, p.updated_at,
        bm25(pages_fts) as rank,
        snippet(pages_fts, 1, '<b>', '</b>', '...', 10) as highlight
      FROM pages_fts
      JOIN pages p ON p.rowid = pages_fts.rowid
      WHERE pages_fts MATCH ?
        AND p.deleted_at IS NULL
        AND p.workspace_id = ?
        AND p.space_id IN (${spaceIds.map(() => '?').join(',')})
      ORDER BY rank
      LIMIT ?
      OFFSET ?
    `).all(fts5Query, workspaceId, ...spaceIds, limit, offset);
  }
}

function toFts5Query(input: string): string {
  const terms = input.trim().split(/\s+/).filter(Boolean);
  return terms.map(t => `"${t}"*`).join(' ');
}
```

#### Deliverable
Full-text search with ranking (BM25) and highlighted snippets. Automatic index
sync via triggers.

#### Risk Assessment
- **Low risk** — FTS5 is well-proven and fast
- Ranking (BM25) differs from PostgreSQL `ts_rank` — results ordering may vary slightly

---

### Phase 7: Testing, Deployment & Data Migration

**Goal:** Comprehensive test coverage, Docker deployment, environment
configuration, and a data migration path for existing Docmost users.

#### 7.1 Testing

Use Bun's built-in test runner:

```bash
bun test
```

**Test layers:**
1. **Unit tests** — repository methods, service logic, utility functions
2. **Integration tests** — route handlers with real SQLite (in-memory mode: `new Database(':memory:')`)
3. **E2E tests** — full server with WebSocket collaboration
4. **Search tests** — FTS5 indexing and query accuracy

#### 7.2 In-Memory Cache

```typescript
// lib/cache.ts
export class MemoryCache {
  private cache = new Map<string, { value: any; expiresAt: number }>();

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set(key: string, value: any, ttlMs: number) {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string) {
    this.cache.delete(key);
  }
}

export const cache = new MemoryCache();
```

#### 7.3 SQLite Maintenance

```typescript
// Periodic optimization
function optimizeDatabase() {
  sqlite.run('PRAGMA optimize');
  sqlite.run('PRAGMA wal_checkpoint(TRUNCATE)');
}
setInterval(optimizeDatabase, 4 * 60 * 60 * 1000); // every 4 hours

// Backup
function backupDatabase() {
  const backupPath = `./data/backups/docmost-${Date.now()}.db`;
  sqlite.run(`VACUUM INTO '${backupPath}'`);
}
```

#### 7.4 Environment Configuration

```env
APP_URL=http://localhost:3000
PORT=3000
APP_SECRET=<random-32-chars>

# Database (SQLite file path)
DATABASE_PATH=./data/docmost.db

# Storage
STORAGE_DRIVER=local

# Mail
MAIL_DRIVER=smtp
SMTP_HOST=...
SMTP_PORT=...

# Optional: S3 storage
# AWS_S3_ACCESS_KEY_ID=
# AWS_S3_SECRET_ACCESS_KEY=
# AWS_S3_REGION=
# AWS_S3_BUCKET=
```

No `DATABASE_URL`, no `REDIS_URL`.

#### 7.5 Docker

```dockerfile
FROM oven/bun:1.3
WORKDIR /app
COPY server/package.json server/bun.lockb ./server/
RUN cd server && bun install --frozen-lockfile --production
COPY server/ ./server/
COPY apps/client/dist/ ./client/
EXPOSE 3000
VOLUME /app/data
CMD ["bun", "run", "server/src/index.ts"]
```

```yaml
# docker-compose.yml
services:
  docmost:
    build: .
    environment:
      APP_URL: 'http://localhost:3000'
      APP_SECRET: 'REPLACE_WITH_LONG_SECRET'
    ports:
      - "3000:3000"
    restart: unless-stopped
    volumes:
      - docmost_data:/app/data

volumes:
  docmost_data:   # SQLite DB + local file storage
```

Single service. No PostgreSQL, no Redis.

#### 7.6 Data Migration Script (PostgreSQL → SQLite)

For existing Docmost users migrating from the upstream version:

```typescript
// scripts/migrate-pg-to-sqlite.ts
// 1. Connect to existing PostgreSQL via DATABASE_URL
// 2. Read all tables in dependency order
// 3. Transform data (arrays → JSON, timestamps → ISO strings, bytea → Buffer)
// 4. Insert into SQLite via Drizzle
// 5. Validate row counts and referential integrity
// 6. Rebuild FTS5 index
```

Table migration order (respecting foreign keys):
1. `workspaces`
2. `users`
3. `groups`, `group_users`
4. `spaces`, `space_members`
5. `pages`, `page_history`, `backlinks`
6. `comments`
7. `attachments`, `file_tasks`
8. `auth_providers`, `auth_accounts`
9. `workspace_invitations`
10. `user_tokens`, `user_mfa`
11. `shares`
12. `notifications`, `watchers`
13. `api_keys`

```bash
# Usage:
DATABASE_URL=postgres://... bun run scripts/migrate-pg-to-sqlite.ts
```

#### 7.7 Build & Deploy Options

```bash
# Development
bun run server/src/index.ts

# Single binary (optional)
bun build server/src/index.ts --compile --outfile=docmost

# Docker
docker compose up -d
```

#### Deliverable
Test suite passing under `bun test`. Docker image with single service. Data
migration script verified. Production-ready deployment.

---

## Implementation Order & Dependencies

```
Phase 1: Database Layer (Drizzle + SQLite schemas + repos)
    │
    ├──► Phase 3: Auth (Better Auth)           ← can start once schema exists
    │
    ├──► Phase 6: Search (FTS5)                ← can start once schema exists
    │
    ▼
Phase 2: HTTP Server & Routing (Hono)          ← needs repos + auth
    │
    ├──► Phase 4: Real-Time (Bun WebSocket)    ← needs server running
    │
    ├──► Phase 5: Background Jobs              ← needs server running
    │
    ▼
Phase 7: Testing, Deployment & Data Migration  ← final integration
```

**Parallelizable:** Phases 3 and 6 can start in parallel after Phase 1.
Phases 4 and 5 can start in parallel after Phase 2.

---

## What Stays Unchanged

These components are reused directly from the existing codebase:

| Component | Rationale |
|---|---|
| **Frontend (`apps/client/`)** | Completely independent of server runtime; served as static build |
| **TipTap editor & extensions** | Client-side only |
| **`editor-ext` package** | Shared TipTap extensions; no server dependency |
| **Y.js / Hocuspocus protocol** | Kept for collaboration; only transport changes |
| **AI SDK (OpenAI/Google/Ollama)** | External API calls; runtime-agnostic |
| **S3 storage option** | AWS SDK works under Bun |
| **Email templates (React Email)** | Rendering is runtime-agnostic |
| **CASL authorization** | Framework-agnostic permission library |

---

## Known Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Hocuspocus WebSocket adapter compatibility | High | Build adapter layer; extensive testing; keep `ws` as fallback |
| SQLite single-writer bottleneck under heavy write load | Medium | WAL mode; writes are fast; adequate for self-hosted |
| Better Auth missing SAML/LDAP plugins | Medium | Write custom plugins wrapping `ldapts` |
| Loss of horizontal scaling (single process) | Medium | Acceptable for self-hosted target; document limits |
| Data migration errors (PG → SQLite) | High | Comprehensive migration script with validation |
| API contract drift from reference server | Medium | Compare route definitions systematically; test against existing frontend |
| SQLite database size limits | Low | SQLite supports up to 281TB; typical instances are <10GB |

---

## Success Criteria

1. **Zero external services** — Application starts with only a SQLite file on disk
2. **Feature parity** — All existing API endpoints and behaviors are implemented
3. **Frontend compatibility** — The existing React frontend works unmodified against the new server
4. **Performance** — Response times equal or better than existing stack
5. **Single Docker service** — `docker-compose.yml` has one service, no sidecar DBs
6. **Simple start** — Can run with `bun run server/src/index.ts` directly
7. **Data migration path** — Existing PostgreSQL data can be migrated cleanly
8. **Startup time** — Server boots in under 1 second
