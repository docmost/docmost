# GitHub Actions — Automazioni DocOps

DocOps ha 4 workflow GitHub Actions che si eseguono automaticamente. Eccoli spiegati.

---

## 1. 🔨 CI (Continuous Integration)

**File**: `.github/workflows/ci.yml`

**Trigger**: Push su `main`, `develop`, `feat/*` o PR verso `main`/`develop`

**Cosa fa**:
1. Crea container con postgres 16 + redis 7
2. Installa dipendenze: `pnpm install --frozen-lockfile`
3. **Lint** TypeScript (backend)
4. **Build** TypeScript (backend) → rileva errori di tipo
5. **Migrazioni** → applica migrazioni Docmost + DocOps
6. **Test** → esegue test automatici (`pnpm test`)
7. **Build client** → build frontend (Vite)

**Risultato**: 
- ✅ **Passa** = il codice compila, le migrazioni funzionano, i test passano
- ❌ **Fallisce** = blocca il merge fino a che non fissi gli errori

**Timeout**: 20 minuti

---

## 2. 🔐 Security Scan

**File**: `.github/workflows/security.yml`

**Trigger**:
- Push su `main`
- Ogni lunedì alle 08:00 UTC (automatico)

**Cosa fa**:
1. Installa dipendenze
2. **pnpm audit --audit-level=high** → cerca vulnerabilità High/Critical nelle dipendenze
   - Se trova qualcosa: **workflow fallisce** (blocca merge)
   - ❌ Niente patch disponibili? Apri issue e valuta il rischio
3. **pnpm audit --audit-level=low** → mostra anche Medium/Low (solo informazione)

**Risultato**:
- ✅ **Niente High/Critical** = sicuro
- ⚠️ **Medium/Low trovate** = attenzione ma non blocca
- ❌ **High/Critical trovate** = devi fixare (update, patch, o dismissal documentato)

**Quando agire**:
- Giovedi mattina: se l'audit automatico fallisce lunedi, scopri lunedi sera e puoi fixare entro giovedi

---

## 3. 🔄 Sync Upstream

**File**: `.github/workflows/sync-upstream.yml`

**Trigger**:
- Ogni domenica alle 06:00 UTC (automatico)
- Manualmente da GitHub UI (workflow_dispatch)

**Cosa fa** (sincronizzazione con `docmost/docmost` upstream):
1. Fetcha i nuovi commit da upstream
2. Conta quanti commit sono in upstream ma non nel fork
3. Se **divergence = 0** → fork è aggiornato, skip
4. Se **divergence > 0** → upstream ha novità:
   - Crea branch `sync/upstream-<SHA>`
   - Prova il merge (dry-run, senza committare)
   - Detect conflitti
   - **Apre PR automatica** con checklist review (mai auto-merge)

**Checklist review PR di sync** (obbligatoria):
- [ ] Leggi i commit upstream impattanti
- [ ] Verifica file critici (`users.entity.ts`, `pages.entity.ts`, `notifications.module.ts`)
- [ ] Verifica UI (`Sidebar.tsx`, `PageHeader.tsx`)
- [ ] Esegui `pnpm install` + `pnpm dev` localmente
- [ ] Esegui migrazioni + test
- [ ] Aggiorna `SYNC_LOG.md`
- [ ] 2 persone approvano

**Risultato**:
- ✅ **PR creata** → devi revieware e mergeare manualmente
- ⚠️ **Conflitti rilevati** → apre lo stesso PR ma con flag warning
- ❌ **Fallimento critico** → apre issue instead di PR

**Frequenza**: una volta a settimana (domenica mattina)

**Perché non auto-merge?** Perché Docmost upstream ha feature commerciali (`packages/ee`) che incompatibili con AGPL. Devi revisare a mano.

---

## 4. 🚀 Release

**File**: `.github/workflows/release.yml`

**Trigger**:
- Push di un tag `v*` (es. `v0.25.3`)
- Manualmente (workflow_dispatch)

**Cosa fa** (build e publicazione Docker):
1. Checkout codice
2. Build Docker image per:
   - `linux/amd64` (runner: ubuntu-latest)
   - `linux/arm64` (runner: ubuntu-24.04-arm)
3. Push images a Docker Hub con tags:
   - `docmost/docmost:v0.25.3`
   - `docmost/docmost:0.25.3` (senza v)
   - `docmost/docmost:latest` (solo per non-pre-release)
4. Crea multi-arch manifest
5. Crea GitHub Release con image archives (.tar.gz)

**Risultato**:
- ✅ **Success** = Docker image live su `docker.io/docmost/docmost:v0.25.3`
- ❌ **Fail** = issue con build o Docker Hub auth

**Chi triggera?** Dev/DevOps esegue:
```bash
git tag v0.25.3
git push origin v0.25.3
```

**Chi usa?** Chiunque vuole la versione stable:
```bash
docker run docmost/docmost:v0.25.3
```

---

## Matrice decisionale: quando che cosa succede

| Evento | Workflow | Automazione | Azione richiesta |
|---|---|---|---|
| Push a `main` | CI | Build + test | Aspetta risultato (blocca merge se fallisce) |
| Push a `feat/*` | CI | Build + test | Aspetta risultato |
| PR verso `main` | CI | Build + test | Aspetta risultato (merge richiede ✅ CI) |
| Ogni lunedì 08:00 UTC | Security | Audit dipendenze | Se fallisce: leggi issue, fixa entro mercoledi |
| Ogni domenica 06:00 UTC | Sync Upstream | Crea PR sync | Reviewa checklist, mergea manualmente se ok |
| `git tag v*` + push | Release | Build Docker | Immagine live su Docker Hub 5 min dopo |

---

## Come leggere i risultati

**GitHub UI (Actions tab)**:
1. Vai repo → Actions
2. Seleziona il workflow
3. Clicca il run
4. Espandi i job per vedere log

**Notifiche**:
- Email se workflow fallisce (su pull request che hai aperto)
- Badges visibili in PR description

**Local test CI (prima di pushare)**:
```bash
# Simula CI: build + test
pnpm --filter ./apps/server run build
pnpm --filter ./apps/server run test
```

---

## Troubleshooting Actions

| Problema | Causa | Fix |
|---|---|---|
| CI fallisce con TypeScript error | Codice ha errori di tipo | Fixa localmente: `pnpm --filter ./apps/server run build` |
| CI fallisce con test error | Test unitari falliscono | Fixa test: `pnpm --filter ./apps/server run test` |
| Security scan fallisce | Vulnerabilità High/Critical | `pnpm audit --fix` o update la dipendenza |
| Sync PR non creata (no-op) | Fork già aggiornato | OK, nulla da fare |
| Release fallisce con "auth" | Docker Hub token scaduto | Contatta admin, rigenera secret |

---

## Secrets e Permissions

I workflow usano GitHub secrets (configurati in Settings):
- `DOCKERHUB_USERNAME` — Docker Hub username (release)
- `DOCKERHUB_TOKEN` — Docker Hub API token (release)
- `BUILD_APP_ID` — GitHub App ID (release)
- `BUILD_APP_PRIVATE_KEY` — GitHub App private key (release)

⚠️ **Non modificare questi senza coordinamento** — sono gestiti da DevOps.

---

## Tips

1. **Sync upstream falsa? Triggera manualmente:**
   ```
   GitHub UI → Actions → Sync Upstream → Run workflow
   ```

2. **CI lentissima? Verifica pnpm cache:**
   ```bash
   rm pnpm-lock.yaml  # ricreerà il lock
   pnpm install
   ```

3. **Vuoi testare localmente tutto quel che fa CI?**
   ```bash
   pnpm install --frozen-lockfile
   pnpm --filter ./apps/server run lint
   pnpm --filter ./apps/server run build
   pnpm --filter ./apps/server run migration:latest
   pnpm --filter ./apps/server run test
   ```

4. **Uno workflow bloccato?** Cancellalo da GitHub UI (Actions → Runs → cancella il run) e ripushalo.
