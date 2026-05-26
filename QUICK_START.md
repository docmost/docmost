# Quick Start — Avvia l'app in 5 minuti

## 0. Prerequisiti (prima volta)

```bash
# Installa dipendenze globali (una sola volta)
npm install -g pnpm@10.4.0

# Clona il repository
git clone https://github.com/tigre9/docops.git
cd docops

# Installa package Node
pnpm install
```

## 1. Avvia infrastruttura (Docker)

Una sola volta per sessione:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Verifica che tutti i container siano up:

```bash
docker compose -f docker-compose.dev.yml ps
```

Aspetti output:
```
NAME             STATUS
docops-db-1      Up (healthy)
docops-redis-1   Up
docops-minio-1   Up
```

## 2. Esegui migrazioni (una sola volta per fresco DB)

```bash
# Migrazioni Docmost upstream
pnpm --filter ./apps/server run migration:latest

# Migrazioni DocOps custom
pnpm --filter ./apps/server run migration-docops:latest
```

Se dice `No pending migrations to execute`, le migrazioni sono già state applicate. OK.

## 3. Avvia il backend (Terminal 1)

```bash
pnpm --filter ./apps/server run start:dev
```

Aspetta log:
```
[NestFactory] Starting Nest application...
Listening on http://127.0.0.1:3000
```

Lascia questo terminal aperto.

## 4. Avvia il frontend (Terminal 2)

Apri un nuovo terminal e:

```bash
pnpm --filter ./apps/client run dev
```

Aspetta log:
```
VITE v... ready in ... ms

Local: http://localhost:5173/
```

## 5. Accedi all'app

Apri browser: **http://localhost:5173**

Se è la prima volta, completa l'onboarding Docmost:
- Crea workspace
- Crea admin user
- Login

## 6. Test basici

- [ ] **Login/Logout** funziona
- [ ] **Crea uno Space** di prova
- [ ] **Crea una Pagina** e scrivi contenuto
- [ ] **Ricerca (Ctrl+K)** trova il contenuto
- [ ] **Real-time**: apri stessa pagina in 2 tab, modifica in uno e vedi l'altro aggiornarsi

Done! ✅

## Comandi utili

| Comando | Cosa fa |
|---|---|
| `docker compose -f docker-compose.dev.yml logs -f db` | Leggi log del database |
| `docker compose -f docker-compose.dev.yml down -v` | **Resetta DB** (cancella tutto) |
| `pnpm --filter ./apps/server run lint` | Lint TypeScript backend |
| `pnpm --filter ./apps/server run build` | Build TypeScript backend |
| `pnpm --filter ./apps/client run build` | Build frontend (produzione) |

## Troubleshooting

| Problema | Soluzione |
|---|---|
| `Cannot GET /api/...` | Aspetta che il backend finisca di compilare (watch mode) |
| `502 Bad Gateway` su localhost:5173 | Il backend (3000) non è up. Verifica Terminal 1. |
| `Cannot connect to database` | Verifica che `docops-db-1` sia running: `docker compose ps` |
| `pnpm: command not found` | Installa pnpm: `npm install -g pnpm@10.4.0` |
| `Port 5173 already in use` | Cambia porta: `pnpm --filter ./apps/client run dev -- --port 5174` |
| `Migrations fail` | Verifica che il DB sia up e `.env` sia configurato correttamente |

## Stop / Reset

**Ferma solo l'app (keep DB):**
```bash
# Ctrl+C nei due terminal (backend e frontend)
```

**Spegni tutto (keep DB):**
```bash
docker compose -f docker-compose.dev.yml down
```

**Reset totale DB (cancella TUTTI i dati):**
```bash
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d
pnpm --filter ./apps/server run migration:latest
pnpm --filter ./apps/server run migration-docops:latest
```

## Prossimi passi

Leggi:
- `FORK.md` — regole del fork e come modificare codice
- `STRUTTURA.md` — architettura progetto
- `SETUP_DEV.md` — setup avanzato (MinIO, email, etc.)
