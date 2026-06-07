# Docmost OSS Feature Tasks (from design specs)

Consolidates the design docs into actionable tasks, implemented one-by-one with tests
(build + lint + unit tests each), with a user manual at the end. Source specs:
[agent-api](./docmost-agent-api-spec.md) · [ai-features](./docmost-ai-features-design.md) ·
[mcp](./docmost-mcp-design.md) · [bulk-import](./docmost-bulk-import-design.md) ·
[agent-skills](./docmost-agent-skills-design.md).

Legend: ✅ done & verified · 🟡 partial · ⬜ todo

## 1. API keystone (personal API keys + REST auth)
- ✅ `api_keys` Kysely repo + DatabaseModule registration
- ✅ `ApiKeyService` (create/list/update/revoke/validateApiKey) + controller + DTOs + module
- ✅ `jwt.strategy` OSS fallback; unit tests (10); build+lint
- ⬜ (later) admin "restrict API keys to admins" toggle

## 2. MCP server
- ✅ `/mcp` Streamable HTTP controller, bearer API-key auth, `settings.ai.mcp` gate
- ✅ read tools: get_current_user, list_spaces, search_pages, get_page, list_recent_pages
- ✅ write tools: create_page, update_page; unit tests (6); build+lint
- ⬜ T2.1 more tools: get_space, create_space, update_space, list/add/update comments, search_attachments, list_members, move_page, duplicate_page
- ✅ T2.2 client config docs (Claude Code / Desktop / Cursor) — covered in [docs/USER-MANUAL.md](../USER-MANUAL.md) §3.2 and [skills/README.md](../../skills/README.md)

## 3. Bulk file import
- ✅ `buildBulkImportZip` util + `ImportService.importBulkFiles` + `POST /pages/import-files`
- ✅ unit tests (6); build+lint; design doc

## 4. AI — Ask AI (generative editor actions) — "B1"
- ✅ T4.1 `AiProviderService` over Vercel AI SDK (openai / openai-compatible / gemini / ollama) by `AI_DRIVER`
- ✅ T4.2 prompt templates per `AiAction` (improve/fix/longer/shorter/simplify/continue/explain/summarize/change_tone/translate/custom)
- ✅ T4.3 `AiService` + `AiController`: `POST /api/ai/generate` (sync), `POST /api/ai/generate/stream` (SSE), `GET /api/ai/config`
- ✅ T4.4 permission gate (`settings.ai.generative`), wired `AiModule`, prompt unit tests (6), build+lint

## 5. AI — AI Answers (semantic/RAG search) — "B2"
- ✅ T5.1 pgvector migration: `CREATE EXTENSION vector` + `page_embeddings(vector(dim))` + HNSW (cosine) index; `embedding.util` chunking + `AiProviderService.embeddingModel()`
- ✅ T5.2 ingestion: `AiIndexingService` (chunk → `embedMany` → `EmbeddingRepo.replacePageChunks`) + `AiQueueProcessor` consuming page/workspace AI_QUEUE jobs (gated by config + workspace `ai.search`)
- ✅ T5.3 re-embed on save/create/move + delete on delete; workspace backfill/teardown on `aiSearch` toggle (enqueue already in workspace.service; processor added)
- ✅ T5.4 `POST /api/ai/answers` (SSE): embed query → CASL-scoped cosine ANN search → grounded `streamText` + deduped `sources[]` matching the client contract
- ✅ T5.5 unit tests: chunking (5), indexing gating (8), answer retrieval/dedup (3); build+lint green. Live (ANN over real pgvector) needs a running stack with pgvector installed.

## 6. Feature-gate / entitlement unlock (makes MCP + AI UI toggles usable)
- ✅ T6.1 grant OSS-implemented features for self-hosted in **`license-check.service.ts`**
  (single source of truth — feeds both `resolveFeatures` for the entitlements endpoint and
  `hasFeature` for the enable-gate). `SELF_HOSTED_OSS_FEATURES = [API_KEYS, MCP]` — both fully
  implemented + verified. SCIM/security/AI-search stay license-gated. `ai` intentionally held
  until B2 (AI Search) has a backend, to avoid exposing a broken toggle. 4 unit tests, build+lint.
- ⬜ T6.2 live: verify admin Settings shows the API-keys + MCP entries and the MCP toggle enables
  (needs a running stack)

## 7. Agent REST API gateway (Python, Workstream A)
- ⬜ T7.1 package skeleton (`tools/docmost-gateway`): config, errors, auth (Bearer GATEWAY_API_KEY)
- ⬜ T7.2 `DocmostClient` (cookie login, 401 re-login, unwrap envelope)
- ⬜ T7.3 `/v1` routes (pages CRUD, search, attachments, import) → FastAPI OpenAPI
- ⬜ T7.4 self-test harness (skills + OpenAI-compatible agent + deterministic scenario)
- ⬜ T7.5 pytest (httpx MockTransport + TestClient)

## 8. Agent Skills & Auto-Organize (A3 b/c/e/f/g/h, Workstream D)
> Model: **thin server / smart agent** — Docmost provides API only (store + relay); the external
> agent's own LLM does summarize/tag/classify/dedup/code→wiki and writes results back. No
> server-side LLM in this flow. See [agent-skills design](./docmost-agent-skills-design.md) §1.1 RACI.
- 🟡 D1 tag + summary **store**: tags = **native labels** (`labels`/`page_labels` + `/api/pages/labels/*` + client picker — ✅ already in OSS, no work); summary ✅ **done** (`pages.summary` migration + `page.repo` baseFields + `update-page.dto` + `page.service.update`; build+lint green). Optional left: summary in page-header UI; label `origin` flag (A3 b/c)
- 🟡 D2 organize task + status: ✅ **server done** — `organize_tasks`/`organize_events` + repo + `OrganizeService`/`OrganizeController` (`create/info/by-token/update/events/list`) + `statusUrl`; 8 unit tests + build+lint green. Left: client `/organize/:token` status page (with D3 UI) (A3 f)
- ✅ D3 realtime relay: Redis pub/sub publish (`OrganizeService`) + SSE `GET /api/organize-tasks/:id/stream` + client `useOrganizeStream`/`OrganizePanel` + status page `/organize/:shareToken`; server build+lint+22 tests green, client typecheck green. Live SSE/UI pending a running stack (A3 g)
- ✅ D4 dedup primitives: `page_content_hashes` + `dedup.util` (normalize+sha256) + `DedupService.analyze` (cluster, keep-oldest) + `POST /api/dedup/{analyze,resolve}` (resolve soft-deletes via `pageRepo.removePage`); 11 unit tests + build+lint green. Hashes computed on analyze; optional on-write refresh later (A3 e — agent decides, native history = versions)
- ✅ D5 Agent Skill bundle: `skills/docmost.skills.json` (18 skills) + `RECIPE.{organize,code-to-wiki}.md` + `skills/docmost/SKILL.md` (openclaw) + `README.md`; **MCP tools added** (`list_labels`/`add_page_labels`/`set_page_summary`/`dedup_analyze`/`organize_create|report|close`, 9 MCP tests, build+lint green). ✅ filtered OpenAPI doc (`skills/docmost.openapi.json`, 20 ops). Optional left: per-skill openclaw split (A3 headline + h as recipe)
- ✅ D6 manual upload UI: `BulkUpload` + `BulkUploadModal` (drag-drop -> import-files -> organize task + live panel + share link), mounted as "Bulk upload & organize" in the space sidebar menu (next to Import, gated by canManagePages); client typecheck green. Optional later: review queue (A3 b-1)

## 9. Documentation
- ✅ T8.1 **User manual** (使用說明書): [docs/USER-MANUAL.md](../USER-MANUAL.md) — A3 a–h, API keys, REST + MCP usage, skill bundle/recipes, bulk upload UI, status page, and a live smoke-test checklist

## Execution order
3 ✅ → 1 ✅ → 2 ✅ → **4 (AI B1)** → 6 (entitlement) → 5 (AI B2) → 2.1/2.2 (MCP extras) → 7 (gateway) → D1→D2→D3→D4→D5→D6 → 8 (manual).
Workstream D depends only on C0 ✅ (API-key) + bulk-import ✅; it is **independent of the server AI module (B)** because the agent brings its own LLM.
