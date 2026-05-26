# Struttura progetto DocOps

## Vista a 100m

**DocOps** = Docmost (wiki collaborativa) + 3 estensioni specifiche:

```
docops/
├── apps/
│   ├── client/              # Frontend React + Vite (porta 5173)
│   │   ├── src/
│   │   │   ├── features/    # Feature upstream Docmost (non toccare)
│   │   │   └── docops/      # Nuove feature DocOps (carte, CR, dashboard)
│   │   └── vite.config.ts   # Config build + proxy /api → backend
│   │
│   └── server/              # Backend NestJS (porta 3000)
│       ├── src/
│       │   ├── core/        # Core Docmost upstream (non toccare)
│       │   ├── ee/          # Enterprise Docmost (non toccare)
│       │   └── docops/      # Nuovi moduli DocOps
│       │       ├── services/       # NestJS module: catalogo servizi
│       │       ├── change-requests/ # NestJS module: workflow CR 8 stati
│       │       ├── audit/          # NestJS module: audit log esteso
│       │       ├── dashboard/      # NestJS module: KPI e report
│       │       ├── webhooks/       # NestJS module: webhook outbound CI/CD
│       │       └── sso/            # NestJS module: SSO (Fase 2)
│       │
│       └── src/database/
│           ├── migrations/          # 46 migrazioni Docmost upstream
│           └── migrations-docops/   # 10 migrazioni DocOps custom
│
├── packages/
│   └── editor-ext/          # Estensioni BlockNote (editor)
│
├── .github/
│   └── workflows/           # 4 GitHub Actions
│       ├── ci.yml           # Build + Test su push/PR
│       ├── security.yml     # Audit dipendenze (settimanale)
│       ├── sync-upstream.yml # Merge automatico Docmost (domenicale)
│       └── release.yml      # Build + Push Docker (on tag)
│
├── docker-compose.dev.yml   # Stack locale: postgres + redis + minio
├── FORK.md                  # Regole fork e file modificati
├── SYNC_LOG.md              # Log sincronizzazioni upstream
└── SETUP_DEV.md             # Istruzioni dev setup
```

## Database schema

**50 tabelle:**
- **46 Docmost upstream**: `users`, `pages`, `spaces`, `comments`, `attachments`, etc.
- **10 DocOps custom** (separate via `migrations-docops/`):
  - `offices` — uffici organizzativi
  - `services` — catalogo servizi
  - `service_tags` — tassonomia servizi
  - `change_requests` — CR 8 stati
  - `change_request_events` — storia CR
  - `external_refs` — collegamenti ticket/PR
  - `docops_audit_logs` — audit log esteso
  - `webhooks_config` — webhook config outbound
  - 2 tabelle di tracking migration (`kysely_migration_docops`, `kysely_migration_lock_docops`)

## Dipendenze esterne

| Servizio | Versione | Scopo | Porta |
|---|---|---|---|
| PostgreSQL | 16 | Database principale | 5432 |
| Redis | 7 | Cache + sessioni | 6379 |
| MinIO | latest | Storage file (S3-like) | 9000, 9001 |

## Node packages principali

**Backend (NestJS):**
- `@nestjs/core` — framework
- `@nestjs/typeorm` — ORM (in realtà uso Kysely, non TypeORM)
- `@nestjs/websockets` — WebSocket per real-time collab
- `socket.io` — real-time collaboration
- `kysely` — query builder type-safe
- `yjs` — CRDT per cooperative editing

**Frontend (React):**
- `react` + `react-dom` — UI framework
- `vite` — build tool + dev server
- `@blocknote/core` — editor BlockNote
- `tanstack/react-query` — data fetching
- `zustand` — state management

## File critici da non modificare (in Fase 1-2)

```
⛔ apps/server/src/core/*           # Core Docmost
⛔ apps/server/src/ee/*             # Enterprise Docmost (licenza commerciale)
⛔ apps/server/src/modules/*        # Moduli Docmost upstream
⛔ apps/client/src/features/*       # Feature Docmost upstream
⛔ apps/client/src/ee/*             # Enterprise Docmost
```

✅ Puoi toccare:
- `apps/server/src/docops/**`
- `apps/client/src/docops/**`
- `apps/server/src/database/migrations-docops/**`
- `.env` (configurazione locale)

## Come sincronizzare con upstream Docmost

Vedi `SYNC_LOG.md` e `FORK.md` per strategia e checklist.

**TL;DR:** GitHub Actions crea PR automatica domenica alle 6am UTC. Reviewa manualmente con checklist obbligatoria (mai merge automatico).
