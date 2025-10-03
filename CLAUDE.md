# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Docmost is an open-source collaborative wiki and documentation platform built as a monorepo using NX, pnpm workspaces, and TypeScript. The architecture consists of:

- **Backend**: NestJS application with Fastify adapter, PostgreSQL database (via Kysely), Redis for caching/pub-sub, and real-time collaboration via Hocuspocus
- **Frontend**: React + Vite SPA using Mantine UI components, TanStack Query for data fetching, and Jotai for state management
- **Editor**: Custom TipTap-based collaborative editor with real-time sync, shared as `@docmost/editor-ext` package
- **Collaboration**: Separate Hocuspocus server for real-time collaborative editing using Y.js CRDTs

## Common Development Commands

### Build & Development
```bash
# Full build (all apps and packages)
pnpm build

# Development mode (runs both frontend and backend with hot reload)
pnpm dev

# Individual app development
pnpm client:dev          # Frontend only (Vite dev server)
pnpm server:dev          # Backend only (NestJS with watch mode)
pnpm collab:dev          # Collaboration server only

# Production start
pnpm start               # Start backend in production mode
pnpm collab              # Start collaboration server in production mode
```

### Testing
```bash
# Backend tests
cd apps/server
pnpm test                # Run all tests
pnpm test:watch          # Watch mode
pnpm test:cov            # With coverage
pnpm test:e2e            # E2E tests

# Run specific test file
pnpm test -- auth.service.spec.ts
```

### Linting & Formatting
```bash
# Frontend
cd apps/client
pnpm lint                # ESLint
pnpm format              # Prettier

# Backend
cd apps/server
pnpm lint                # ESLint with auto-fix
pnpm format              # Prettier
```

### Database Migrations

Database migrations use Kysely and custom migration CLI:

```bash
cd apps/server

# Create new migration
pnpm migration:create <migration-name>

# Run migrations
pnpm migration:up        # Run next pending migration
pnpm migration:latest    # Run all pending migrations
pnpm migration:down      # Rollback last migration
pnpm migration:redo      # Rollback and re-run last migration
pnpm migration:reset     # Rollback all migrations

# Generate TypeScript types from database schema
pnpm migration:codegen
```

**Important**: Migrations are located in `apps/server/src/database/migrations/`. The codegen command generates types at `apps/server/src/database/types/db.d.ts` based on the current database schema.

### Email Development
```bash
cd apps/server
pnpm email:dev           # Start email preview server on port 5019
```

## Architecture

### Backend Structure

**Core Modules** (`apps/server/src/core/`):
- `auth/` - Authentication (JWT, sessions, OAuth, SAML, LDAP)
- `user/` - User management and profiles
- `workspace/` - Workspace settings and configuration
- `space/` - Space (wiki) management and permissions
- `page/` - Page CRUD, versioning, and tree structure
- `comment/` - Comments and discussions
- `group/` - User groups and permissions
- `search/` - Full-text search using PostgreSQL tsvector
- `attachment/` - File uploads and storage (local/S3)
- `share/` - Public sharing links
- `casl/` - Authorization using CASL ability framework

**Supporting Infrastructure**:
- `database/` - Kysely ORM, migrations, repositories pattern
- `collaboration/` - Hocuspocus WebSocket server for real-time editing
- `integrations/` - Email (SMTP/Postmark), storage (S3), OAuth providers
- `ws/` - WebSocket gateway with Redis adapter for notifications
- `common/` - Shared utilities, guards, decorators, interceptors
- `ee/` - Enterprise Edition features (separate license)

**Key Technologies**:
- **Database**: PostgreSQL accessed via Kysely (type-safe SQL builder)
- **Caching**: Redis with cache-manager
- **Auth**: Passport strategies (JWT, Google OAuth, SAML, LDAP)
- **Real-time**: Socket.IO with Redis adapter + Hocuspocus for collaboration
- **Jobs**: BullMQ for background tasks
- **Validation**: class-validator and class-transformer DTOs
- **File Storage**: Local filesystem or S3-compatible storage

### Frontend Structure

**Feature Modules** (`apps/client/src/features/`):
- `editor/` - TipTap collaborative editor with extensions
- `page/` - Page components (sidebar, tree navigation, breadcrumbs)
- `space/` - Space management UI
- `auth/` - Login, signup, OAuth flows
- `user/` - User settings, profile, preferences
- `workspace/` - Workspace settings
- `group/` - Group management
- `comment/` - Comment threads UI
- `search/` - Search interface
- `attachments/` - File upload and management
- `share/` - Public sharing UI
- `page-history/` - Version history and restore
- `websocket/` - WebSocket event handling
- `home/` - Dashboard and home page

**Shared Infrastructure**:
- `components/` - Reusable UI components
- `hooks/` - Custom React hooks
- `lib/` - API client (axios), utilities, constants
- `pages/` - Route components (React Router v7)

**Key Technologies**:
- **UI Framework**: Mantine v8 (components, forms, modals, notifications)
- **State Management**: Jotai for global state, TanStack Query for server state
- **Routing**: React Router v7
- **Editor**: TipTap v2 with Hocuspocus provider for collaboration
- **i18n**: i18next with HTTP backend for translations
- **Diagrams**: Draw.io, Excalidraw, Mermaid integrations
- **Validation**: Zod schemas with Mantine form integration

### Editor Package

`packages/editor-ext/` contains shared TipTap extensions and utilities used by both client and server:
- Custom nodes/marks (callouts, embeds, diagrams)
- Editor utilities and helpers
- Shared between frontend editor and backend HTML processing

### Enterprise Edition

Files in `apps/server/src/ee/` and `apps/client/src/ee/` are under the Docmost Enterprise license. These contain premium features separate from the AGPL-licensed core.

## Development Patterns

### Database Access
- Use Kysely for type-safe SQL queries (not TypeORM or Prisma)
- Database types auto-generated in `apps/server/src/database/types/db.d.ts`
- Repository pattern: domain repositories in `apps/server/src/database/repos/`
- Transactions available via Kysely transaction API

### API Structure
- Controllers in each module define REST endpoints
- DTOs use class-validator decorators for validation
- Global prefix `/api` for all routes except specific exclusions
- Responses wrapped by `TransformHttpResponseInterceptor`

### Authorization
- CASL abilities defined in `apps/server/src/core/casl/`
- Permissions checked via `@CheckAbility()` decorator
- Ability factory creates user-specific permission objects

### Real-time Collaboration
- Hocuspocus runs as separate server process (port configured separately)
- Y.js documents synced between clients via WebSocket
- Redis extension enables multi-instance collaboration
- Frontend uses `@hocuspocus/provider` to connect editor to collaboration server

### Frontend Data Fetching
- TanStack Query for all API calls (queries and mutations)
- Query hooks in feature-specific `queries/` directories
- Jotai atoms for UI state, user preferences, workspace context

### File Storage
- Configurable via `STORAGE_DRIVER` (local or S3)
- Attachment service handles uploads with size limits
- Sharp for image processing
- Support for importing .docx and .pdf files

## Environment Setup

1. Copy `.env.example` to `.env` and configure:
   - `DATABASE_URL` - PostgreSQL connection string
   - `REDIS_URL` - Redis connection string
   - `APP_SECRET` - Generate with `openssl rand -hex 32`
   - `APP_URL` - Application URL
   - Storage driver (local or S3)
   - Email configuration (SMTP or Postmark)

2. Install dependencies: `pnpm install`

3. Run database migrations: `cd apps/server && pnpm migration:latest`

4. Start development: `pnpm dev`

## Testing Guidelines

- Backend tests use Jest with NestJS testing utilities
- Test files located alongside source files with `.spec.ts` extension
- Focus on service and controller unit tests
- E2E tests in `apps/server/test/` directory
- Frontend currently has no test setup (opportunity for contribution)

## Important Notes

- This is a monorepo managed by NX - use `nx` commands for cross-project operations
- Package manager is pnpm - do not use npm or yarn
- TypeScript strict mode enabled across all packages
- Backend uses Fastify (not Express) - be aware of API differences
- Collaboration server must run separately in production for real-time editing
- Database migrations are one-way - always test rollbacks during development
