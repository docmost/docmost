# Recipe: Generate a wiki from a code repository (code -> wiki)

> A DeepWiki-style flow under the **thin-server / smart-agent** split. **You** clone/read the
> code, build the wiki structure, and generate each page with your own LLM (+ your own RAG if you
> have it). Docmost only **stores** the pages and **relays** your progress — it does no code
> analysis. Prior art that uses this same catalog-first, page-by-page shape: OpenDeepWiki,
> deepwiki-open, git-wiki-builder.

## Inputs
- A repository (your local clone / an uploaded zip).
- `spaceId`: the space to build the wiki in.

## Steps

1. **Analyze** — walk the tree, group files by module/directory, detect languages. Optionally
   build embeddings over the code for per-page retrieval (RAG).

2. **Catalog = the task list** — your LLM produces an **ordered outline** of wiki pages with a
   parent/child structure, e.g.:
   - `Home` (overview) → `Architecture`, `Modules/<name>` (one per module), `API`, `Usage`.
   Each catalog entry is **one generation task**.

3. **Open a tracking task** — `wiki.organize.open({ spaceId, source:"code", title:<repo>, total:<#catalog entries> })`.
   Hand `statusUrl` to the user.

4. **Generate page-by-page** — for each catalog task, **in order**:
   1. RAG-retrieve the relevant code for this unit.
   2. Your LLM writes the page (purpose, public API/exports, key types/functions, a usage
      example, a source-path callout, optional Mermaid diagram) as markdown.
   3. **Persist immediately** — `wiki.page.create({ spaceId, title, content, format:"markdown",
      parentPageId:<parent's pageId> })`. Create parents before children so nesting resolves.
   4. `wiki.organize.report({ step:"generate", status:"done", pageId, title, countsAsProgress:true })`.
      Reporting after each page is what makes the wiki appear to **grow live** in the Docmost UI
      (requirement g, "dynamically written in").
   - For large repos, batch the tasks and checkpoint progress via the organize task so you can
     resume.

5. **Index & cross-link** — update the `Home` page with links to every generated page
   (`wiki.page.update`).

6. **Organize** — run [`RECIPE.organize.md`](./RECIPE.organize.md) over the generated pages to add
   summaries, labels, and dedup.

7. **Close** — `wiki.organize.close({ organizeTaskId, status:"succeeded" })`.

## Notes
- Docmost needs **nothing code-specific**: `wiki.files.upload` (for a pre-built markdown tree) or
  `wiki.page.create` per page both work. Sending a markdown tree with relative paths as filenames
  via `wiki.files.upload` lets the generic importer build the hierarchy for you in one call.
- Keep generation deterministic per task so a re-run reproduces the same structure (idempotent
  titles → updates instead of duplicates; dedup catches accidental repeats).
```
