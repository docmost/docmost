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
