# AgentWiki (Docmost) — User Manual / 使用說明書

How to use the agent-driven ingest & organize features built on top of Docmost. Design
principle: **Docmost is a thin API** (store / retrieve / relay); the **external agent is the
brain** (summarize, classify, tag, decide duplicates, understand code) and writes results back.

Companion design docs live in [`docs/design/`](./design/); the agent skill bundle lives in
[`skills/`](../skills/).

---

## 1. What you get (A3 a–h)

| # | Capability | How |
|---|---|---|
| a | Bulk-upload text files | `POST /api/pages/import-files` or the **Bulk upload** UI |
| b | Auto classify / tag / file into folders | agent picks labels + target space; native **labels** + `pages/move` |
| c | Auto summary | agent writes `pages.summary` via `pages/update` |
| d | Search | `POST /api/search` |
| e | Version control + dedup | native page history + `POST /api/dedup/{analyze,resolve}` |
| f | "Organizing / done" status link | `organize-tasks` + a shareable page at `/organize/:token` |
| g | Live organize view in the UI | SSE relay → an "Organizing…" panel |
| h | Code → wiki | agent recipe (catalog-first, page-by-page) → pages |

All of this is reachable by **agents** (REST or MCP) and, where it makes sense, by **humans**
(the Bulk upload UI, the status page, label chips).

---

## 2. Setup

### 2.1 Run the stack
Docmost needs Postgres + Redis. Bring it up (e.g. `docker compose up -d`) and start the server;
**database migrations apply automatically on server start**, which creates the new tables
(`pages.summary`, `organize_tasks`, `organize_events`, `page_content_hashes`) alongside the
existing schema.

### 2.2 Create an API key (for agents)
In the web app: **Settings → API keys → Create**. Copy the key once (it is shown only at
creation). Agents send it as `Authorization: Bearer <key>`. The same key authenticates the MCP
endpoint.

### 2.3 (Optional) Enable MCP
Workspace admin: **Settings → AI & MCP → enable MCP**. The MCP endpoint is then served at
`<DOCMOST_BASE_URL>/mcp`.

---

## 3. For agents (Hermes / openclaw / opencode)

The skill bundle is the source of truth: [`skills/README.md`](../skills/README.md),
[`skills/docmost.skills.json`](../skills/docmost.skills.json) (18 skills → endpoints), and the two
playbooks.

### 3.1 REST (Hermes / opencode)
Set `DOCMOST_BASE_URL` + `DOCMOST_API_KEY`; each skill = `POST {BASE}/api{path}` with the bearer
header. Read the `data` field of the `{ data, success, status }` envelope.

### 3.2 MCP (opencode / Claude-family)
```
claude mcp add docmost --transport http <DOCMOST_BASE_URL>/mcp \
  --header "Authorization: Bearer <key>"
```
MCP tools cover the full flow: `search_pages, get_page, create_page, update_page, list_spaces,
list_recent_pages, get_current_user` **plus** `list_labels, add_page_labels, set_page_summary,
dedup_analyze, organize_create, organize_report, organize_close`.

### 3.3 Playbooks
- **Ingest & organize:** [`skills/docmost/RECIPE.organize.md`](../skills/docmost/RECIPE.organize.md)
  — upload → open task → per page: dedup → summarize → tag → classify, **reporting each step**.
- **Code → wiki:** [`skills/docmost/RECIPE.code-to-wiki.md`](../skills/docmost/RECIPE.code-to-wiki.md)
  — analyze repo → generate a catalog (the task list) → write each page → organize.

### 3.4 Status & live progress
`organize_create` returns `{ id, shareToken, statusUrl }`. Give `statusUrl` to a human; poll with
`organize_status`; the frontend renders progress live as the agent calls `organize_report`.

---

## 4. For humans (no agent)

### 4.1 Bulk upload
In a space, open the **… menu → "Bulk upload & organize"**. Drag-and-drop `.md` / `.html` files
(or a folder), click **Upload & organize**. You get a live "Organizing…" panel and a shareable
status link. Same endpoints the agent uses.

### 4.2 Tags (labels)
Native label picker/chips on pages; an agent's suggested tags appear the same way and can be
removed.

### 4.3 Status page
Open `/organize/:shareToken` (the link the agent or upload returns) to watch progress and see the
resulting pages, tags, and dedup outcomes update in real time.

### 4.4 Dedup
An agent (or an admin tool) calls `POST /api/dedup/analyze` to list duplicate clusters, then
`POST /api/dedup/resolve` to soft-delete the extras (kept pages retain full history; nothing is
hard-deleted).

---

## 5. Verifying it works (live smoke test)

With the stack running and an API key in `$KEY`:

1. **Upload** — create a space, then:
   ```bash
   curl -s -X POST "$BASE/api/pages/import-files" -H "Authorization: Bearer $KEY" \
     -F "spaceId=$SPACE" -F "files=@intro.md" -F "files=@guide/setup.md"
   ```
   Poll `POST /api/file-tasks/info {fileTaskId}` until `success`; confirm the pages appear.
2. **Summary** — `POST /api/pages/update {pageId, summary:"..."}`; re-read with
   `POST /api/pages/info {pageId, includeContent:true}` and confirm `summary` round-trips.
3. **Tag** — `POST /api/pages/labels/add {pageId, names:["guide"]}`; confirm the chip shows.
4. **Dedup** — re-upload an identical file → `POST /api/dedup/analyze` lists the cluster →
   `POST /api/dedup/resolve` soft-deletes the dup.
5. **Status + live (g)** — `POST /api/organize-tasks/create {spaceId}` → open the returned
   `statusUrl` in a browser; in another shell `POST /api/organize-tasks/events {organizeTaskId,
   step:"summarize", countsAsProgress:true}` and watch the panel update; finish with
   `POST /api/organize-tasks/update {organizeTaskId, status:"succeeded"}`.
6. **MCP** — add the server in Claude Code (§3.2) and call `dedup_analyze` / `organize_create`.

---

## 6. Notes & limits
- Imports are scoped to `.md` / `.html` in OSS (`.docx`/`.pdf` are EE).
- Dedup hashes are computed on `analyze` (on-demand) from normalized page text; near-duplicate
  detection (embeddings) is the agent's job.
- The organize intelligence is the **agent's** — Docmost runs no LLM for this flow, so it works
  even with `AI_DRIVER` unset.
- Permissions follow the API-key owner: reads need space view; writes need space **Edit**.
