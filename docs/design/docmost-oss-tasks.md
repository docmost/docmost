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
- ⬜ T2.2 client config docs (Claude Code / Desktop / Cursor)

## 3. Bulk file import
- ✅ `buildBulkImportZip` util + `ImportService.importBulkFiles` + `POST /pages/import-files`
- ✅ unit tests (6); build+lint; design doc

## 4. AI — Ask AI (generative editor actions) — "B1"
- ✅ T4.1 `AiProviderService` over Vercel AI SDK (openai / openai-compatible / gemini / ollama) by `AI_DRIVER`
- ✅ T4.2 prompt templates per `AiAction` (improve/fix/longer/shorter/simplify/continue/explain/summarize/change_tone/translate/custom)
- ✅ T4.3 `AiService` + `AiController`: `POST /api/ai/generate` (sync), `POST /api/ai/generate/stream` (SSE), `GET /api/ai/config`
- ✅ T4.4 permission gate (`settings.ai.generative`), wired `AiModule`, prompt unit tests (6), build+lint

## 5. AI — AI Answers (semantic/RAG search) — "B2"
- ⬜ T5.1 pgvector migration: `CREATE EXTENSION vector` + `page_embeddings(vector(dim))` + HNSW index
- ⬜ T5.2 ingestion: chunk (`@langchain/textsplitters`) → `embedMany` → upsert; queue processors for GENERATE/DELETE_PAGE_EMBEDDINGS + WORKSPACE_CREATE/DELETE_EMBEDDINGS
- ⬜ T5.3 enqueue re-embed on page save; workspace backfill on `aiSearch` toggle
- ⬜ T5.4 `POST /api/ai/answers` (SSE): embed query → ANN search scoped by CASL → stream answer + sources[]
- ⬜ T5.5 tests (chunking + query), build+lint

## 6. Feature-gate / entitlement unlock (makes MCP + AI UI toggles usable)
- ⬜ T6.1 grant `Feature.AI` + `Feature.MCP` for self-hosted OSS via an allowlist in
  `apps/client/src/ee/hooks/use-feature.ts` (`useHasFeature` returns true for OSS-implemented
  features even without a license entitlement). Do **after B2** so the AI Search toggle has a
  working backend. AI Chat remains documented as unsupported.
- ⬜ T6.2 verify admin Settings shows AI/MCP toggles; client typecheck/build

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
- 🟡 D5 Agent Skill bundle: ✅ **lean core done** — `skills/docmost.skills.json` (18 skills → verified endpoints) + `skills/docmost/RECIPE.{organize,code-to-wiki}.md` + `skills/README.md` (per-agent install). Left (optional): filtered OpenAPI doc + per-skill openclaw descriptors + MCP organize/dedup/label tools (A3 headline + h as recipe)
- ✅ D6 manual upload UI: `BulkUpload` + `BulkUploadModal` (drag-drop -> import-files -> organize task + live panel + share link), mounted as "Bulk upload & organize" in the space sidebar menu (next to Import, gated by canManagePages); client typecheck green. Optional later: review queue (A3 b-1)

## 9. Documentation
- ⬜ T8.1 **User manual** (使用說明書): API keys, REST API usage, MCP setup, bulk import, AI features, agent skills — after features land

## Execution order
3 ✅ → 1 ✅ → 2 ✅ → **4 (AI B1)** → 6 (entitlement) → 5 (AI B2) → 2.1/2.2 (MCP extras) → 7 (gateway) → D1→D2→D3→D4→D5→D6 → 8 (manual).
Workstream D depends only on C0 ✅ (API-key) + bulk-import ✅; it is **independent of the server AI module (B)** because the agent brings its own LLM.
