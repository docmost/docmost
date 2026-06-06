# Docmost OSS AI Features — 規格書 (Workstream B)

> Status: **DESIGN / for review**. No code yet. This spec defines an open-source, in-server
> implementation of Docmost's **Ask AI** (generative editor actions) and **AI Answers**
> (semantic / RAG search) so the **already-present client UI** works without an EE license.
>
> Companion spec: [`docmost-agent-api-spec.md`](./docmost-agent-api-spec.md) (Workstream A).

---

## 1. Goal & constraints

**Goal.** Make the existing AI UI functional on a self-hosted OSS build:
- **Ask AI** — toolbar/inline actions on selected editor text (improve, fix, summarize, …).
- **AI Answers** — natural-language Q&A over workspace pages in the search dialog (RAG).

**Constraints.**
- **Do not touch or copy `packages/ee` / `apps/server/src/ee`.** Write an OSS-equivalent
  server module in a non-`ee` path.
- The **client is already implemented and shipped** in OSS (`apps/client/src/ee/ai/**`); it
  calls fixed server routes. We implement the **missing server side** to match that contract.
- AGPL: this is necessarily in-server → network-copyleft applies (fine for a self-hosted
  modified deploy).

## 2. What already exists vs. what's missing

**Already in OSS core (reusable):**
- AI env config getters: `getAiDriver`, `getAiEmbeddingModel`, `getAiCompletionModel`,
  `getAiChatModel`, `getAiEmbeddingDimension`, `getAiEmbeddingSupportsMrl`, `getOpenAiApiKey`,
  `getOpenAiApiUrl`, `getGeminiApiKey`, `getOllamaApiUrl`
  (`apps/server/src/integrations/environment/environment.service.ts:281-330`) + validation
  (`environment.validation.ts`, `AI_DRIVER∈{openai,openai-compatible,gemini,ollama}`).
- Deps already in `apps/server/package.json`: `ai` (Vercel AI SDK), `@ai-sdk/openai`,
  `@ai-sdk/openai-compatible`, `@ai-sdk/google`, `ai-sdk-ollama`, `@langchain/textsplitters`,
  `@langchain/core`.
- DB: `ai_chats`, `ai_chat_messages` (+ `attachments.ai_chat_id`) —
  `apps/server/src/database/migrations/20260409T132415-ai-chat.ts`.
- Embeddings type contract: `apps/server/src/database/types/embeddings.types.ts`
  (`page_embeddings`: `pageId, spaceId, workspaceId, attachmentId, modelName,
  modelDimensions, embedding number[], chunkIndex, chunkStart, chunkLength, metadata`).
- Queue jobs (constants exist, processors don't):
  `WORKSPACE_CREATE_EMBEDDINGS`, `WORKSPACE_DELETE_EMBEDDINGS`, `GENERATE_PAGE_EMBEDDINGS`,
  `DELETE_PAGE_EMBEDDINGS` on `QueueName.AI_QUEUE`
  (`apps/server/src/integrations/queue/constants/queue.constants.ts`).
- Workspace settings + DTO: `aiSearch`, `generativeAi`, `aiChat`, `mcpEnabled`
  (`apps/server/src/core/workspace/dto/update-workspace.dto.ts`), persisted under
  `workspaces.settings.ai.*`; pgvector pre-check in
  `apps/server/src/core/workspace/services/workspace.service.ts`.
- Feature flag `Feature.AI = 'ai'` (`apps/server/src/common/features.ts`,
  `apps/client/src/ee/features.ts`).
- **Full client UI:** `apps/client/src/ee/ai/**` (editor AI menu, AI search result, settings).

**Missing (what we build):** the server module behind `/api/ai/*` — providers, prompt
templates, streaming endpoints, the embeddings pipeline (incl. pgvector), and queue
processors. `apps/server/src/ee/` is empty and `app.module` dynamically `require()`s a
non-existent `./ee/ee.module`.

## 3. Client contract to satisfy (source of truth)

These are the exact calls the existing client makes — our server must match them.

### 3.1 Ask AI
- Sync: `POST /ai/generate` → `{ content, usage?: {promptTokens,completionTokens,totalTokens} }`
  (`apps/client/src/ee/ai/services/ai-service.ts:9-14`).
- Stream: `POST /api/ai/generate/stream` → **SSE**, lines `data: {"content":"…"}`, errors
  `data: {"error":"…"}`, terminator `data: [DONE]`
  (`ai-service.ts:16-92`).
- Request body `AiGenerateDto` = `{ action?: AiAction, content: string, prompt?: string }`
  (`apps/client/src/ee/ai/types/ai.types.ts:15-19`).
- `AiAction` enum (`ai.types.ts:1-13`) and UI command set (`…/ai-menu/command-items.ts`):
  `improve_writing, fix_spelling_grammar, make_shorter, make_longer, simplify,
  change_tone (prompt = Professional|Casual|Friendly), summarize, explain, continue_writing,
  translate (prompt = target language, 11 langs), custom (prompt = free text)`.
- Optional helper implied by `AiConfigResponse {configured, availableActions}`
  (`ai.types.ts:30-33`): a `GET /ai/config` so the UI can hide actions when unconfigured —
  **recommended to implement** (not strictly required by current calls).

### 3.2 AI Answers
- Stream: `POST /api/ai/answers` → **SSE**, interleaved `data: {"content":"…"}` then
  `data: {"sources":[…]}`, terminator `data: [DONE]`
  (`apps/client/src/ee/ai/services/ai-search-service.ts:18-83`).
- Request body `IPageSearchParams` = `{ query: string, spaceId?: string, shareId?: string }`
  (`apps/client/src/features/search/types/search.types.ts:35`).
- `sources[]` item shape (must match exactly):
  `{ pageId, title, slugId, spaceSlug, similarity, distance, chunkIndex, excerpt }`
  (`ai-search-service.ts:4-16`).

> Note the global prefix: client paths `/ai/*` go through axios `baseURL=/api`, so the server
> routes live at `/api/ai/*` (consistent with the streaming `fetch("/api/ai/...")` calls).

## 4. Server module design

### 4.1 Placement & wiring
- New module `apps/server/src/ai/ai.module.ts`, imported **directly** by
  `apps/server/src/app.module.ts` (NOT under `ee/`). Small, well-isolated edit.
- Reuses `EnvironmentService`, `PageRepo`, `PageAccessService`/CASL, `SpaceRepo`,
  `AI_QUEUE` registration, and the existing AI tables.

### 4.2 Provider layer
- `AiProviderService` wraps the Vercel AI SDK and returns a model handle based on `AI_DRIVER`:
  - `openai` / `openai-compatible` → `@ai-sdk/openai` / `@ai-sdk/openai-compatible`
    (`OPENAI_API_KEY`, `OPENAI_API_URL`).
  - `gemini` → `@ai-sdk/google`; `ollama` → `ai-sdk-ollama`.
- Exposes `completionModel()`, `chatModel()`, `embeddingModel()` from the configured names.

### 4.3 Ask AI endpoints
- `POST /api/ai/generate/stream` (SSE) and `POST /api/ai/generate` (sync).
- Per-`action` **prompt templates** (system + user) — e.g. *improve_writing*, *summarize*,
  *change_tone* (uses `prompt` as the tone), *translate* (uses `prompt` as target language),
  *custom* (uses `prompt` verbatim). Input text = `content`.
- Use AI SDK `streamText` → forward tokens as `data: {"content":"…"}`; end with `data: [DONE]`;
  errors as `data: {"error":"…"}`. Sync variant uses `generateText` and returns `{content,usage}`.
- **Permission:** require workspace `settings.ai.generative === true`; selection-based actions
  imply page-edit rights — reuse `PageAccessService` where a `pageId`/context is available.
- Gate behind `Feature.AI` (see §6) + `JwtAuthGuard`.

### 4.4 AI Answers endpoint (RAG)
- `POST /api/ai/answers` (SSE).
- Pipeline: embed `query` → **vector ANN search** over `page_embeddings` scoped to the
  caller's accessible spaces/pages (CASL) and `spaceId` filter → assemble top-k chunks into a
  grounded prompt → `streamText` the answer → after streaming, emit one
  `data: {"sources":[…]}` event built from the retrieved chunks (dedup highest similarity per
  page), then `data: [DONE]`.
- `similarity` = cosine similarity, `distance` = the pgvector operator distance; both included
  to match the client contract.

## 5. Embeddings pipeline (for AI Answers)

### 5.1 Storage — pgvector
- New migration: `CREATE EXTENSION IF NOT EXISTS vector;` then create `page_embeddings`
  matching `embeddings.types.ts`, with `embedding vector(<AI_EMBEDDING_DIMENSION>)` and an
  **HNSW** index (`vector_cosine_ops`). (Today `workspace.service.ts` only *checks* for the
  table; OSS will actually create it.)
- Dimension comes from `AI_EMBEDDING_DIMENSION` (validated set: 768/1024/1536/2000/3072).
  Document the constraint that changing dimension requires re-embedding.

### 5.2 Ingestion (queue processors on `AI_QUEUE`)
- `GENERATE_PAGE_EMBEDDINGS`: load page ProseMirror→text (`jsonToText`), chunk via
  `@langchain/textsplitters` (RecursiveCharacterTextSplitter), `embedMany` with the embedding
  model, upsert rows (with `chunkIndex/chunkStart/chunkLength`, `modelName`,
  `modelDimensions`). Delete stale chunks for the page first.
- `DELETE_PAGE_EMBEDDINGS`: remove rows for a page.
- `WORKSPACE_CREATE_EMBEDDINGS` / `WORKSPACE_DELETE_EMBEDDINGS`: backfill / teardown for a
  whole workspace when the `aiSearch` toggle flips (already enqueued by
  `workspace.service.ts`; we add the processors).
- **Trigger on edit:** enqueue `GENERATE_PAGE_EMBEDDINGS` after page persistence — hook
  `apps/server/src/collaboration/extensions/persistence.extension.ts` `onStoreDocument`
  (debounced) or a page-updated event. Debounce to avoid thrash (persistence already debounces
  10–45s).

## 6. The feature-gate wrinkle (must be resolved)

The client shows AI UI only when **both**:
1. `useHasFeature(Feature.AI)` — driven by **entitlements** (license), and
2. workspace `settings.ai.{generative,search,chat}` toggles are on.

For OSS without a license, (1) is the blocker. **Design task / spike:** locate the
entitlement source (client `apps/client/src/ee/entitlement/*`, server license/entitlement
provider) and choose the minimal OSS approach:
- **Option 1 (server):** have the OSS build inject `'ai'` into the workspace entitlements/
  features list for self-hosted, so `useHasFeature(Feature.AI)` is true.
- **Option 2 (client):** treat `Feature.AI` as always-available on self-hosted in the
  `useHasFeature` hook.
Prefer the server-side option (single source of truth). The admin toggles
(`update-workspace.dto`: `aiSearch`, `generativeAi`, `aiChat`) then control actual behavior.
Document exactly which file(s) change once the spike confirms the entitlement path.

## 7. Phasing (later rounds)

- **B1 — Ask AI** (no pgvector): provider layer + `generate`/`generate/stream` + prompt
  templates + `GET /ai/config` + feature-gate unlock. Smallest, highest value, fully testable
  with an OpenAI-compatible endpoint.
- **B2 — AI Answers** (RAG): pgvector migration + ingestion processors + `answers` endpoint +
  edit-trigger + workspace backfill.
- **B3 — AI Chat** (optional): `/api/ai/chats/*` over existing `ai_chats`/`ai_chat_messages`
  (+ tool calls / MCP). Marked beta; out of scope until B1/B2 land.

## 8. Test strategy

- **Provider/prompt unit tests:** mock the AI SDK model; assert each `AiAction` builds the
  expected prompt and the SSE framing matches the client parser (`data: {json}\n` +
  `data: [DONE]`).
- **Ask AI integration:** point `AI_DRIVER=openai-compatible` at a local/OpenAI-compatible
  endpoint; in the editor, select text → Improve writing → see streamed replacement; `curl`
  the SSE endpoint and diff the event stream.
- **Embeddings unit tests:** chunking determinism; upsert/delete; ANN query returns expected
  ordering on a seeded fixture.
- **AI Answers integration:** install pgvector; enable `aiSearch` (triggers backfill); after
  ingestion, ask a question in search → grounded answer + `sources[]` linking the right pages;
  verify access scoping (a reader cannot retrieve chunks from spaces they can't see).
- **Regression:** OSS build with `AI_DRIVER` unset must boot and behave as today (AI UI hidden
  / `configured:false`), and `app.module` must not crash on the missing `ee` module.

## 9. Source references (verified in this repo)

- Client contract: `apps/client/src/ee/ai/services/ai-service.ts`,
  `…/ai/services/ai-search-service.ts`, `…/ai/types/ai.types.ts`,
  `…/ai/components/editor/ai-menu/command-items.ts`,
  `apps/client/src/features/search/types/search.types.ts:35`.
- Server config: `apps/server/src/integrations/environment/environment.service.ts:281-330`,
  `…/environment/environment.validation.ts`.
- DB & queue: `…/database/migrations/20260409T132415-ai-chat.ts`,
  `…/database/types/embeddings.types.ts`,
  `…/integrations/queue/constants/queue.constants.ts`.
- Workspace & flags: `…/core/workspace/services/workspace.service.ts`,
  `…/core/workspace/dto/update-workspace.dto.ts`, `…/common/features.ts`,
  `apps/client/src/ee/features.ts`.
- Wiring/persistence hooks: `apps/server/src/app.module.ts`,
  `…/collaboration/extensions/persistence.extension.ts`.
