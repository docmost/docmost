# FORK.md — DocOps Fork di Docmost CE

## Identità del fork

| | |
|---|---|
| **Upstream** | `github.com/docmost/docmost` (AGPL-3.0) |
| **Fork** | `github.com/tigre9/docops` (AGPL-3.0 ereditata) |
| **Scopo** | Piattaforma DocOps: catalogo 2.000 servizi + Change Request workflow a 8 stati |
| **Data fork** | 2026-05-25 |

## Regole d'oro inviolabili

1. **MAI modificare file core Docmost** se evitabile. Estendi via NestJS module pattern o React composition.
2. **MAI copiare codice da `packages/ee/*` o `apps/client/src/ee/*`**: licenza commerciale incompatibile con AGPL.
3. **Migrazioni DocOps** vanno in `apps/server/src/database/migrations-docops/` con prefisso `docops_`. MAI in `migrations/` upstream.
4. **Ogni modifica al core upstream** va documentata in questo file con motivazione.
5. **MAI inventare entità o API** non presenti nella specifica funzionale. Fermati e chiedi conferma.
6. **Versioni dipendenze**: prima di installare, leggi `pnpm-lock.yaml` upstream e usa versione coerente.
7. **TypeScript strict** ovunque. Niente `any` impliciti.

## Struttura del codice fork

```
docops/
├── apps/
│   ├── client/src/docops/          # NUOVE feature frontend (mai toccare features/ upstream)
│   │   ├── services/               # UI catalogo servizi
│   │   ├── change-requests/        # UI workflow CR
│   │   ├── dashboard/              # UI dashboard KPI
│   │   └── audit/                  # UI audit log
│   └── server/src/docops/          # NUOVI moduli backend (mai toccare modules/ upstream)
│       ├── services/               # NestJS module catalogo
│       ├── change-requests/        # NestJS module workflow CR
│       ├── audit/                  # NestJS module audit log
│       ├── webhooks/               # NestJS module webhook outbound
│       ├── dashboard/              # NestJS module KPI
│       └── sso/                    # NestJS module SSO (Fase 2)
└── apps/server/src/database/
    └── migrations-docops/          # Migrazioni custom (MAI in migrations/)
```

## Modifiche al core upstream

> Ogni modifica intenzionale a file Docmost originali va elencata qui con motivazione.
> File più a rischio di conflitti: `users.entity.ts`, `pages.entity.ts`, `notifications.module.ts`,
> `Sidebar.tsx`, `PageHeader.tsx`.

| Data | File modificato | Motivazione | Alternativa valutata |
|---|---|---|---|
| 2026-05-25 | `apps/server/package.json` | Aggiunta script `migration-docops:*` per eseguire migrazioni custom da `migrations-docops/` via migrator separato | Mettere le migrazioni in `migrations/` upstream (scartato: viola regola isolamento) |
| 2026-05-25 | `apps/server/src/app.module.ts` | Aggiunta import e registrazione `DocopsModule` nel root module | Lazy loading (scartato: non necessario per i volumi previsti) |

## ALTER TABLE su entità native Docmost (Milestone 2)

Le seguenti colonne sono state aggiunte via `migrations-docops/` alle tabelle upstream. **NON rimuovere** né rinominare queste colonne durante sync upstream.

### `users` (migration `docops_20260525T100008-alter-users.ts`)

| Colonna | Tipo | Default | Scopo |
|---|---|---|---|
| `office_id` | `uuid` | NULL | FK → `offices.id`; associa l'utente all'ufficio organizzativo |
| `docops_roles` | `varchar[]` | `'{}'` | Ruoli applicativi DocOps: `PROCESS_OWNER`, `APPROVER`, `DEVELOPER`, `TECH_LEAD` |
| `external_id` | `varchar` | NULL | Identificatore utente dal provider SSO (Fase 2) |
| `auth_provider` | `varchar` | `'local'` | Provider di autenticazione: `local`, `saml`, `oidc`, `ldap` |

### `pages` (migration `docops_20260525T100009-alter-pages.ts`)

| Colonna | Tipo | Default | Scopo |
|---|---|---|---|
| `cr_draft_id` | `uuid` | NULL | FK → `change_requests.id`; pagina in bozza sotto CR attiva |
| `current_published_version_id` | `uuid` | NULL | FK → `page_history.id`; versione formalmente pubblicata corrente |

### `page_history` (migration `docops_20260525T100010-alter-page-history.ts`)

| Colonna | Tipo | Default | Scopo |
|---|---|---|---|
| `change_request_id` | `uuid` | NULL | FK → `change_requests.id`; collega la revisione alla CR che l'ha generata |
| `is_published_version` | `boolean` | `false` | Flag: `true` solo per revisioni da pubblicazione formale di CR |
| `published_at` | `timestamptz` | NULL | Timestamp di pubblicazione formale |
| `published_by_id` | `uuid` | NULL | FK → `users.id`; autore della pubblicazione |

### Indici parziali aggiunti su tabelle upstream

| Indice | Tabella | Condizione | Scopo |
|---|---|---|---|
| `idx_page_history_cr` | `page_history` | — | Lookup rapido per CR |
| `idx_page_history_published` | `page_history` | `is_published_version = true` | Lista versioni pubblicate per pagina |

## File aggiunti alla root (non presenti in upstream)

| File | Scopo |
|---|---|
| `FORK.md` | Questo documento |
| `SYNC_LOG.md` | Log delle sincronizzazioni con upstream |
| `docker-compose.dev.yml` | Stack dev locale (db + redis con porte esposte) |
| `.env` | Configurazione locale (non committato, in .gitignore) |

## Anti-pattern da evitare

- Non rinominare tabelle/entità native (`pages`, `spaces`, `users`): difficoltà nei merge.
- Non rimuovere feature Docmost inutilizzate: disabilitarle via feature flag.
- Non modificare `pnpm-lock.yaml` manualmente: usare solo `pnpm add/remove`.
- Non fare merge automatico dei PR di sync upstream: revisione obbligatoria da 2 sviluppatori.

## Soglie di allerta

| Metrica | Target | Allerta |
|---|---|---|
| Commit di divergenza da upstream | < 500 | > 1.000 = fork a rischio |
| File core Docmost modificati direttamente | < 20 | Ogni aggiunta richiede ADR |
| Tempo applicazione patch sicurezza High/Critical | ≤ 7 giorni | Monitorare GitHub Security Advisories |
