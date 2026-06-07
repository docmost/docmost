# Docmost Agent Skills & Auto-Organize — 規格書 (Workstream D)

> Status: **DESIGN / for review**. No code yet. This spec defines the **A3** deliverable under a
> **thin-server / smart-agent** model:
>
> - **Docmost (in AgentWiki) provides API only** — pure storage, retrieval, and a progress
>   relay. It does **not** run the organize intelligence and needs **no server-side LLM** for
>   this flow.
> - **The external agent is the brain** — Hermes Agent / openclaw / opencode receive the data,
>   use their **own** LLM to summarize (c), tag + classify (b), analyze dedup + decide versions
>   (e), and generate code→wiki content (h), then **write the results back** into Docmost wiki
>   pages via the API. The agent also **reports progress** so the Docmost frontend can show what
>   it is doing in realtime (g).
>
> Companion specs:
> [`docmost-agent-api-spec.md`](./docmost-agent-api-spec.md) (REST gateway, A) ·
> [`docmost-ai-features-design.md`](./docmost-ai-features-design.md) (in-editor AI, B) ·
> [`docmost-mcp-design.md`](./docmost-mcp-design.md) (MCP, C) ·
> [`docmost-bulk-import-design.md`](./docmost-bulk-import-design.md) (bulk import).

---

## 1. Goal & the responsibility split

A3 wants: bulk upload (a), auto classify/tag/folder (b) + a manual UI for it (b-1), auto-summary
(c), search (d), version + dedup (e), a status-page link (f), a realtime "agent is organizing"
view in the Docmost UI (g), and code→wiki (h).

The guiding principle (this revision): **keep Docmost dumb and durable; put the reasoning in the
agent.** Docmost exposes primitives; the agent composes them. Concretely:

### 1.1 RACI — who does what

| Step | **Agent does** (its own LLM/compute) | **Docmost provides API** (store / retrieve / relay) |
|---|---|---|
| a 上傳 | collect & send the files (or pre-built page content) | `POST /api/pages/import-files` (store→pages) **or** `POST /api/pages/create` |
| b 分類 | decide target space/folder from the taxonomy it fetched | `GET /api/spaces`, `POST /api/pages/move` / `move-to-space` |
| b 標籤 | generate tag names from content + existing vocabulary | **native labels (✅ exists)**: `POST /api/pages/labels/add {pageId,names[]}`, `POST /api/labels` (list), `POST /api/pages/labels` (read) |
| b-1 手動 | (n/a — human) | upload UI + native label picker (✅ exists) + the same APIs |
| c 摘要 | summarize each page | **`POST /api/pages/update {pageId,summary}` → `pages.summary` (✅ implemented, D1)** |
| d 搜尋 | form queries, interpret hits | `POST /api/search` (keyword); page list/content read |
| e 去重 | decide what to merge from the clusters returned | **✅ `POST /api/dedup/analyze`** (hash+cluster), **`POST /api/dedup/resolve`** (soft-delete) |
| e 版本 | decide what is a new version vs. edit | native **page history** (auto on write) + `POST /api/pages/update` |
| f 狀態 | open a task, push progress, hand the URL to the user | `POST /api/organize-tasks`, `…/:id`, status page `/organize/:token` |
| g 即時 | report each step as it happens | ingest events `POST /api/organize-tasks/:id/events` → **SSE relay** to UI |
| h 代碼 | read code, generate wiki pages + structure | `POST /api/pages/import-files` (store the generated tree) |

> **Rule of thumb:** if a step needs an LLM or a judgement call, the **agent** owns it. If it
> needs persistence, access control, search, or showing something to a human, **Docmost** owns
> it. Docmost's own in-editor AI (Workstream B) is unrelated to this flow and stays optional.

**Non-goals.** No EE code copied. No new auth (agents use the personal **API key** already
built, which also powers MCP). No server-side organize LLM. RAG answers stay in B2.

## 2. Architecture — agent orchestrates, Docmost stores & relays

```
  Hermes / openclaw / opencode  (owns the LLM; runs the organize loop)
     │  1. upload files            ─────────────►  POST /api/pages/import-files ─► pages
     │  2. open organize task      ─────────────►  POST /api/organize-tasks  ◄─ {id, statusUrl}
     │     ┌─ for each new page (agent-side reasoning) ─────────────────────┐
     │     │ read page  ◄── GET /api/pages/info                             │
     │     │ summarize (agent LLM)      ─► PATCH /api/pages {summary}        │
     │     │ tag+classify (agent LLM)   ─► POST /api/page-tags, /pages/move  │
     │     │ dedup (agent compares hashes)─► GET content-hashes, /dedup/resolve│
     │     │ report step  ─────────────►  POST /api/organize-tasks/:id/events │
     │     └──────────────────────────────────────────────────────────────┘
     │  3. complete task           ─────────────►  PATCH /api/organize-tasks/:id {done}
     ▼
  Docmost frontend  ◄── SSE  GET /api/organize-tasks/:id/stream  (relays the agent's events, g)
  Human            ◄── opens /organize/:shareToken  (status page, f)
```

Docmost is a **store + relay**: it persists pages/tags/summaries/hashes, tracks the task the
agent opened, and **re-broadcasts the agent's progress events** over SSE so the UI can render a
live view of work happening *outside* the server. No server-side AI is invoked.

## 3. The Agent Skill bundle (the A3 "Agent Skills")

A **skill** = one named primitive with a JSON-schema'd I/O, backed by a single REST/MCP call.
The *intelligence* (summarize/classify/tag/dedup-decide/code-understand) is **not** a skill — it
is the agent's own model. Skills are the hands; the agent is the head.

### 3.1 Canonical skills (all thin wrappers over Docmost API)

| Skill | Backing call | Role in flow |
|---|---|---|
| `wiki.files.upload` | `POST /api/pages/import-files` → `{ fileTaskId, pageIds[] }` | a / h store |
| `wiki.page.create` | `POST /api/pages/create` | write a built page |
| `wiki.page.get` | `POST /api/pages/info` | read content to reason over |
| `wiki.page.update` | `POST /api/pages/update` | write a new version (Yjs path) |
| `wiki.page.setSummary` | `POST /api/pages/update {summary}` ✅ | c |
| `wiki.page.move` | `POST /api/pages/move` / `move-to-space` | b classify |
| `wiki.spaces.list` | `GET /api/spaces` | b: choose a folder |
| `wiki.labels.list` | `POST /api/labels` ✅ | b: existing vocabulary |
| `wiki.page.addLabels` | `POST /api/pages/labels/add {names[]}` ✅ | b: persist chosen tags |
| `wiki.page.labels` | `POST /api/pages/labels` ✅ | b: read a page's labels |
| `wiki.dedup.analyze` | `POST /api/dedup/analyze` ✅ | e: hash + cluster duplicates |
| `wiki.dedup.resolve` | `POST /api/dedup/resolve` ✅ | e: apply merge (soft-delete) |
| `wiki.page.history` | `POST /api/pages/history` (existing) | e: versions |
| `wiki.search` | `POST /api/search` | d |
| `wiki.organize.open` | `POST /api/organize-tasks/create` → `{ id, shareToken, statusUrl }` ✅ | f |
| `wiki.organize.status` | `POST /api/organize-tasks/info {organizeTaskId}` ✅ | f |
| `wiki.organize.report` | `POST /api/organize-tasks/events` ✅ | g |
| `wiki.organize.close` | `POST /api/organize-tasks/update {status,completed}` ✅ | f/g |

> Several read/write primitives already exist as **MCP tools**
> ([mcp.service.ts](../../apps/server/src/integrations/mcp/mcp.service.ts):
> `get_current_user, list_spaces, search_pages, get_page, list_recent_pages, create_page,
> update_page`). Workstream D adds the **tags / summary / dedup / organize-task** tools to the
> same MCP server and REST surface; the skill bundle is one documented projection of that
> backend.

### 3.2 Per-agent adapters (same endpoints, native packaging)

- **Hermes Agent / opencode (function-calling):** consume the auto-generated **OpenAPI**. Ship
  `skills/docmost.openapi.json` (filtered to §3.1) + `skills/docmost.skills.json`
  (skill-name → operationId). Auth: `Authorization: Bearer <API_KEY>`.
- **opencode / Claude-family (MCP):** `claude mcp add docmost --transport http <url>/mcp
  --header "Authorization: Bearer <key>"`. Same tools, no extra files.
- **openclaw:** ship `skills/docmost/` — one descriptor (markdown + JSON-schema + example) per
  §3.1 skill, plus a recommended **organize recipe** (the loop in §5) so the agent knows how to
  compose them.

```
skills/
  docmost.openapi.json     docmost.skills.json
  docmost/                 # openclaw descriptors, one per skill
    wiki.files.upload.md  wiki.page.setSummary.md  wiki.organize.report.md  ...
    RECIPE.organize.md     # the §5 loop as a reusable agent playbook
  README.md                # per-agent install (Hermes / openclaw / opencode)
```

## 4. Data model Docmost must add (additive migrations, no EE)

These exist purely so the **agent's results** have somewhere to live and the UI can render them.

- **Tags (b) — already native, reuse it.** Verification (this round) found Docmost ships a full
  **labels** feature: tables `labels(id, name, type='page', workspace_id, UNIQUE(workspace_id,
  type, name))` + `page_labels(page_id, label_id, UNIQUE(page_id,label_id))`
  ([migration](../../apps/server/src/database/migrations/20260509T121236-labels.ts)), a server
  module ([label.controller.ts](../../apps/server/src/core/label/label.controller.ts),
  [label.service.ts](../../apps/server/src/core/label/label.service.ts),
  [label.repo.ts](../../apps/server/src/database/repos/label/label.repo.ts)), **and** a client
  picker/chip UI ([apps/client/src/features/label/](../../apps/client/src/features/label/)).
  `POST /api/pages/labels/add {pageId, names[]}` upserts-by-name + attaches (CASL
  `validateCanEdit`) — exactly what the agent needs. **No new tag tables; D1 builds nothing
  here.** (Optional future: an `origin` column to flag agent- vs human-added labels — not
  required for A3.)
- **Summary (c) — implemented this round (D1).** Added `pages.summary` (nullable text,
  [migration](../../apps/server/src/database/migrations/20260606T120000-page-summary.ts)),
  surfaced in `page.repo.baseFields` so it returns from `/api/pages/info`, and writable via
  `POST /api/pages/update {pageId, summary}`
  ([update-page.dto.ts](../../apps/server/src/core/page/dto/update-page.dto.ts),
  [page.service.ts](../../apps/server/src/core/page/services/page.service.ts) `update`). The
  agent fills it; build + lint green.
- **Content hash (e)** — `page_content_hashes(page_id PK, workspace_id, sha256, char_len,
  updated_at, INDEX(workspace_id, sha256))`. Docmost computes/refreshes the hash on each write
  (cheap, deterministic) and **exposes** it; the **agent** does the dedup reasoning. Versions
  ride **native page history** (already recorded on every Yjs write).
- **Organize task (f, g)** — the agent's externally-run job, mirrored for status + relay:
  ```
  organize_tasks(id, workspace_id, space_id?, created_by, source enum('upload','code','manual'),
     status enum('open','running','succeeded','failed'),
     total?, completed?, file_task_id?, share_token char(32) UNIQUE, error?, created_at, updated_at)
  organize_events(id, organize_task_id, page_id?, title?, step text, status text,
     detail jsonb, created_at)   -- append-only feed the agent pushes; the SSE relay tails it
  ```

## 5. The organize flow (agent playbook, ship as RECIPE.organize.md)

This is the loop the **agent** runs; every numbered action is a §3.1 skill call. No server LLM.

1. `wiki.files.upload(files, spaceId)` → poll `file-tasks/info` to `success` → get `pageIds[]`.
   (Inbox space recommended as the landing zone.)
2. `wiki.organize.open(spaceId, fileTaskId)` → `{ id, statusUrl }`. Hand `statusUrl` to the user
   (requirement **f**).
3. Fetch context once: `wiki.spaces.list`, `wiki.labels.list`, `wiki.dedup.analyze` (clusters).
4. For each `pageId`:
   a. `wiki.page.get` → content.
   b. **dedup (e)** — if the page appears in a duplicate cluster →
      `wiki.dedup.resolve(keep, drop[])`, report, skip rest.
   c. **summarize (c)** — agent LLM → `wiki.page.setSummary` (`POST /api/pages/update {summary}`).
   d. **tag (b)** — agent LLM picks names (reusing `wiki.labels.list` vocabulary) →
      `wiki.page.addLabels` (`POST /api/pages/labels/add {names[]}`, native upsert-by-name).
   e. **classify (b)** — agent LLM picks target space/parent → `wiki.page.move` (or leave in
      inbox + tag `needs-review` if low confidence).
   f. **version (e)** — content edits go via `wiki.page.update` (Yjs); native history records the
      version automatically.
   g. `wiki.organize.report(step, status, detail)` after **each** sub-step (drives **g**).
5. `wiki.organize.close(status='succeeded', completed=N)`.

Because the agent reports every sub-step, the UI shows a live checklist even though the work runs
entirely outside Docmost.

## 6. Dedup & version, the thin-API way (e) — ✅ implemented (D4)

- `POST /api/dedup/analyze { spaceId? }` → computes a **normalized** sha256 (whitespace-collapsed,
  trimmed, lowercased) over each page's `textContent`, **persists** it to `page_content_hashes`,
  and returns exact-duplicate **clusters**: `{ scanned, duplicateClusters, clusters:[{ sha256,
  charLen, pages:[{pageId,title,slugId,spaceId}], recommendation:{keepPageId,dropPageIds} }] }`.
  Recommendation keeps the **oldest** page; empty/whitespace pages are skipped. Read-only — the
  **agent** decides; near-dup judgement (embeddings/LLM) stays agent-side.
- `POST /api/dedup/resolve { keepPageId, dropPageIds[], mode:'soft-delete' }` → validates
  keep∉drop, then for each drop page checks workspace + space **Edit/Page** CASL and
  **soft-deletes** via `pageRepo.removePage` (never hard-delete; descendants handled; native
  history preserves versions). `redirect` mode documented as future.
- Versioning needs **no new engine**: every `wiki.page.update` already creates a history entry.
  The agent decides *whether* a change warrants a rewrite vs. a new child page.

Source: [dedup.util.ts](../../apps/server/src/core/dedup/dedup.util.ts) (+`.spec.ts`),
[dedup.service.ts](../../apps/server/src/core/dedup/dedup.service.ts) (+`.spec.ts`),
[dedup.controller.ts](../../apps/server/src/core/dedup/dedup.controller.ts),
[dedup.repo.ts](../../apps/server/src/database/repos/dedup/dedup.repo.ts),
[migration](../../apps/server/src/database/migrations/20260607T120000-page-content-hashes.ts);
11 unit tests green.

## 7. Status page + realtime relay (f, g) — Docmost's relay role

### 7.1 Poll + shareable link (f) — server ✅ implemented (D2)
Implemented routes (all `POST`, `/api` prefix, `JwtAuthGuard` → works for both session and API
key, `AuthWorkspace`-scoped):
- `POST /api/organize-tasks/create {spaceId?,source?,title?,total?,fileTaskId?}` →
  `{ id, shareToken, statusUrl, status:'open', ... }`. (`spaceId` requires space **Edit/Page**.)
- `POST /api/organize-tasks/info {organizeTaskId}` → task + ordered `events[]` (for agents).
- `POST /api/organize-tasks/by-token {shareToken}` → same, resolved by the share token.
- `POST /api/organize-tasks/update {organizeTaskId,status?,completed?,total?,error?}` → lifecycle.
- `POST /api/organize-tasks/events {organizeTaskId,step,status?,pageId?,title?,detail?,countsAsProgress?}`
  → appends an event; first event flips `open→running`; `countsAsProgress` bumps `completed`.
- `POST /api/organize-tasks` (pagination body) → workspace task list (newest-first, uuid-v7 cursor).
- **Pending (D3 UI):** the client route `/organize/:shareToken` that renders the above as a
  human-openable status page. `share_token` lets the agent hand a user a URL.
Source: [organize.controller.ts](../../apps/server/src/core/organize/organize.controller.ts),
[organize.service.ts](../../apps/server/src/core/organize/organize.service.ts),
[organize.repo.ts](../../apps/server/src/database/repos/organize/organize.repo.ts);
8 unit tests green.

### 7.2 Realtime feed (g) — Docmost re-broadcasts the agent's events — ✅ implemented (D3)
- The agent pushes to `POST /api/organize-tasks/events`; `OrganizeService` appends to
  `organize_events` **and publishes** to Redis channel `organize:<taskId>` (also a `done` on
  terminal `update`). A failed publish never breaks the write path.
- `GET /api/organize-tasks/:id/stream` → **SSE** (`reply.hijack()`, `data: {json}\n\n`,
  `: ping` heartbeats). Emits `{type:'snapshot', task}` (catch-up) → `{type:'event', event,
  completed, total, status}` per report → `{type:'done', status}`. A per-connection subscriber is
  a `redisService.getOrThrow().duplicate()`; cleaned up on client close.
- **UI:** `useOrganizeStream` (EventSource, cookie auth) + `OrganizePanel` (Mantine `Progress` +
  `Timeline` checklist) render the live view — the literal answer to g: the frontend shows, in
  realtime, what the **external** agent is doing, because the agent narrates and Docmost relays.
  No server-side AI; reuses the queue's existing Redis.
- **Verification:** 3 added server unit tests (publish-on-event, done-on-terminal, channel
  naming); the raw SSE socket + UI need a live stack to confirm end-to-end.
Source: [organize.controller.ts](../../apps/server/src/core/organize/organize.controller.ts)
`stream`, [organize.service.ts](../../apps/server/src/core/organize/organize.service.ts)
`channel`/`publish`; client [features/organize/](../../apps/client/src/features/organize/).

## 8. Frontend & manual REST (b-1)

The human path reuses the **same** Docmost APIs (it just doesn't have an agent brain):
- **Upload UI:** drag-drop multi-file/folder (`webkitRelativePath`) → `POST /api/pages/import-files`
  → opens the §7.2 panel. (If an agent is configured, a "Let agent organize" button opens an
  organize task for it to pick up; otherwise the human tags/moves manually.)
- **Tag UI:** chips on the page header → `POST /api/page-tags` / `DELETE /api/page-tags`; accept/
  reject agent-suggested tags.
- **Summary:** shows `pages.summary`; "Regenerate" can ask an agent (or the in-editor AI, B1).
- **Review queue:** pages the agent left `needs-review` surface in an inbox for one-click accept.

## 9. Code → wiki (h) — agent generates, Docmost stores

This is the part the question "can a git repo be turned into a wiki via skills, split into tasks
executed one-by-one, dynamically written into Docmost?" asks about. **Yes** — and the prior art
below confirms the exact shape: the agent (not the server) does it, in a **catalog-first,
page-by-page** loop, writing each page into Docmost as it finishes.

### 9.1 Prior art (web research) — they all use the same separated, task-decomposed shape
- **OpenDeepWiki** (AIDotNet): pipeline = *source prep → metadata analysis → **catalog
  generation** (AI builds the document outline) → **content generation per catalog item** →
  post-processing (translation/mindmap/incremental)*, run by **background workers** (a task
  queue), and it **exposes MCP** (`/api/mcp/{owner}/{repo}`) so external agents drive it. This is
  exactly the "split into tasks, execute one-by-one" model — applied to our split, the *agent*
  is the worker and *Docmost* is the store.
- **deepwiki-open** (AsyncFuncAI): *clone/analyze structure → **code embeddings (RAG)** →
  AI-generated docs (overview, architecture, components, usage) → Mermaid diagrams*. Confirms
  **RAG per page** for grounding.
- **git-wiki-builder / RepoWiki / microsoft `deep-wiki` skill**: same idea packaged as a CLI /
  agent **skill**.

Takeaway for AgentWiki: keep our separation (agent = brain, Docmost = API). The agent runs the
DeepWiki-style loop with **its own** LLM/RAG and writes results into Docmost via skills — Docmost
needs **no** repo-cloning, embedding, or generation code for (h).

### 9.2 The flow (agent recipe — ship as `skills/docmost/RECIPE.code-to-wiki.md`)
1. **Analyze** — agent reads the repo (its filesystem or an uploaded zip), maps the tree, detects
   languages, and (optionally) builds its own embeddings for RAG.
2. **Catalog (the task list)** — agent's LLM produces a **wiki outline**: an ordered list of pages
   (Home/overview, per-module/architecture/API/usage pages) with parent/child structure. *This is
   the "split into tasks" step* — each catalog entry = one generation task.
3. **Generate page-by-page** — for each catalog task, RAG-retrieve the relevant code → LLM writes
   the page (purpose, public API, key types/functions, usage, source-path callout, optional
   Mermaid). After each page is written, the agent **immediately** persists it
   (`wiki.page.create` under the right parent) and `wiki.organize.report`s — so the Docmost UI
   shows the wiki **growing live** (requirement g, "dynamically written in"). Large repos batch
   the tasks; the agent checkpoints progress in the organize task so it can resume.
4. **Index + cross-link** — agent creates/updates the Home page with links to all generated pages.
5. **Organize** — run the §5 loop over the generated pages (summary, labels, dedup).

Docmost adds **nothing code-specific** — `import-files`/`create` + labels + summary + the
organize-task relay already suffice. (Optional later: a `repoUrl` convenience and syntax-aware
rendering — not required for h.)

## 10. REST surface Docmost must add (summary)

| Route | Purpose | A3 | New? |
|---|---|---|---|
| `POST /api/pages/import-files` | bulk upload → pages | a/h | ✅ exists |
| `GET /api/spaces`, `POST /api/pages/move` | list/move for classify | b | exists |
| `POST /api/labels`, `POST /api/pages/labels[/add\|/remove]` | tag store (native labels) | b/b-1 | ✅ exists |
| `POST /api/pages/update {summary}` | store summary | c | ✅ **done (D1)** |
| `POST /api/search` | keyword search | d | exists |
| `POST /api/dedup/analyze`, `POST /api/dedup/resolve` | dedup primitives | e | ✅ **done (D4)** |
| `POST /api/pages/history` | versions | e | exists |
| `POST /api/organize-tasks/{create,info,by-token,update}` + list | task lifecycle | f | ✅ **done (D2)** |
| `POST /api/organize-tasks/events` | report progress event | g | ✅ **done (D2)** |
| `GET /api/organize-tasks/:id/stream` (SSE) | realtime relay | g | **new (D3)** |

All under `/api`, JWT **or** API-key auth, CASL-scoped to the caller. MCP mirrors the new tools.
**None require a server-side LLM.**

## 11. Phasing (one task each: build + lint + tests)

- **D1 — tag + summary store** (b/c API): **tags = native labels (no work)**; **summary ✅ done**
  (`pages.summary` migration + `page.repo` baseFields + `update-page.dto` + `page.service.update`;
  build+lint green). Remaining D1 (optional): expose summary in the page-header UI; label `origin`
  flag if we want to distinguish agent vs human tags.
- **D2 — organize task + status** (f): ✅ **server done** — `organize_tasks`/`organize_events`
  tables, repo, `OrganizeService`/`OrganizeController` (`create/info/by-token/update/events/list`),
  `statusUrl` via `APP_URL`, 8 unit tests, build+lint green. Remaining: the client
  `/organize/:token` status **page** (folded into D3 UI).
- **D3 — realtime relay** (g): ✅ **done** — Redis pub/sub publish in `OrganizeService` + SSE
  `GET /api/organize-tasks/:id/stream` + client `useOrganizeStream`/`OrganizePanel` + status page
  `/organize/:shareToken` (route wired in `App.tsx`). Server build+lint+tests green (22), client
  typecheck green. Live SSE/UI pending a running stack to confirm.
- **D4 — dedup primitives** (e): ✅ **done** — `page_content_hashes` + `dedup.util` (normalize+
  sha256) + `DedupService.analyze` (cluster) + `DedupController` (`analyze`/`resolve`, soft-delete
  via `pageRepo.removePage`), 11 unit tests, build+lint green. (Hashes are computed/persisted on
  `analyze`; an optional on-write refresh hook can come later.)
- **D5 — Agent Skill bundle** (A3 headline): ✅ **done** — `skills/docmost.skills.json` (18 skills),
  `RECIPE.organize.md` + `RECIPE.code-to-wiki.md`, `skills/docmost/SKILL.md` (openclaw descriptor),
  `skills/README.md` (per-agent install). **MCP tool additions ✅** — `list_labels`,
  `add_page_labels`, `set_page_summary`, `dedup_analyze`, `organize_create/report/close` added to
  the MCP server (9 MCP unit tests). Remaining (optional): a filtered OpenAPI doc (best generated
  from the running Nest/Swagger app) and one-file-per-skill openclaw split. *(code→wiki (h) is a
  recipe, not server code)*
- **D6 — manual upload UI** (b-1): ✅ `BulkUpload` + `BulkUploadModal` (drag-drop multi-file/folder
  → `import-files` → opens organize task → embeds `OrganizePanel` + shareable link), **mounted** as
  a "Bulk upload & organize" item in the space sidebar menu (next to Import, gated by
  `canManagePages`). Optional later: a review queue for low-confidence classifications.

Depends on: **C0 API-key** ✅ (agent auth), **bulk-import** ✅ (a/h storage). **Independent of**
the server-side AI module (B) — the agent brings its own LLM.

## 12. Test strategy

- **Unit (offline):** content-hash normalization + `content-hashes` listing; tag upsert/dedup;
  organize-task state machine; `dedup/resolve` soft-delete/redirect; SSE framing matches the
  client parser (`data:{json}` + `[DONE]`); `organize_events` append + relay fan-out.
- **Integration (agent simulated with a scripted client — no server LLM):** upload 3 `.md` →
  open task → for each page `setSummary` + `setTags` + `move` + `report` → `close`; assert pages
  carry summary + tags + landed in the chosen space, and the task shows `succeeded`. Re-upload an
  identical file → `content-hashes` exposes the dup → `dedup/resolve` soft-deletes it.
- **Realtime:** open SSE, push events, assert ordered `event`/`progress`/`done`; two subscribers
  get the same feed; the status page renders the same data.
- **Permission:** a reader key can read/search but cannot `move`/`setTags`/`dedup.resolve`; cannot
  see another space's organize task. **AI-off server:** the whole flow still works (intelligence
  is the agent's).
- **Regression:** existing import/MCP/AI/search paths unchanged; `app.module` boots with `ee`
  absent.

## 13. Source references (verified in this repo)

- Bulk upload (a/h): [import.controller.ts](../../apps/server/src/integrations/import/import.controller.ts)
  `POST pages/import-files`@204; [bulk-import.util.ts](../../apps/server/src/integrations/import/utils/bulk-import.util.ts).
- API-key auth (skills): [api-key.controller.ts](../../apps/server/src/core/api-key/api-key.controller.ts),
  [api-key.repo.ts](../../apps/server/src/database/repos/api-key/api-key.repo.ts).
- Native labels (b, reuse): [label.controller.ts](../../apps/server/src/core/label/label.controller.ts)
  (`POST /api/labels`, `/api/labels/pages`), [page.controller.ts](../../apps/server/src/core/page/page.controller.ts)
  (`labels`@107, `labels/add`@124, `labels/remove`@145),
  [labels migration](../../apps/server/src/database/migrations/20260509T121236-labels.ts),
  client [apps/client/src/features/label/](../../apps/client/src/features/label/).
- Summary (c, done D1): [page-summary migration](../../apps/server/src/database/migrations/20260606T120000-page-summary.ts),
  [page.repo.ts](../../apps/server/src/database/repos/page/page.repo.ts) `baseFields`,
  [page.service.ts](../../apps/server/src/core/page/services/page.service.ts) `update`.
- Organize task (f, done D2): [organize-tasks migration](../../apps/server/src/database/migrations/20260606T130000-organize-tasks.ts),
  [organize.repo.ts](../../apps/server/src/database/repos/organize/organize.repo.ts),
  [organize.service.ts](../../apps/server/src/core/organize/organize.service.ts) (+`.spec.ts`),
  [organize.controller.ts](../../apps/server/src/core/organize/organize.controller.ts),
  registered in [core.module.ts](../../apps/server/src/core/core.module.ts) +
  [database.module.ts](../../apps/server/src/database/database.module.ts).
- Dedup (e, done D4): [content-hash migration](../../apps/server/src/database/migrations/20260607T120000-page-content-hashes.ts),
  [dedup.util.ts](../../apps/server/src/core/dedup/dedup.util.ts),
  [dedup.service.ts](../../apps/server/src/core/dedup/dedup.service.ts) (+`.spec.ts`),
  [dedup.controller.ts](../../apps/server/src/core/dedup/dedup.controller.ts),
  [dedup.repo.ts](../../apps/server/src/database/repos/dedup/dedup.repo.ts); soft-delete reuses
  `pageRepo.removePage`.
- Skill bundle (D5): [skills/docmost.skills.json](../../skills/docmost.skills.json),
  [skills/docmost/RECIPE.organize.md](../../skills/docmost/RECIPE.organize.md),
  [skills/docmost/RECIPE.code-to-wiki.md](../../skills/docmost/RECIPE.code-to-wiki.md),
  [skills/README.md](../../skills/README.md).
- Code→wiki prior art (research): [OpenDeepWiki](https://github.com/AIDotNet/OpenDeepWiki),
  [deepwiki-open](https://github.com/AsyncFuncAI/deepwiki-open) +
  [wiki-generation guide](https://asyncfunc.mintlify.app/guides/wiki-generation),
  [git-wiki-builder](https://github.com/MakerCorn/git-wiki-builder),
  [RepoWiki](https://github.com/he-yufeng/RepoWiki).
- MCP tools to extend (skills): [mcp.service.ts](../../apps/server/src/integrations/mcp/mcp.service.ts)
  (`get_current_user, list_spaces, search_pages, get_page, list_recent_pages, create_page, update_page`).
- Queue/Redis for the SSE relay: [queue.constants.ts](../../apps/server/src/integrations/queue/constants/queue.constants.ts).
- Page create/update(Yjs)/move/history + search + response envelope: see
  [agent-api spec §2/§5/§14](./docmost-agent-api-spec.md) (verified `page.service.ts`,
  `collaboration.handler.ts`, `search.controller.ts`).
- SSE framing precedent: [ai-features design §3](./docmost-ai-features-design.md);
  [ai.controller.ts](../../apps/server/src/integrations/ai/ai.controller.ts) (`generate/stream`).
```
