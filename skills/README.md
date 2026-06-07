# Docmost Agent Skills

Skills that let external agents — **Hermes Agent**, **openclaw**, **opencode** — drive a
self-hosted Docmost wiki (AgentWiki) over its REST API. Design principle: **Docmost is a thin
API** (store / retrieve / relay); the **agent is the brain** (summarize, classify, tag, decide
duplicates, understand code) and writes its results back into the wiki.

## Contents
- [`docmost.skills.json`](./docmost.skills.json) — the skill manifest: each skill name → HTTP
  method, path (under `<DOCMOST_BASE_URL>/api`), params, and return shape.
- [`docmost.openapi.json`](./docmost.openapi.json) — OpenAPI 3.1 for native function-calling
  import (Hermes / opencode).
- [`docmost/RECIPE.organize.md`](./docmost/RECIPE.organize.md) — playbook: ingest files → dedup,
  summarize, tag, classify, with live progress (A3 a/b/c/e/f/g).
- [`docmost/RECIPE.code-to-wiki.md`](./docmost/RECIPE.code-to-wiki.md) — playbook: turn a git repo
  into a wiki, catalog-first and page-by-page (A3 h).

## Auth (all agents)
1. In Docmost: **Settings → API keys → create** a key. Copy it once.
2. Send `Authorization: Bearer <DOCMOST_API_KEY>` on every request.
3. Calls are scoped to the key owner's permissions; writes need space **Edit** rights.

## Per-agent setup

### Hermes Agent / opencode (function calling over REST)
Load `docmost.skills.json` and expose each `skills[]` entry as a callable tool. Set two env vars:
```
DOCMOST_BASE_URL=https://wiki.example.com
DOCMOST_API_KEY=dm_...
```
Each tool call = `POST {DOCMOST_BASE_URL}/api{path}` with the JSON body from `params` and the
bearer header. Read the `data` field of the `{ data, success, status }` envelope.
> For native function-schema import, load [`docmost.openapi.json`](./docmost.openapi.json)
> (OpenAPI 3.1, 20 operations). `docmost.skills.json` remains the human-readable index.

### opencode / Claude-family (MCP — no files needed)
Docmost exposes the same operations over MCP at `<DOCMOST_BASE_URL>/mcp` using the **same API
key**:
```
claude mcp add docmost --transport http https://wiki.example.com/mcp \
  --header "Authorization: Bearer dm_..."
```
MCP now surfaces the full set: read/write pages, search, spaces, **plus** `list_labels`,
`add_page_labels`, `set_page_summary`, `dedup_analyze`, and `organize_create/report/close` — so
the entire organize flow is drivable over MCP as well as REST.

### openclaw (skill descriptors)
Point openclaw at this `skills/` folder and load [`docmost/SKILL.md`](./docmost/SKILL.md) — a
single descriptor that lists every skill (with method/path/params) and links the two
`RECIPE.*.md` playbooks. That plus `docmost.skills.json` is enough to compose the flow; if
openclaw later needs one file per skill, they can be split out from the manifest.

## Quick start (organize a batch)
1. `wiki.files.upload` the files into an inbox space → poll `wiki.files.taskStatus`.
2. `wiki.organize.open` → share the returned `statusUrl` with the user.
3. Follow [`RECIPE.organize.md`](./docmost/RECIPE.organize.md): per page → summarize, tag,
   classify, dedup, **reporting each step** so the Docmost UI shows it live.
4. `wiki.organize.close`.

## Status
Backed by implemented Docmost endpoints: page summary, labels (native), search, dedup
(`/api/dedup/*`), and organize tasks (`/api/organize-tasks/*`). The live-progress **UI panel**
and the human **status page** at `/organize/:shareToken` are the remaining client work (design
doc Workstream D3).
```
