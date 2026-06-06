# Docmost Bulk File Import — Workflow & API

> Status: **IMPLEMENTED** (this round). Adds a batch/multi-file upload endpoint that
> imports many files into a space as wiki pages, reusing the existing asynchronous
> generic-import pipeline.

---

## 1. Goal

Let a user (or agent) upload **many files at once** (markdown / html, optionally in
sub-folders, with referenced attachments) and import them into a space as pages — with
**hierarchy, attachments, internal links and ordering** preserved, processed **asynchronously**
with a pollable progress task.

## 2. Design — reuse the proven pipeline

Docmost already has a robust async importer for a **zip** archive:
`ImportService.importZip` → stores the file + a `file_tasks` row → enqueues `IMPORT_TASK`
→ `FileImportTaskService.processZIpImport` extracts and runs `processGenericImport`
(builds the page tree from folder structure, resolves attachments, internal links,
positions, backlinks). Source: `apps/server/src/integrations/import/services/{import.service.ts,file-import-task.service.ts}`.

**Bulk import does not re-implement any of that.** It accepts N uploaded files, **packs them
into a single in-memory zip server-side**, and feeds that zip into the exact same
`source = generic` pipeline. A flat batch of `.md`/`.html` becomes sibling root pages;
files sent with relative sub-paths become a nested page tree; non-page files travel along as
attachment candidates.

```
client (N files + spaceId)
      │  multipart  POST /api/pages/import-files
      ▼
ImportController.importFiles ── CASL: space Edit/Page
      │
      ▼
ImportService.importBulkFiles
      │  buildBulkImportZip(files)  → one .zip (Buffer)
      │  StorageService.upload(...)
      │  insert file_tasks (type=import, source=generic, status=processing)
      │  queue IMPORT_TASK
      ▼
FileTaskProcessor → FileImportTaskService.processZIpImport → processGenericImport
      │  extract → build hierarchy → attachments → links → insert pages (tx)
      ▼  status → success | failed
client polls  POST /api/file-tasks/info { fileTaskId }
```

## 3. API

### Upload a batch
`POST /api/pages/import-files`  (auth: JWT or API key; multipart/form-data)

| field | type | notes |
|---|---|---|
| `spaceId` | text | required; caller needs space **Edit/Page** permission |
| files | file × N | repeated file parts; `.md` / `.html` become pages, other files are attachment candidates. To create a tree, send file names with relative paths (e.g. `guide/setup.md`) |

Limits: up to **200 files**; per-file size capped by `FILE_IMPORT_SIZE_LIMIT`. At least one
`.md`/`.html` is required.

**Response** (`200`): the created `file_task` (id, status=`processing`, …). Import runs in the
background.

```bash
curl -X POST https://wiki.example.com/api/pages/import-files \
  -H "Authorization: Bearer <API_KEY>" \
  -F "spaceId=<SPACE_UUID>" \
  -F "files=@intro.md" \
  -F "files=@guide/setup.md" \
  -F "files=@guide/diagram.png"
```

### Poll progress (existing endpoints)
- `POST /api/file-tasks/info` `{ fileTaskId }` → task with `status` (`processing|success|failed`) and `errorMessage`.
- `POST /api/file-tasks` → paginated list of the workspace's file tasks.

Source: `apps/server/src/integrations/import/file-task.controller.ts`.

## 4. Implementation

- **New** `apps/server/src/integrations/import/utils/bulk-import.util.ts`
  - `sanitizeZipEntryPath(name)` — normalizes `\`→`/`, drops `.`/`..`/empty segments (path-traversal safe), preserves folders.
  - `buildBulkImportZip(files)` — packs files into a `nodebuffer` zip; de-duplicates colliding paths (`page.md`, `page-1.md`).
- **New** `ImportService.importBulkFiles({ files, userId, spaceId, workspaceId })` — builds the
  zip, uploads it, inserts a `file_tasks` row (`type=import`, `source=generic`), enqueues
  `IMPORT_TASK`, returns the task. (`apps/server/src/integrations/import/services/import.service.ts`)
- **New** `ImportController.importFiles` — streams multipart `parts()`, buffers files + reads
  `spaceId`, enforces size/count limits + CASL, audits `PAGE_IMPORTED`. (`apps/server/src/integrations/import/import.controller.ts`)

No new tables, queue jobs, or processors — it rides the existing `file_tasks` + `IMPORT_TASK`
infrastructure.

## 5. Verification

- **Unit** (`bulk-import.util.spec.ts`, 6 tests): path sanitization (traversal/backslash),
  zip packing preserves folders + content, duplicate de-dup, traversal-name sanitization.
  Runs offline.
- **Build** (`nest build`) + **ESLint**: green.
- **Live smoke** (next tier): upload several `.md` files with `spaceId` → poll
  `/api/file-tasks/info` until `success` → verify pages appear in the space (and a nested set
  via `guide/*.md` builds the tree).

## 6. Notes / future
- Browsers send only the base filename for multi-file `<input>`; to import a **tree**, the
  client should send relative paths as the part filename (the `webkitRelativePath` from a
  directory picker) — already honored by `sanitizeZipEntryPath`.
- `.docx`/`.pdf` remain EE-only (handled by `processDocx`/`processPdf`); bulk currently scopes
  pages to `.md`/`.html`.
- Agent/MCP: a future `import_files` MCP tool or gateway `POST /v1/spaces/{id}/import-files`
  can wrap this endpoint.
