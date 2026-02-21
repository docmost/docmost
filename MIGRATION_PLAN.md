# Docmost Migration Plan: Bun + Drizzle/SQLite + Better Auth

## Executive Summary

This document outlines a phased migration of the Docmost server from its current
Node.js/NestJS/PostgreSQL/Redis stack to a simplified Bun-native architecture using
SQLite (via `bun:sqlite`), Drizzle ORM, Better Auth, and Bun's native WebSocket with
built-in pub/sub. The goal is to eliminate all external service dependencies (PostgreSQL,
Redis) and produce a single-binary, self-contained server.

---

## Current Architecture

| Layer | Current Technology |
|---|---|
| Runtime | Node.js |
| Framework | NestJS + Fastify adapter |
| Database | PostgreSQL (via `postgres` driver + Kysely ORM) |
| Auth | Custom JWT + Passport.js (JWT, Google OAuth, SAML, LDAP, OIDC) |
| Real-time Collab | Hocuspocus (Y.js) over raw `ws` WebSocket, Redis Sync Extension |
| UI WebSocket | Socket.io + `@socket.io/redis-adapter` (page tree, notifications) |
| Queue | BullMQ (Redis-backed) - email, search, AI, history, notifications |
| Cache | Redis (ioredis) |
| Search | PostgreSQL full-text search (`tsvector`, `ts_rank`, `f_unaccent`) + optional Typesense |
| Storage | Local filesystem or S3 (AWS SDK) |
| Email | Nodemailer (SMTP) / Postmark + React Email templates |
| AI | AI SDK (OpenAI, Google, Ollama) + LangChain embeddings |
| Build | pnpm + Nx monorepo |
| Frontend | React + Vite + Mantine UI + TipTap editor |
| Enterprise | SSO, MFA, Billing (Stripe), API Keys |

### External Service Dependencies (to be removed)
- **PostgreSQL** - primary database
- **Redis** - pub/sub, queues, caching, WebSocket adapter, collab sync

### Key Database Entities (20 tables)
`workspaces`, `users`, `user_tokens`, `user_mfa`, `groups`, `group_users`,
`spaces`, `space_members`, `pages`, `page_history`, `comments`, `attachments`,
`backlinks`, `shares`, `workspace_invitations`, `auth_providers`, `auth_accounts`,
`notifications`, `watchers`, `file_tasks`, `billing`, `api_keys`

---

## Target Architecture

| Layer | Target Technology |
|---|---|
| Runtime | Bun |
| Framework | `Bun.serve()` with lightweight router (Hono or custom) |
| Database | SQLite via `bun:sqlite` + Drizzle ORM |
| Auth | Better Auth (email/password, OAuth, SAML, MFA, organizations) |
| Real-time Collab | Hocuspocus (Y.js) over Bun native WebSocket |
| UI WebSocket | Bun native WebSocket with built-in pub/sub |
| Queue | In-process task scheduler (no external service) |
| Cache | In-memory Map + SQLite |
| Search | SQLite FTS5 |
| Storage | Local filesystem (Bun.file API) or S3 |
| Email | Nodemailer (retained) or Resend |
| AI | AI SDK (retained - compatible with Bun) |
| Build | Bun workspace (replaces pnpm + Nx) |
| Frontend | React + Vite (unchanged) |

### External Services After Migration
- **None required** for core functionality
- S3 remains optional for cloud storage
- SMTP/Postmark remains for email delivery
- AI providers remain external by nature

---

## Migration Phases

---

### Phase 0: Preparation & Bun Runtime Switchover

**Goal:** Run the existing codebase under Bun without changing application logic.
Establish that all npm dependencies work under Bun.

#### Tasks

1. **Install Bun and validate the dev environment**
   - Install Bun globally
   - Create `bunfig.toml` with workspace configuration
   - Replace `pnpm` with `bun` for package management
   - Run `bun install` and resolve any dependency issues

2. **Validate existing code runs under Bun**
   - Run the server with `bun run apps/server/src/main.ts`
   - Identify and fix any Node.js APIs not supported by Bun
   - Test all major features manually (auth, pages, collab)
   - Document any packages that need replacement

3. **Replace `tsx` with Bun's native TypeScript execution**
   - Bun executes TypeScript natively - no transpilation step needed
   - Update `package.json` scripts to use `bun` instead of `tsx` / `node`

4. **Replace Nx build system**
   - Migrate from `pnpm workspaces + Nx` to `bun workspaces`
   - Update `package.json` workspace configuration for Bun

#### Deliverable
The existing Docmost application boots and runs under `bun` with PostgreSQL and Redis
still connected. All features work identically.

#### Risk Assessment
- **Low risk** - Bun has excellent Node.js compatibility
- NestJS and Fastify run under Bun
- `bcrypt` native module may need `bun add bcrypt` rebuild or switch to `@node-rs/bcrypt`

---

### Phase 1: Database Migration (PostgreSQL → SQLite/Drizzle)

**Goal:** Replace PostgreSQL + Kysely with SQLite + Drizzle ORM. This is the most
foundational change and must be completed before other phases.

#### 1.1 Set Up Drizzle ORM with bun:sqlite

```typescript
// Example: drizzle.config.ts
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

```typescript
// Example: database connection
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

const sqlite = new Database('./data/docmost.db');

// Performance pragmas
sqlite.run('PRAGMA journal_mode = WAL');
sqlite.run('PRAGMA synchronous = NORMAL');
sqlite.run('PRAGMA cache_size = 20000');
sqlite.run('PRAGMA temp_store = MEMORY');
sqlite.run('PRAGMA foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
```

#### 1.2 Define Drizzle Schema (all 20+ tables)

Map each Kysely/PostgreSQL table to a Drizzle SQLite schema. Key translation rules:

| PostgreSQL Feature | SQLite/Drizzle Equivalent |
|---|---|
| `uuid` primary key (v7) | `text('id').primaryKey().$defaultFn(() => generateUUIDv7())` |
| `timestamp` / `timestamptz` | `text('created_at').$defaultFn(() => new Date().toISOString())` |
| `jsonb` columns | `text('content', { mode: 'json' })` |
| `text[]` (arrays) | `text('items', { mode: 'json' })` — store as JSON array |
| `boolean` | `integer('is_enabled', { mode: 'boolean' })` |
| `bigint` | `integer('file_size')` |
| `bytea` (ydoc) | `blob('ydoc')` |
| `tsvector` (FTS) | Separate FTS5 virtual table (see Phase 4) |
| `DEFAULT gen_random_uuid()` | Application-layer UUID generation |
| `DEFAULT now()` | Application-layer `new Date().toISOString()` |

**Schema files to create** (one per domain):

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
- `schema/billing.ts` — billing
- `schema/api-keys.ts` — api_keys

Example schema file:

```typescript
// schema/pages.ts
import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core';
import { users } from './users';
import { spaces } from './spaces';
import { workspaces } from './workspaces';

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
  parentPageId: text('parent_page_id').references(() => pages.id),
  spaceId: text('space_id').notNull().references(() => spaces.id),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  creatorId: text('creator_id').references(() => users.id),
  lastUpdatedById: text('last_updated_by_id').references(() => users.id),
  deletedById: text('deleted_by_id').references(() => users.id),
  contributorIds: text('contributor_ids', { mode: 'json' }).$type<string[]>(),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  deletedAt: text('deleted_at'),
});
```

#### 1.3 Generate Initial Migration

```bash
bunx drizzle-kit generate
bunx drizzle-kit migrate
```

#### 1.4 Rewrite Repository Layer

Replace all Kysely repository classes with Drizzle query equivalents:

**Current repositories to migrate (12 repos):**

| Repository | File | Key Operations |
|---|---|---|
| `WorkspaceRepo` | `repos/workspace/workspace.repo.ts` | CRUD, find by hostname/domain |
| `UserRepo` | `repos/user/user.repo.ts` | CRUD, find by email, paginated list |
| `GroupRepo` | `repos/group/group.repo.ts` | CRUD, member management |
| `GroupUserRepo` | `repos/group/group-user.repo.ts` | Add/remove users from groups |
| `SpaceRepo` | `repos/space/space.repo.ts` | CRUD, member access |
| `SpaceMemberRepo` | `repos/space/space-member.repo.ts` | Membership queries, role checks |
| `PageRepo` | `repos/page/page.repo.ts` | CRUD, tree queries, descendants |
| `PageHistoryRepo` | `repos/page/page-history.repo.ts` | Version history |
| `CommentRepo` | `repos/comment/comment.repo.ts` | Threaded comments |
| `AttachmentRepo` | `repos/attachment/attachment.repo.ts` | File metadata |
| `UserTokenRepo` | `repos/user-token/user-token.repo.ts` | Password reset tokens |
| `BacklinkRepo` | `repos/backlink/backlink.repo.ts` | Page cross-references |
| `ShareRepo` | `repos/share/share.repo.ts` | Public sharing |
| `NotificationRepo` | `repos/notification/notification.repo.ts` | User notifications |
| `WatcherRepo` | `repos/watcher/watcher.repo.ts` | Page/space watchers |

**Translation pattern:**

```typescript
// Before (Kysely):
const user = await this.db
  .selectFrom('users')
  .selectAll()
  .where('id', '=', userId)
  .where('workspaceId', '=', workspaceId)
  .executeTakeFirst();

// After (Drizzle):
const user = await db.query.users.findFirst({
  where: and(eq(users.id, userId), eq(users.workspaceId, workspaceId)),
});
```

#### 1.5 Handle PostgreSQL-Specific Features

**Transactions:**
```typescript
// Kysely: executeTx(this.db, async (trx) => { ... })
// Drizzle:
db.transaction(async (tx) => {
  // use tx instead of db
});
```

**Locking (SELECT FOR UPDATE):**
SQLite uses a single-writer model. Remove `SELECT FOR UPDATE` and rely on SQLite's
implicit serialization of writes via WAL mode. For critical sections, use
`db.transaction()` which provides SERIALIZABLE isolation in SQLite.

**Array columns (`text[]`, `string[]`):**
Store as JSON text columns. Drizzle supports `{ mode: 'json' }` on text columns.

**UUID v7 generation:**
Move from PostgreSQL function `uuid_generate_v7()` to application-layer generation:
```typescript
import { uuidv7 } from 'uuidv7'; // or custom implementation
```

**Unaccent function (`f_unaccent`):**
Create a custom SQLite function:
```typescript
sqlite.function('unaccent', (str: string) => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
});
```

#### 1.6 Data Migration Script

Create a one-time script to migrate existing PostgreSQL data to SQLite:

```typescript
// scripts/migrate-pg-to-sqlite.ts
// 1. Connect to existing PostgreSQL
// 2. Read all tables in dependency order
// 3. Transform data (arrays → JSON, timestamps → ISO strings)
// 4. Insert into SQLite via Drizzle
// 5. Validate row counts and referential integrity
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
13. `billing`, `api_keys`

#### Deliverable
Application runs with SQLite instead of PostgreSQL. All CRUD operations, pagination,
and relational queries function correctly. PostgreSQL is no longer required.

#### Risk Assessment
- **High risk** - Most invasive change; touches every data access path
- SQLite single-writer model is actually simpler than Postgres for a single-server app
- JSON columns lose PostgreSQL's JSONB indexing - mitigate with SQLite indexes on
  extracted JSON fields if needed
- Binary data (ydoc blobs) work natively in SQLite

---

### Phase 2: Authentication Migration (Custom JWT → Better Auth)

**Goal:** Replace the custom Passport.js/JWT authentication system with Better Auth.
Better Auth provides email/password, OAuth, MFA, organizations, and session management
out of the box with Drizzle adapter support.

#### 2.1 Install and Configure Better Auth

```bash
bun add better-auth
```

```typescript
// auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './database';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'sqlite' }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 90, // 90 days (matches current JWT_TOKEN_EXPIRES_IN)
    },
  },
});
```

#### 2.2 Map Current Auth Features to Better Auth

| Current Feature | Current Implementation | Better Auth Equivalent |
|---|---|---|
| Email/password login | Custom `AuthService.login()` + bcrypt | Built-in `emailAndPassword` |
| JWT tokens in httpOnly cookie | Custom `TokenService` + `@nestjs/jwt` | Built-in session cookies |
| Google OAuth | `passport-google-oauth20` | `@better-auth/social` plugin |
| SAML SSO | `@node-saml/passport-saml` | `@better-auth/saml` plugin (if available) or custom plugin |
| LDAP | `ldapts` | Custom plugin wrapping `ldapts` |
| OIDC | `openid-client` | `@better-auth/oidc` plugin |
| MFA/2FA (TOTP) | Custom EE module with `otpauth` | `@better-auth/two-factor` plugin |
| Password reset | Custom `UserToken` + email flow | Built-in forgot/reset password |
| Workspace invitation | Custom invitation tokens | Custom logic (retained) |
| Collab token (short-lived JWT) | Separate JWT for WebSocket auth | Custom - retain short-lived JWT for WS |
| CASL authorization | `@casl/ability` | Retain CASL - Better Auth handles authn, not authz |

#### 2.3 Better Auth Database Tables

Better Auth manages its own tables. Reconcile with existing schema:

- `user` → maps to existing `users` table (extend Better Auth's user model)
- `session` → new table (replaces JWT-based stateless sessions)
- `account` → maps to existing `auth_accounts` table
- `verification` → maps to existing `user_tokens` table

Use Better Auth's schema customization to align with existing column names where possible.

#### 2.4 Migration Steps

1. **Add Better Auth tables** via Drizzle migration alongside existing tables
2. **Create auth route handler** that integrates with the HTTP server:
   ```typescript
   // All Better Auth routes handled under /api/auth/*
   if (url.pathname.startsWith('/api/auth')) {
     return auth.handler(request);
   }
   ```
3. **Migrate session validation middleware:**
   ```typescript
   // Before: JwtAuthGuard + JwtStrategy
   // After:
   const session = await auth.api.getSession({ headers: request.headers });
   if (!session) return new Response('Unauthorized', { status: 401 });
   ```
4. **Migrate user creation flow** (signup service → Better Auth signup)
5. **Migrate OAuth providers** to Better Auth social plugins
6. **Migrate password reset flow** to Better Auth built-in flow
7. **Keep workspace-specific logic** (workspace lookup via domain middleware) as
   custom middleware wrapping Better Auth
8. **Keep CASL authorization** - it operates on the authenticated user, independent of
   how authentication is performed

#### 2.5 Collab Token Handling

The collaboration WebSocket uses a separate short-lived JWT for authentication.
This is a specialized concern outside Better Auth's scope. Retain the custom
collab token generation:

```typescript
// Keep a lightweight JWT utility for collab tokens only
import { sign, verify } from 'jsonwebtoken'; // or jose library

function generateCollabToken(userId: string, workspaceId: string): string {
  return sign({ sub: userId, workspaceId, type: 'collab' }, APP_SECRET, {
    expiresIn: '24h',
  });
}
```

#### 2.6 Auth Data Migration

- Existing password hashes (bcrypt) must be preserved. Better Auth supports bcrypt.
- Migrate existing `auth_accounts` to Better Auth's account model
- Existing sessions (JWT-based) will be invalidated — users must re-login after migration

#### Deliverable
Authentication is handled entirely by Better Auth. Login, registration, OAuth,
password reset, and session management work through Better Auth's API. MFA continues
to work via Better Auth's two-factor plugin.

#### Risk Assessment
- **Medium risk** - Auth is critical but Better Auth is well-tested
- SAML and LDAP may require custom plugins if Better Auth doesn't have official ones
- Workspace-scoped auth (multi-tenant) needs careful integration since Better Auth
  has an organizations plugin but Docmost's workspace model is custom
- All existing sessions will be invalidated on switchover (acceptable for a migration)

---

### Phase 3: Framework Migration (NestJS → Bun.serve)

**Goal:** Remove NestJS and Fastify. Replace with `Bun.serve()` and a lightweight
router. Eliminate the dependency injection container in favor of explicit module imports.

#### 3.1 Choose Router Strategy

**Option A: Hono (Recommended)**
Hono is a lightweight, fast web framework that runs natively on Bun:
```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

const app = new Hono();
app.use('*', cors());
app.use('*', logger());

// Routes
app.route('/api/auth', authRoutes);
app.route('/api/pages', pageRoutes);
// ...

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};
```

**Option B: Custom minimal router on Bun.serve()**
For maximum control and zero dependencies:
```typescript
Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    // manual routing
  },
  websocket: { /* ... */ },
});
```

**Recommendation:** Use Hono. It provides middleware, routing, validation, and static
file serving with minimal overhead, and has first-class Bun support. It also integrates
cleanly with Better Auth.

#### 3.2 Replace NestJS Module System

Map NestJS modules to plain TypeScript modules with explicit dependency wiring:

| NestJS Pattern | Bun/Hono Equivalent |
|---|---|
| `@Module({ providers, exports })` | ES module exports |
| `@Injectable()` service | Plain class, instantiated at startup |
| `@Controller()` + `@Post()` | Hono route handler |
| `@UseGuards(JwtAuthGuard)` | Hono middleware |
| `ValidationPipe` + class-validator | Zod schemas + Hono validator |
| `@InjectKysely()` | Direct import of `db` instance |
| `EventEmitterModule` | `mitt` (already a dependency) or Bun EventTarget |
| `ConfigService` | `process.env` or `Bun.env` directly |
| `ScheduleModule` | `setInterval` or a lightweight cron library |

#### 3.3 Create Route Modules

Convert each NestJS controller to a Hono route group:

```
apps/server/src/
├── routes/
│   ├── auth.routes.ts        ← from auth.controller.ts
│   ├── pages.routes.ts       ← from page.controller.ts
│   ├── spaces.routes.ts      ← from space.controller.ts
│   ├── users.routes.ts       ← from user.controller.ts
│   ├── groups.routes.ts      ← from group.controller.ts
│   ├── comments.routes.ts    ← from comment.controller.ts
│   ├── attachments.routes.ts ← from attachment.controller.ts
│   ├── search.routes.ts      ← from search.controller.ts
│   ├── shares.routes.ts      ← from share.controller.ts
│   ├── workspaces.routes.ts  ← from workspace.controller.ts
│   ├── notifications.routes.ts
│   └── health.routes.ts
├── middleware/
│   ├── auth.middleware.ts     ← session validation
│   ├── workspace.middleware.ts ← workspace resolution (from domain.middleware.ts)
│   └── validation.middleware.ts
├── services/                  ← business logic (plain classes)
├── database/
│   ├── schema/               ← Drizzle schemas
│   ├── repos/                ← data access layer
│   └── db.ts                 ← database connection
└── index.ts                  ← Bun.serve() entry point
```

Example controller migration:

```typescript
// Before (NestJS):
@Controller('pages')
export class PageController {
  @UseGuards(JwtAuthGuard)
  @Post('create')
  async create(@Body() dto: CreatePageDto, @AuthUser() user: User) { ... }
}

// After (Hono):
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { zValidator } from '@hono/zod-validator';

const pages = new Hono();
pages.use('*', authMiddleware);

pages.post('/create', zValidator('json', createPageSchema), async (c) => {
  const user = c.get('user');
  const dto = c.req.valid('json');
  // ... business logic
});

export default pages;
```

#### 3.4 Replace Validation

Replace `class-validator` + `class-transformer` with Zod (already used on the frontend):

```typescript
// Before: DTO class with decorators
export class CreatePageDto {
  @IsString() title: string;
  @IsUUID() spaceId: string;
}

// After: Zod schema
export const createPageSchema = z.object({
  title: z.string(),
  spaceId: z.string().uuid(),
});
```

#### 3.5 Replace NestJS DI with Explicit Wiring

```typescript
// startup.ts — wire everything together
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './database/schema';

// Database
const sqlite = new Database('./data/docmost.db');
export const db = drizzle(sqlite, { schema });

// Repositories (plain classes)
export const pageRepo = new PageRepo(db);
export const userRepo = new UserRepo(db);
// ...

// Services
export const pageService = new PageService(pageRepo, ...);
// ...
```

#### 3.6 Static File Serving

Replace `@fastify/static` with Hono's static file middleware or Bun.file():

```typescript
import { serveStatic } from 'hono/bun';

// Serve the Vite-built frontend
app.use('/*', serveStatic({ root: './apps/client/dist' }));

// SPA fallback
app.get('*', (c) => {
  return c.html(Bun.file('./apps/client/dist/index.html'));
});
```

#### 3.7 File Upload Handling

Replace `@fastify/multipart` with Bun's native FormData/Blob handling:

```typescript
app.post('/api/attachments/upload', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const buffer = await file.arrayBuffer();
  await Bun.write(`./data/storage/${filename}`, buffer);
});
```

#### Deliverable
The application runs on `Bun.serve()` with Hono routing. NestJS, Fastify, and all
`@nestjs/*` packages are removed from dependencies. The server boots in milliseconds.

#### Risk Assessment
- **Medium risk** - Large surface area but straightforward mechanical translation
- NestJS interceptors/guards/pipes need careful 1:1 mapping
- The CASL authorization module needs to work without NestJS decorators
- File upload size limits need manual enforcement

---

### Phase 4: Real-Time Migration (Socket.io + Redis → Bun Native WebSocket)

**Goal:** Replace Socket.io (with Redis adapter) and the separate collab Redis sync
with Bun's native WebSocket and built-in pub/sub.

#### 4.1 Bun Native WebSocket for UI Events (replacing Socket.io)

The current `WsGateway` uses Socket.io for page tree updates, notifications, and
presence. Replace with Bun's native WebSocket:

```typescript
Bun.serve({
  port: 3000,
  fetch(req, server) {
    const url = new URL(req.url);

    // Upgrade WebSocket connections
    if (url.pathname === '/ws') {
      const session = await validateSession(req);
      if (!session) return new Response('Unauthorized', { status: 401 });
      server.upgrade(req, { data: { userId: session.userId, workspaceId: session.workspaceId } });
      return;
    }

    // ... HTTP routing
  },
  websocket: {
    open(ws) {
      // Subscribe to user-specific and workspace channels
      ws.subscribe(`user-${ws.data.userId}`);
      ws.subscribe(`workspace-${ws.data.workspaceId}`);
      // Subscribe to space channels based on membership
      for (const spaceId of userSpaceIds) {
        ws.subscribe(`space-${spaceId}`);
      }
    },
    message(ws, message) {
      const data = JSON.parse(message);
      // Broadcast to appropriate channel using Bun's pub/sub
      if (data.spaceId) {
        ws.publish(`space-${data.spaceId}`, message);
      } else {
        ws.publish(`workspace-${ws.data.workspaceId}`, message);
      }
    },
    close(ws) {
      // Bun automatically unsubscribes on close
    },
  },
});
```

**Key Bun WebSocket pub/sub features used:**
- `ws.subscribe(topic)` — subscribe to a named channel
- `ws.publish(topic, message)` — publish to all subscribers (except self)
- `ws.unsubscribe(topic)` — leave a channel
- Automatic cleanup on disconnect
- Per-process, in-memory — no Redis needed

#### 4.2 Collaboration WebSocket (Hocuspocus)

Hocuspocus is the Y.js collaboration server. It currently uses:
1. Raw `ws` WebSocket for client connections
2. Redis Sync Extension for multi-instance document sync

**Migration approach:**

Since the target is a single-process Bun server, the Redis Sync Extension is no longer
needed. Hocuspocus should work under Bun with the following changes:

1. **Remove `RedisSyncExtension`** — single process means no cross-process sync needed
2. **Replace `ws` transport** with Bun native WebSocket:

```typescript
Bun.serve({
  fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname === '/collab') {
      // Upgrade to WebSocket for collaboration
      server.upgrade(req, { data: { type: 'collab' } });
      return;
    }
    // ...
  },
  websocket: {
    open(ws) {
      if (ws.data.type === 'collab') {
        // Hand off to Hocuspocus
        hocuspocus.handleConnection(ws, ws.data.request);
      }
    },
    message(ws, message) {
      if (ws.data.type === 'collab') {
        // Forward to Hocuspocus
      }
    },
  },
});
```

3. **Hocuspocus compatibility layer:** Hocuspocus expects a Node.js `ws` WebSocket
   object. Create a thin adapter that wraps Bun's `ServerWebSocket` to match the `ws`
   API that Hocuspocus expects:

```typescript
class BunWsAdapter {
  constructor(private bunWs: ServerWebSocket) {}
  send(data: string | Buffer) { this.bunWs.send(data); }
  close(code?: number, reason?: string) { this.bunWs.close(code, reason); }
  on(event: string, handler: Function) { /* map to Bun events */ }
  // ... other ws API methods
}
```

4. **Remove the separate collab process** (`collab-main.ts`) — collaboration runs in
   the same Bun.serve() process, eliminating the need for inter-process communication.

#### 4.3 Client-Side Changes

The frontend currently uses:
- `socket.io-client` for UI events → replace with native `WebSocket`
- `@hocuspocus/provider` for collaboration → keep (it uses standard WebSocket)

```typescript
// Before (Socket.io client):
import { io } from 'socket.io-client';
const socket = io({ transports: ['websocket'] });
socket.on('message', handler);

// After (native WebSocket):
const ws = new WebSocket(`${WS_URL}/ws`);
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  handler(data);
};
```

#### 4.4 Remove Socket.io and Redis Adapter Dependencies

Remove from `package.json`:
- `socket.io`
- `socket.io-client`
- `@nestjs/platform-socket.io`
- `@nestjs/websockets`
- `@socket.io/redis-adapter`

#### Deliverable
All real-time functionality (UI events, collaboration) uses Bun's native WebSocket.
Redis is no longer needed for pub/sub. The collaboration server runs in the same process.

#### Risk Assessment
- **Medium-High risk** - Real-time collaboration is complex and latency-sensitive
- Hocuspocus compatibility with Bun's WebSocket needs thorough testing
- The Bun `ws` → Hocuspocus adapter is custom code that needs careful implementation
- Loss of multi-instance scaling (acceptable for self-hosted single-server target)
- Client-side WebSocket migration needs reconnection/retry logic

---

### Phase 5: Queue & Background Jobs (BullMQ/Redis → In-Process)

**Goal:** Replace BullMQ (Redis-based) job queues with an in-process task system.

#### 5.1 Current Queue Usage

| Queue | Jobs | Criticality |
|---|---|---|
| `EMAIL_QUEUE` | Send emails | Medium — can retry |
| `ATTACHMENT_QUEUE` | Process attachments | Low — deferred |
| `GENERAL_QUEUE` | Page backlinks | Low — can be inline |
| `SEARCH_QUEUE` | Index pages | Low — can be inline |
| `AI_QUEUE` | Embeddings, completions | Low — async |
| `HISTORY_QUEUE` | Save page history | Medium — debounced |
| `NOTIFICATION_QUEUE` | Send notifications | Medium — can retry |
| `BILLING_QUEUE` | Process billing events | High — needs reliability |
| `FILE_TASK_QUEUE` | Import/export tasks | Low — deferred |

#### 5.2 In-Process Task Queue Implementation

Create a simple in-process task queue with retry and persistence:

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

For the **history queue** specifically, use debouncing:

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

#### 5.3 Optional: SQLite-Backed Persistent Queue

For critical jobs (billing, email) that must survive server restarts:

```typescript
// Store pending jobs in SQLite
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

#### 5.4 Remove BullMQ Dependencies

Remove from `package.json`:
- `bullmq`
- `@nestjs/bullmq`

#### Deliverable
All background jobs run in-process. Redis is no longer required for queues.
Critical jobs are persisted to SQLite for crash recovery.

#### Risk Assessment
- **Low-Medium risk** - Queues are mostly fire-and-forget
- In-process queues lose Redis-based rate limiting (not critical for self-hosted)
- Server restart loses in-flight non-persisted jobs (acceptable with SQLite fallback)
- The billing queue may need extra reliability guarantees

---

### Phase 6: Search Migration (PostgreSQL FTS → SQLite FTS5)

**Goal:** Replace PostgreSQL full-text search (`tsvector`, `ts_rank`, `f_unaccent`)
with SQLite FTS5.

#### 6.1 Create FTS5 Virtual Tables

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

FTS5's `unicode61 remove_diacritics 2` tokenizer replaces PostgreSQL's `f_unaccent`
function.

#### 6.2 FTS Triggers for Automatic Sync

```sql
-- Keep FTS in sync with pages table
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

#### 6.3 Rewrite Search Service

```typescript
// Before (PostgreSQL tsvector):
const results = await db
  .selectFrom('pages')
  .where('tsv', '@@', sql`to_tsquery('english', ${query})`)
  .select(sql`ts_rank(tsv, ...) as rank`)
  .select(sql`ts_headline(...) as highlight`);

// After (SQLite FTS5):
const results = await db.all(sql`
  SELECT
    p.id, p.slug_id, p.title, p.icon, p.parent_page_id,
    p.creator_id, p.created_at, p.updated_at,
    bm25(pages_fts) as rank,
    snippet(pages_fts, 1, '<b>', '</b>', '...', 10) as highlight
  FROM pages_fts
  JOIN pages p ON p.rowid = pages_fts.rowid
  WHERE pages_fts MATCH ${fts5Query}
  AND p.deleted_at IS NULL
  AND p.workspace_id = ${workspaceId}
  AND p.space_id IN (${userSpaceIds.join(',')})
  ORDER BY rank
  LIMIT ${limit}
  OFFSET ${offset}
`);
```

#### 6.4 FTS5 Query Syntax Adaptation

PostgreSQL `tsquery` uses `&` (AND), `|` (OR), `!` (NOT).
FTS5 uses different syntax — need to convert the query parser:

```typescript
// Convert user search input to FTS5 query
function toFts5Query(input: string): string {
  // FTS5 prefix search: "hello*" matches "hello", "helloworld"
  const terms = input.trim().split(/\s+/);
  return terms.map(t => `"${t}"*`).join(' ');
}
```

#### 6.5 Remove Typesense Integration

The optional Typesense search driver can be removed since FTS5 provides
sufficient search capability for a self-hosted single-server deployment.

Remove from `package.json`:
- `typesense`
- `pg-tsquery`

#### Deliverable
Full-text search uses SQLite FTS5. Search results include ranking and highlighted
snippets. Diacritics are handled natively by FTS5's unicode61 tokenizer.

#### Risk Assessment
- **Low risk** - FTS5 is well-proven and fast
- FTS5 ranking (BM25) may differ from PostgreSQL `ts_rank` — results order may change
- FTS5 `snippet()` function differs from PostgreSQL `ts_headline` — output format changes
- Suggest/autocomplete search (title LIKE) translates directly to SQLite LIKE

---

### Phase 7: Remove Redis Entirely

**Goal:** Complete elimination of Redis as a dependency. By this point, all Redis
usages should have been replaced in earlier phases.

#### 7.1 Audit Remaining Redis Usages

After Phases 1-6, verify that all Redis consumers are migrated:

| Redis Usage | Replaced By | Phase |
|---|---|---|
| PostgreSQL database | SQLite | Phase 1 |
| Socket.io Redis adapter | Bun native WebSocket pub/sub | Phase 4 |
| BullMQ job queues | In-process task queue | Phase 5 |
| Hocuspocus Redis Sync | Removed (single-process) | Phase 4 |
| Redis cache (ioredis) | In-memory Map or SQLite | Phase 7 |
| Session storage | Better Auth sessions (SQLite) | Phase 2 |

#### 7.2 Replace Remaining Cache Uses

Audit any direct `ioredis` usage for caching:

```typescript
// Simple in-memory cache with TTL
class MemoryCache {
  private cache = new Map<string, { value: any; expiresAt: number }>();

  get(key: string): any | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: any, ttlMs: number) {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string) {
    this.cache.delete(key);
  }
}
```

#### 7.3 Remove Redis Dependencies

Remove from `package.json`:
- `ioredis`
- `@nestjs-labs/nestjs-ioredis`
- `@socket.io/redis-adapter`
- `cache-manager`

Remove from environment:
- `REDIS_URL` env variable
- Redis service from `docker-compose.yml`

#### 7.4 Update Docker Compose

```yaml
# After migration:
services:
  docmost:
    image: docmost/docmost:latest
    environment:
      APP_URL: 'http://localhost:3000'
      APP_SECRET: 'REPLACE_WITH_LONG_SECRET'
    ports:
      - "3000:3000"
    restart: unless-stopped
    volumes:
      - docmost_data:/app/data

volumes:
  docmost_data:   # Contains SQLite DB + local file storage
```

No more `db` or `redis` services.

#### Deliverable
Redis is completely removed. The docker-compose has a single service.
The application starts with zero external dependencies.

#### Risk Assessment
- **Low risk** - This is a cleanup phase; all functional changes happened earlier
- Verify no hidden Redis imports remain via codebase grep

---

### Phase 8: Cleanup, Optimization & Testing

**Goal:** Remove all legacy code, optimize the SQLite configuration, and ensure
comprehensive test coverage.

#### 8.1 Remove Legacy Dependencies

Uninstall all NestJS, Fastify, Kysely, PostgreSQL, Redis, and Socket.io packages:

```bash
bun remove @nestjs/common @nestjs/core @nestjs/config @nestjs/jwt \
  @nestjs/passport @nestjs/platform-fastify @nestjs/platform-socket.io \
  @nestjs/websockets @nestjs/bullmq @nestjs/schedule @nestjs/terminus \
  @nestjs/event-emitter @nestjs/mapped-types \
  @fastify/cookie @fastify/multipart @fastify/static \
  kysely kysely-postgres-js nestjs-kysely kysely-codegen kysely-migration-cli \
  postgres pg-tsquery pgvector \
  ioredis @nestjs-labs/nestjs-ioredis @socket.io/redis-adapter \
  socket.io @nestjs/platform-socket.io \
  bullmq @nestjs/bullmq \
  passport-jwt @nestjs/passport passport-google-oauth20 @node-saml/passport-saml \
  cache-manager class-validator class-transformer reflect-metadata rxjs \
  nestjs-pino pino-http pino-pretty \
  typesense
```

#### 8.2 SQLite Optimization

```typescript
// Periodic optimization (run on schedule)
function optimizeDatabase() {
  sqlite.run('PRAGMA optimize');
  sqlite.run('PRAGMA wal_checkpoint(TRUNCATE)');
}

// Run every 4 hours
setInterval(optimizeDatabase, 4 * 60 * 60 * 1000);

// Backup strategy
function backupDatabase() {
  // SQLite online backup API
  const backupPath = `./data/backups/docmost-${Date.now()}.db`;
  sqlite.run(`VACUUM INTO '${backupPath}'`);
}
```

#### 8.3 Update Environment Configuration

Simplified `.env`:
```env
APP_URL=http://localhost:3000
PORT=3000
APP_SECRET=<random-32-chars>

# Database (SQLite - file path)
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

No more `DATABASE_URL`, `REDIS_URL`.

#### 8.4 Testing Strategy

1. **Unit tests** — Migrate from Jest to Bun's built-in test runner (`bun test`)
2. **Integration tests** — Test each route handler with real SQLite (in-memory mode)
3. **E2E tests** — Full server tests with WebSocket collaboration
4. **Data migration tests** — Verify PostgreSQL → SQLite data integrity
5. **Performance benchmarks** — Compare response times vs. old stack

#### 8.5 Build & Deploy

```typescript
// Single binary build (optional)
// bun build ./src/index.ts --compile --outfile=docmost

// Or standard:
// bun run ./src/index.ts
```

Update Dockerfile:
```dockerfile
FROM oven/bun:1.3
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production
COPY . .
RUN bun run build:client
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
```

#### Deliverable
Clean codebase with no legacy dependencies. Optimized SQLite configuration.
Test suite running under `bun test`. Docker image is ~3x smaller.

---

## Migration Order & Dependencies

```
Phase 0: Bun Runtime Switchover
    │
    ▼
Phase 1: Database (PostgreSQL → SQLite/Drizzle)  ← CRITICAL PATH
    │
    ├──► Phase 2: Auth (Passport/JWT → Better Auth)
    │
    ├──► Phase 6: Search (PostgreSQL FTS → SQLite FTS5)
    │
    ▼
Phase 3: Framework (NestJS → Bun.serve/Hono)
    │
    ├──► Phase 4: Real-Time (Socket.io/Redis → Bun WebSocket)
    │
    ├──► Phase 5: Queue (BullMQ → In-Process)
    │
    ▼
Phase 7: Remove Redis Entirely
    │
    ▼
Phase 8: Cleanup & Optimization
```

**Parallelizable:** Phases 2 and 6 can run in parallel after Phase 1.
Phases 4 and 5 can run in parallel after Phase 3.

---

## What Is NOT Being Migrated

These components remain unchanged or require minimal adaptation:

| Component | Rationale |
|---|---|
| **Frontend (React/Vite/Mantine)** | Completely independent of server runtime |
| **TipTap editor & extensions** | Client-side only |
| **Y.js / Hocuspocus protocol** | Kept for collaboration; only transport changes |
| **AI SDK (OpenAI/Google/Ollama)** | External API calls; runtime-agnostic |
| **S3 storage option** | AWS SDK works under Bun |
| **Email templates (React Email)** | Rendering is runtime-agnostic |
| **CASL authorization** | Framework-agnostic permission library |
| **Stripe billing** | External API; minor wiring changes only |
| **`editor-ext` package** | Shared TipTap extensions; no server dependency |

---

## Known Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Hocuspocus WebSocket adapter compatibility | High | Build adapter layer; extensive testing; keep `ws` as fallback |
| SQLite single-writer bottleneck under heavy write load | Medium | WAL mode allows concurrent reads; writes are fast; adequate for self-hosted |
| Better Auth missing SAML/LDAP plugins | Medium | Write custom plugins wrapping existing `ldapts`/`passport-saml` code |
| Loss of horizontal scaling (single process) | Medium | Acceptable for self-hosted target; document scaling limits |
| Data migration errors (PG → SQLite) | High | Comprehensive migration script with validation; reversible migration |
| npm package compatibility under Bun | Low | Bun has >99% npm compatibility as of 2026; test all deps |
| SQLite database size limits | Low | SQLite supports up to 281TB; typical Docmost instances are <10GB |

---

## Success Criteria

1. **Zero external services** — Application starts with only a SQLite file on disk
2. **Feature parity** — All existing features work identically
3. **Performance** — Response times equal or better than current stack
4. **Single Docker service** — `docker-compose.yml` has one service, no sidecar DBs
5. **Simplified deployment** — Can run with `bun run src/index.ts` directly
6. **Data migration path** — Existing PostgreSQL data can be migrated cleanly
7. **Startup time** — Server boots in under 1 second
