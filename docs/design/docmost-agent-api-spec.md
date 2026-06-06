# Docmost Agent REST API — 規格書 (Workstream A)

> Status: **DESIGN / for review**. No code yet. This spec defines an open-source REST API
> gateway that external agents (**Hermes Agent**, **opencode**) call to read/write a
> self-hosted Docmost wiki, plus an internal self-test harness.
>
> Companion spec: [`docmost-ai-features-design.md`](./docmost-ai-features-design.md) (Workstream B).

---

## 1. Goal & non-goals

**Goal.** Give agents a clean, documented, REST-native HTTP API over a self-hosted Docmost,
**without** touching or copying EE code (`packages/ee`, `apps/server/src/ee`). The gateway
is a thin **sidecar** that authenticates to Docmost with a *service account* and calls the
existing internal `/api/*` endpoints.

**Non-goals (this design).**
- No per-user self-issued API keys (EE-locked). The gateway uses a single static
  `GATEWAY_API_KEY` for agent auth instead.
- No direct Postgres access and **no Yjs client** — see §3, the content-write path already
  exists in the OSS core, so the gateway never needs to speak the CRDT protocol.
- No webhooks / groups / export (future).

## 2. Why a gateway (not a fork, not a Yjs sidecar)

Key finding from source review that simplifies everything: **the hard part — writing Yjs
CRDT page content — is already solved inside the OSS core** and reachable over HTTP today:

- `POST /api/pages/create` → `PageService.create()` accepts `content` + `format`
  (`json|markdown|html`), converts markdown→ProseMirror and builds the Y.Doc binary via
  `createYdocFromJson()`.
  Source: `apps/server/src/core/page/services/page.service.ts:91-160`.
- `POST /api/pages/update` → `PageService.updatePageContent()` routes the write through
  `collaborationGateway.handleYjsEvent('updatePageContent', …)` →
  `apps/server/src/collaboration/collaboration.handler.ts:78` (append/prepend/replace into
  the live `page.{id}` room; Hocuspocus persists).
  Source: `apps/server/src/core/page/services/page.service.ts:257-272`.

So the gateway is a pure HTTP client. AGPL posture: cleanest possible — it links nothing,
copies nothing, and only calls a running server over the network.

## 3. Architecture

```
  ┌─────────────┐   Bearer GATEWAY_API_KEY   ┌──────────────────┐   cookie authToken   ┌────────────────┐
  │ Hermes /    │ ─────────────────────────► │  Docmost Gateway  │ ───────────────────► │ Docmost server │
  │ opencode /  │   clean REST  /v1/...       │   (FastAPI)       │   POST /api/...      │  :3000  (OSS)  │
  │ any agent   │ ◄───────────────────────── │  service account  │ ◄─────────────────── │  + Hocuspocus  │
  └─────────────┘   JSON / OpenAPI            └──────────────────┘   {data,success}     └────────────────┘
```

- **External edge (agent-facing):** REST-native resource routes under `/v1`, documented by
  FastAPI's auto-generated **OpenAPI** (`/openapi.json`, Swagger `/docs`). That OpenAPI doc
  *is* the tool/function schema agents consume.
- **Internal edge (Docmost-facing):** one `DocmostClient` logs in with a service account and
  calls the verified internal endpoints.

## 4. Authentication

### 4.1 Agent → Gateway
- `Authorization: Bearer <key>` where `<key>` ∈ `GATEWAY_API_KEYS` (comma-separated env list).
- Implemented as a FastAPI dependency; missing/invalid → `401` with the error model (§7).
- This is the **OSS substitute** for EE's per-user API keys. (Future: a real key store +
  scopes; out of scope here.)

### 4.2 Gateway → Docmost (service account)
- `POST /api/auth/login` with `{ email, password }` (`apps/server/src/core/auth/dto/login.dto.ts`).
- **Important:** login returns the JWT in a **`Set-Cookie: authToken=…`** header, *not* in
  the body — the handler calls `setAuthCookie(res, authToken)` and returns nothing.
  Source: `apps/server/src/core/auth/auth.controller.ts` (`login`), and the strategy reads
  `req.cookies?.authToken || extractBearerTokenFromHeader(req)`
  (`apps/server/src/core/auth/strategies/jwt.strategy.ts:26-34`).
- Therefore the client keeps an **httpx cookie jar**; the cookie is sent automatically on
  subsequent calls. On `401`, re-login once and retry.
- Workspace context is auto-resolved server-side by `DomainMiddleware` (self-hosted = first
  workspace), so no workspace header is needed.

## 5. REST surface (agent-facing) → Docmost mapping

All gateway responses are unwrapped from Docmost's envelope `{ data, success, status }`
(`apps/server/src/common/interceptors/http-response.interceptor.ts:33-37`) and returned as
clean JSON.

| Gateway route | Docmost internal call | Body / params | Notes |
|---|---|---|---|
| `GET /v1/spaces/{spaceId}/pages` | `POST /api/pages/sidebar-pages` | `{spaceId}` (+cursor) | cursor pagination via `PaginationOptions` (`limit≤100`, `cursor`) |
| `POST /v1/spaces/{spaceId}/pages` | `POST /api/pages/create` | `{title?,icon?,parentPageId?,content?,format?}` | `format∈json|markdown|html` |
| `GET /v1/pages/{pageId}` | `POST /api/pages/info` | `{pageId, includeContent:true, format?}` | returns content+metadata |
| `PUT /v1/pages/{pageId}/content` | `POST /api/pages/update` | `{pageId,content,format,operation:"replace"}` | CRDT write via Hocuspocus |
| `PATCH /v1/pages/{pageId}` | `POST /api/pages/update` | `{pageId,title?,icon?}` | metadata only |
| `POST /v1/pages/{pageId}/move` | `POST /api/pages/move` | `{pageId,parentPageId?,position}` | see §6.1 (position) |
| `DELETE /v1/pages/{pageId}` | `POST /api/pages/delete` | `{pageId,permanentlyDelete?}` | soft delete by default |
| `GET /v1/search?q=&spaceId=` | `POST /api/search` | `{query,spaceId?,limit?,offset?}` | ranked `items[]` + highlight |
| `POST /v1/pages/{pageId}/attachments` | `POST /api/files/upload` | multipart `file` | gateway injects `pageId`+`spaceId` (§6.2) |
| `POST /v1/spaces/{spaceId}/import` | `POST /api/pages/import` | multipart `file`,`spaceId` | `.md`/`.html` only in OSS |

DTO sources verified: `create-page.dto.ts`, `update-page.dto.ts`, `page.dto.ts`,
`move-page.dto.ts`, `sidebar-page.dto.ts` (all under `apps/server/src/core/page/dto/`),
`search.dto.ts` (`apps/server/src/core/search/dto/`), attachment upload at
`apps/server/src/core/attachment/attachment.controller.ts:83`, import at
`apps/server/src/integrations/import/import.controller.ts:48`.

### 5.1 Example — create page
Request:
```http
POST /v1/spaces/0b3e…/pages
Authorization: Bearer <GATEWAY_API_KEY>
Content-Type: application/json

{ "title": "Runbook", "content": "# Restart\n1. ...", "format": "markdown" }
```
Response `201`:
```json
{ "id": "018f…", "slugId": "k3n…", "title": "Runbook", "spaceId": "0b3e…",
  "parentPageId": null, "position": "a0", "createdAt": "…" }
```

### 5.2 Example — search
`GET /v1/search?q=restart&spaceId=0b3e…` → `200`:
```json
{ "items": [ { "id":"018f…","title":"Runbook","slugId":"k3n…",
   "rank":0.34,"highlight":"…<b>restart</b>…" } ] }
```

## 6. Sharp edges (must be handled by the gateway)

### 6.1 `move` requires a fractional position (5–12 chars)
`MovePageDto.position` is `@IsString @MinLength(5) @MaxLength(12)`
(`apps/server/src/core/page/dto/move-page.dto.ts`). Docmost generates these with
`generateJitteredKeyBetween` (`fractional-indexing-jittered`); they are **longer** than the
plain `fractional-indexing` "a0"-style keys.

**MVP decision:** support **append-to-end / reparent-to-end** only. Algorithm:
1. List target parent's children (`/v1/spaces/{sid}/pages` filtered, or `sidebar-pages` with
   `pageId`).
2. Take the max existing `position`; compute a key strictly greater than it.
3. If the key is `<5` chars, append random chars from the fractional-indexing alphabet
   (`0-9A-Za-z`) until length ∈ [5,12]; appending preserves "greater-than-last" ordering and
   there is no upper neighbor, so order stays correct.

Arbitrary "insert between X and Y" is **documented as unsupported in MVP** (would require a
faithful Python port of the jittered algorithm). Callers needing precise order can pass an
explicit `position` and the gateway will pass it through after length validation.

### 6.2 Attachment upload needs `spaceId`
`POST /api/files/upload` requires both `pageId` and `spaceId`. The gateway route only takes
`pageId` in the path, so it first calls `/api/pages/info` to resolve `spaceId`, then forwards
the multipart stream (re-streamed, not buffered) to Docmost.

### 6.3 Import format limits
`.md` and `.html` work in OSS; `.docx`/`.pdf` import are EE
(`apps/server/src/integrations/import/services/import.service.ts`). Gateway rejects
unsupported extensions with `415` before forwarding.

## 7. Error model

Unified envelope on every gateway error:
```json
{ "error": { "code": "string_slug", "message": "human readable", "details": { } } }
```
- `401 unauthorized` (bad/missing gateway key), `403 forbidden` (Docmost CASL denied —
  surfaced from upstream), `404 not_found`, `409 conflict`, `415 unsupported_media_type`,
  `502 upstream_error` (Docmost unreachable / unexpected shape), `504 upstream_timeout`.
- Upstream Docmost errors are mapped: HTTP status passed through where sensible; message
  taken from Docmost's body when present.

## 8. Agent integration

- **Primary:** the OpenAPI document at `/openapi.json` (+ human Swagger UI at `/docs`).
  Function-calling agents (Hermes, opencode) load it to discover operations + JSON schemas.
- **Optional thin CLI** (`typer`): `docmost-gw pages list|get|create|update|move|delete`,
  `search`, `attach`, `import` — JSON to stdout by default (agent-friendly), `--pretty` for
  humans. Useful for agents that prefer shelling out.
- **Optional importable SDK:** `from docmost_gateway.sdk import GatewayClient` for in-process
  Python agents/skills.

## 9. Self-test harness (internal only)

A small **llm + agent + skills** harness whose *only* purpose is to verify the gateway.
Driving model = an **OpenAI-compatible** endpoint (base-url + key + model via env).

- `selftest/skills.py` — thin functions wrapping each gateway REST route (these are the
  agent's "skills"/tools, also exported as OpenAI function schemas).
- `selftest/agent.py` — a minimal OpenAI-compatible function-calling loop (the internal
  agent). Demonstrates real tool selection; **not** used for the pass/fail gate.
- `selftest/scenario.py` — the **deterministic** gate: fixed sequence with explicit asserts:
  `create → get(assert content round-trips) → update(replace, assert) → search(assert hit) →
  attach(assert id) → import(assert page) → delete(assert gone)`.
- `selftest/run_selftest.py` — entrypoint; runs `scenario` (deterministic). `--with-agent`
  additionally runs the LLM loop as a demo.

## 10. Configuration (env)

| Var | Purpose |
|---|---|
| `DOCMOST_BASE_URL` | e.g. `http://localhost:3000` |
| `DOCMOST_EMAIL` / `DOCMOST_PASSWORD` | service-account credentials |
| `GATEWAY_API_KEYS` | comma-separated keys agents must present |
| `GATEWAY_HOST` / `GATEWAY_PORT` | bind address (default `0.0.0.0:8080`) |
| `REQUEST_TIMEOUT_S` | upstream timeout (default 30) |
| `SELFTEST_LLM_BASE_URL` / `SELFTEST_LLM_API_KEY` / `SELFTEST_LLM_MODEL` | self-test driver |
| `DOCMOST_LIVE_TEST` | `1` to enable the live smoke test |

## 11. Directory layout

```
tools/docmost-gateway/
  pyproject.toml            # fastapi, uvicorn, httpx, pydantic, pydantic-settings, typer
  README.md
  .env.example
  docmost_gateway/
    __init__.py
    config.py               # pydantic-settings
    errors.py               # error model + exception handlers
    docmost_client.py       # service-account client (cookie jar, 401 re-login, unwrap .data)
    models.py               # pydantic request/response models
    auth.py                 # Bearer GATEWAY_API_KEY dependency
    app.py                  # FastAPI app + /v1 routes
    sdk.py                  # importable client for in-process agents
    cli.py                  # optional typer CLI
  selftest/
    skills.py  agent.py  scenario.py  run_selftest.py
  tests/
    conftest.py  test_gateway.py   # httpx.MockTransport + FastAPI TestClient
```

## 12. Phased implementation checklist (later round)

1. Package skeleton + `config.py` + `errors.py` + `auth.py`.
2. `DocmostClient`: login (cookie jar), `_post` helper (unwrap `.data`, 401 re-login+retry),
   one method per mapped endpoint.
3. `models.py` + `app.py` routes (§5), wiring `DocmostClient`.
4. `move` position helper (§6.1), attachment `spaceId` resolution (§6.2), import guard (§6.3).
5. CLI + SDK (optional).
6. Self-test harness (§9).
7. Tests (§13). README + `.env.example`.

## 13. Test strategy

- **Unit (offline, required):** `httpx.MockTransport` stubs Docmost; FastAPI `TestClient`
  drives the gateway. One test per route + the 401-re-login path + the `.data` unwrap + the
  `move` position helper + attachment `spaceId` resolution. Must pass with no live server.
- **Live smoke (gated by `DOCMOST_LIVE_TEST=1`):** run §9 `scenario` against a real stack
  (`docker compose up -d`, a service-account user + a space created in the UI). Confirm each
  step in the Docmost UI — especially that an edited page renders with correct formatting,
  proving the Yjs write path end-to-end.

## 14. Source references (verified in this repo)

- Page routes/DTOs: `apps/server/src/core/page/page.controller.ts` (`create`@201,
  `update`@271, `delete`@308, `sidebar-pages`@529, `move`@708), `…/page/dto/*`.
- Content/Yjs path: `…/core/page/services/page.service.ts:91-160, 257-272`,
  `…/collaboration/collaboration.handler.ts:78`.
- Auth: `…/core/auth/auth.controller.ts` (`login`@56), `…/auth/dto/login.dto.ts`,
  `…/auth/strategies/jwt.strategy.ts:26-34`.
- Search: `…/core/search/search.controller.ts:44`, `…/search/dto/search.dto.ts`.
- Attachment upload: `…/core/attachment/attachment.controller.ts:83`.
- Import: `…/integrations/import/import.controller.ts:48`.
- Response envelope: `…/common/interceptors/http-response.interceptor.ts:33-37`.
- Pagination: `…/database/pagination/pagination-options.ts`.
