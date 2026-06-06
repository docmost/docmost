# Docmost Agent Skills

Skills that let external agents — **Hermes Agent**, **openclaw**, **opencode** — drive a
self-hosted Docmost wiki (AgentWiki) over its REST API. Design principle: **Docmost is a thin
API** (store / retrieve / relay); the **agent is the brain** (summarize, classify, tag, decide
duplicates, understand code) and writes its results back into the wiki.

## Contents
- [`docmost.skills.json`](./docmost.skills.json) — the skill manifest: each skill name → HTTP
  method, path (under `<DOCMOST_BASE_URL>/api`), params, and return shape.
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
> A filtered OpenAPI document for native function-schema import is planned (see the design doc
> §3.2); until then, `docmost.skills.json` is the source of truth.

### opencode / Claude-family (MCP — no files needed)
Docmost exposes the same operations over MCP at `<DOCMOST_BASE_URL>/mcp` using the **same API
key**:
```
claude mcp add docmost --transport http https://wiki.example.com/mcp \
  --header "Authorization: Bearer dm_..."
```
(MCP currently surfaces the read/write page + search + spaces tools; the organize/dedup/label
tools are reachable via REST per the manifest.)

### openclaw (skill descriptors)
Point openclaw at this `skills/` folder. The manifest + the two `RECIPE.*.md` playbooks are
enough to compose the flow; per-skill descriptor files (one per manifest entry) can be generated
later if openclaw needs them split out.

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
