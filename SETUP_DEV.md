# SETUP_DEV.md — Ambiente di sviluppo locale DocOps

## Prerequisiti

| Tool | Versione minima | Note |
|---|---|---|
| Node.js | 20.x LTS | Richiesto da Docmost |
| pnpm | 10.4.0 | `npm i -g pnpm@10.4.0` |
| Docker Desktop | 4.x (Windows) | Con engine Linux |
| Git | 2.x | `core.longpaths true` obbligatorio su Windows |
| gh CLI | 2.x | Opzionale, per PR e autenticazione GitHub |

## 1. Clonare il repository

```bash
git clone https://github.com/tigre9/docops.git
cd docops
git config core.longpaths true   # OBBLIGATORIO su Windows
```

## 2. Installare le dipendenze

```bash
pnpm install
```

> Prima esecuzione: 5-7 minuti (scarica ~800 MB di pacchetti).

## 3. Configurare l'ambiente

Copia il file di esempio e modificalo:

```bash
cp .env.example .env
```

Valori minimi richiesti per lo sviluppo locale:

```env
APP_URL=http://localhost:3000
PORT=3000
APP_SECRET=<stringa-random-almeno-32-caratteri>

DATABASE_URL="postgresql://docmost:docmost_dev_pass@localhost:5432/docmost?schema=public"
REDIS_URL=redis://127.0.0.1:6379

# Storage locale (più semplice per dev)
STORAGE_DRIVER=local

# Per MinIO (opzionale, vedi §6)
# STORAGE_DRIVER=s3
# AWS_S3_ACCESS_KEY_ID=docmost_dev
# AWS_S3_SECRET_ACCESS_KEY=docmost_dev_secret
# AWS_S3_BUCKET=docops-attachments
# AWS_S3_ENDPOINT=http://localhost:9000
# AWS_S3_FORCE_PATH_STYLE=true
# AWS_S3_REGION=us-east-1

MAIL_DRIVER=smtp
SMTP_HOST=127.0.0.1
SMTP_PORT=1025          # Mailpit o simile per dev
DISABLE_TELEMETRY=true
```

> Genera `APP_SECRET` con: `openssl rand -hex 32` (Linux/Mac) oppure
> `[System.Web.Security.Membership]::GeneratePassword(64,0)` in PowerShell.

## 4. Avviare i servizi infrastrutturali

```bash
docker compose -f docker-compose.dev.yml up -d
```

Attendi che tutti i container siano `healthy`:

```bash
docker compose -f docker-compose.dev.yml ps
```

Output atteso:

```
NAME          STATUS
docops-db-1       running (healthy)
docops-redis-1    running
docops-minio-1    running
```

## 5. Eseguire le migrazioni

### 5a. Migrazioni native Docmost

```bash
pnpm --filter ./apps/server run migration:latest
```

Output atteso: 46 righe `Result: Success`.

### 5b. Migrazioni DocOps custom

```bash
pnpm --filter ./apps/server run migration-docops:latest
```

Output atteso: 10 righe `Result: Success`.

> Le migrazioni DocOps usano le tabelle di tracking separate
> `kysely_migration_docops` e `kysely_migration_lock_docops`,
> isolate dalle migrazioni upstream.

## 6. Configurare MinIO (opzionale)

Se si usa `STORAGE_DRIVER=s3`, creare il bucket dopo aver avviato MinIO:

1. Aprire la MinIO Console: http://localhost:9001
2. Login: `docmost_dev` / `docmost_dev_secret`
3. Creare bucket: `docops-attachments` (access: private)
4. Aggiornare `.env` con le variabili S3 (vedi §3)

## 7. Avviare l'applicazione in sviluppo

Aprire **due terminali** separati:

**Terminale 1 — Backend:**

```bash
pnpm --filter ./apps/server run start:dev
```

Attendi: `[NestFactory] Starting Nest application...` e poi `Listening on :3000`.

**Terminale 2 — Frontend:**

```bash
pnpm --filter ./apps/client run dev
```

Attendi: `VITE ready in ... ms` e `Local: http://localhost:5173/`.

## 8. Onboarding iniziale

1. Aprire http://localhost:5173
2. Completare il form di registrazione (primo utente → diventa workspace admin)
3. Creare uno Space di prova (es. "test-space")
4. Creare una pagina con contenuto nell'editor BlockNote
5. Verificare FTS: menu ricerca globale → cercare una parola del contenuto

## 9. Checklist di verifica baseline

- [ ] Login/logout funziona
- [ ] Editor BlockNote: formattazione, code block, tabelle
- [ ] Real-time collaboration: aprire la stessa pagina in due tab, editare entrambi simultaneamente
- [ ] Allegati: upload file da editor (funziona con `STORAGE_DRIVER=local`)
- [ ] Ricerca FTS: il contenuto delle pagine è trovato dopo salvataggio
- [ ] API health: `curl http://localhost:3000/health` → `{"status":"ok"}`

## 10. Script utili

```bash
# Reset completo DB (distrugge tutti i dati!)
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d
pnpm --filter ./apps/server run migration:latest
pnpm --filter ./apps/server run migration-docops:latest

# Build TypeScript (verifica errori)
pnpm --filter ./apps/server run build

# Lint
pnpm --filter ./apps/server run lint

# Log DB queries (utile per debug)
DEBUG_DB=true pnpm --filter ./apps/server run start:dev
```

## 11. Struttura directory fork

```
docops/
├── apps/
│   ├── client/src/docops/          # Feature frontend DocOps (non toccare features/ upstream)
│   └── server/src/docops/          # Moduli NestJS DocOps
│       ├── services/               # Catalogo servizi
│       ├── change-requests/        # Workflow CR 8 stati
│       ├── audit/                  # Audit log esteso
│       ├── dashboard/              # KPI e reportistica
│       └── webhooks/               # Webhook outbound CI/CD
└── apps/server/src/database/
    └── migrations-docops/          # Migrazioni custom (mai in migrations/)
```

## 12. Note Windows

- **Percorsi lunghi**: `git config --global core.longpaths true` prima di qualsiasi `git add` in directory profonde
- **Docker**: usare Docker Desktop Windows (non WSL2 engine)
- **Shell**: usare PowerShell (non cmd) per `pnpm` e `git`
- **File `.env`**: creare tramite IDE (WebStorm/VS Code) — PowerShell ha problemi con dot-files

## 13. Troubleshooting

| Problema | Causa | Soluzione |
|---|---|---|
| `DATABASE_URL must be a valid postgres connection string` | `.env` non trovato | Verificare che `.env` esista nella root del progetto |
| `git add` fallisce con "unable to create temporary file" | Percorso > 260 char su Windows | `git config --global core.longpaths true` |
| `Cannot GET /` nel browser su porta 3000 | Normale: la porta 3000 è il backend API, non il frontend | Usare http://localhost:5173 per il frontend |
| Errori 500 al primo avvio | Migrazioni non eseguite | Eseguire §5a e §5b |
| `corepack enable` non trovato in WSL2 | Node.js Windows nel PATH di WSL2 | Usare PowerShell, non WSL2 |
