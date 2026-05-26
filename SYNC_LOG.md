# SYNC_LOG.md — Log sincronizzazioni con upstream

Registro delle sincronizzazioni tra `tigre9/docops` e `docmost/docmost` upstream.

---

## 2026-05-25 — Fork iniziale (Fase 0)

**Tipo**: Fork iniziale  
**Upstream ref**: commit HEAD di `docmost/docmost` al 2026-05-25  
**Autore**: Daniele Pierdomenico  

### Cosa è stato fatto

- Fork di `docmost/docmost` → `tigre9/docops` via GitHub CLI
- Clone locale in `C:\Users\dpierdomenico\WebstormProjects\docops`
- Remote `upstream` aggiunto a `https://github.com/docmost/docmost.git`
- Ambiente di sviluppo locale configurato: Node 22, pnpm, Docker Desktop
- Stack Docker dev: postgres:16 + redis:7 (porte esposte, nessun container app)
- 46 migrazioni upstream applicate su DB locale
- Verifica build: `pnpm dev` → app gira su `localhost:5173` ✓
- Create directory custom fork:
  - `apps/server/src/docops/` (6 moduli backend)
  - `apps/client/src/docops/` (4 feature frontend)
  - `apps/server/src/database/migrations-docops/`
- Creati file `FORK.md`, `SYNC_LOG.md`, `docker-compose.dev.yml`
- Nessuna modifica al core Docmost upstream

### Conflitti risolti

Nessuno (primo fork, nessuna divergenza).

### File upstream modificati

Nessuno.

---

## 2026-05-26 — Milestone 2: Schema dati DocOps

**Tipo**: Sviluppo custom (nessuna sync upstream)  
**Autore**: Daniele Pierdomenico  

### Cosa è stato fatto

- Verificate e applicate 10 migrazioni DocOps custom in `migrations-docops/`
- Aggiunta migrazione `docops_20260526T100011-add-justification-check` (CHECK constraint su `change_requests.justification >= 30 char` — mancava nelle migrazioni Fase 0)
- Test up/down/up per tutte le 11 migrazioni DocOps ✓
- Rigenerati tipi TypeScript Kysely (`db.d.ts`) — 48 tabelle introspettate
- Aggiornato `FORK.md` con documentazione ALTER TABLE su `users`, `pages`, `page_history`

### Entità create

| Tabella | Tipo | Migrazione |
|---|---|---|
| `offices` | Nuova | 20260525T100001 |
| `services` | Nuova | 20260525T100002 |
| `tags` | Nuova | 20260525T100002 |
| `service_tags` | Nuova | 20260525T100002 |
| `change_requests` | Nuova | 20260525T100003 |
| `change_request_events` | Nuova | 20260525T100004 |
| `external_refs` | Nuova | 20260525T100005 |
| `docops_audit_logs` | Nuova | 20260525T100006 |
| `webhooks_config` | Nuova | 20260525T100007 |
| `users.office_id/docops_roles/external_id/auth_provider` | ALTER | 20260525T100008 |
| `pages.cr_draft_id/current_published_version_id` | ALTER | 20260525T100009 |
| `page_history.change_request_id/is_published_version/published_at/published_by_id` | ALTER | 20260525T100010 |
| `change_requests` CHECK constraint su `justification` | Constraint | 20260526T100011 |

### File upstream modificati

Nessuno (tutte le modifiche in `migrations-docops/`; ALTER TABLE su tabelle native documentate in `FORK.md`).

---

<!-- Template per sincronizzazioni future:

## YYYY-MM-DD — Sync upstream vX.Y.Z

**Tipo**: Sync upstream / Patch sicurezza / Feature merge
**Upstream ref**: commit SHA o tag
**PR di sync**: #NNN
**Autore**: 
**Reviewer**: 

### Cosa è stato fatto

### Conflitti risolti

### File upstream modificati (se applicabile)

| File | Modifica | Motivazione |
|---|---|---|

### Note

-->
