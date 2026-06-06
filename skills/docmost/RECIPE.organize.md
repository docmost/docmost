# Recipe: Ingest & Organize files into Docmost

> For external agents (Hermes / openclaw / opencode). **You** are the brain — Docmost only stores
> and relays. You upload the files, then use **your own LLM** to summarize, tag, classify, and
> decide duplicates, writing each result back through the skills in
> [`../docmost.skills.json`](../docmost.skills.json). You also narrate progress so the Docmost UI
> shows the work live.

## Inputs
- `files`: the text files (`.md` / `.html`) to ingest.
- `spaceId`: a landing space (an **Inbox** space is recommended; you classify/move out afterwards).

## Steps

1. **Upload** — `wiki.files.upload(spaceId, files)` → `fileTaskId`. Poll
   `wiki.files.taskStatus(fileTaskId)` until `status == "success"`. Collect the created `pageIds`
   (look them up via `wiki.search` or the space's pages if the task response omits them).

2. **Open a tracking task** — `wiki.organize.open({ spaceId, source:"upload", fileTaskId, total:N })`
   → keep `id` (the `organizeTaskId`) and **give `statusUrl` to the user** (requirement f).

3. **Fetch context once** (so tagging/classification stay consistent):
   - `wiki.spaces.list` → candidate target folders.
   - `wiki.labels.list` → existing tag vocabulary (reuse these names; avoid synonyms).
   - `wiki.dedup.analyze({ spaceId })` → duplicate clusters.

4. **For each page** (`pageId`):
   1. `wiki.page.get({ pageId, includeContent:true })` → the text.
   2. **Dedup (e):** if this page is a non-keep member of a cluster from step 3 →
      `wiki.dedup.resolve({ keepPageId, dropPageIds:[pageId] })`, then
      `wiki.organize.report({ step:"dedup", status:"done", pageId, detail:{ duplicateOf: keepPageId } })`
      and **skip the rest** for this page.
   3. **Summarize (c):** run your LLM → `wiki.page.setSummary({ pageId, summary })` →
      `wiki.organize.report({ step:"summarize", status:"done", pageId })`.
   4. **Tag (b):** your LLM picks 3-8 tag names (preferring the existing vocabulary) →
      `wiki.page.addLabels({ pageId, names })` →
      `wiki.organize.report({ step:"tag", status:"done", pageId, detail:{ names } })`.
   5. **Classify (b):** your LLM picks the best target space (and optional parent) from
      `wiki.spaces.list`. If confident → `wiki.page.move(...)` / `pages/move-to-space`; else leave
      it in the inbox and add a `needs-review` label. Report `step:"classify"` /`"move"`.
   6. **Mark item done:** `wiki.organize.report({ step:"done", status:"done", pageId, countsAsProgress:true })`.

5. **Close** — `wiki.organize.close({ organizeTaskId, status:"succeeded", completed:N })`.

## Rules
- **Report after every sub-step** (step 4.x). That feed is what the Docmost frontend streams as a
  live "Organizing…" view (requirement g).
- Docmost performs **no** AI — if you skip a step (e.g. no summary), just report it as
  `status:"skipped"`; the page still imported fine.
- All writes are permission-checked. If a `move`/`addLabels` is rejected, report
  `status:"failed"` with the error in `detail` and continue with the next page.
- Idempotency: re-running is safe — labels upsert by name, summary overwrites, dedup re-analyze
  re-clusters. Use the `organizeTaskId` to resume.
```
