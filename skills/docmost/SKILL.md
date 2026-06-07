# Docmost Wiki — openclaw skill descriptor

Drive a self-hosted Docmost wiki. **Docmost is a thin API** (store/retrieve/relay); **you** are
the brain — summarize, classify, tag, decide duplicates, understand code — and write results back.

- Base URL: `<DOCMOST_BASE_URL>/api` · Auth: header `Authorization: Bearer <DOCMOST_API_KEY>`
- All endpoints are `POST` with a JSON body unless noted. Responses are `{ data, success, status }` — read `data`.
- Machine-readable manifest (full param/return shapes): [`../docmost.skills.json`](../docmost.skills.json)
- Playbooks: [`RECIPE.organize.md`](./RECIPE.organize.md) · [`RECIPE.code-to-wiki.md`](./RECIPE.code-to-wiki.md)

## Skills

| Skill | Endpoint | Use |
|---|---|---|
| files.upload | `POST /pages/import-files` (multipart `spaceId`,`files`) | bulk-upload .md/.html → pages (returns a file task) |
| files.taskStatus | `POST /file-tasks/info` `{fileTaskId}` | poll import until `success` |
| page.create | `POST /pages/create` `{spaceId,title?,content?,format?,parentPageId?}` | create a page |
| page.get | `POST /pages/info` `{pageId,includeContent?}` | read content |
| page.update | `POST /pages/update` `{pageId,content?,operation?,format?,title?}` | new version (CRDT) |
| page.setSummary | `POST /pages/update` `{pageId,summary}` | store summary (c) |
| page.move | `POST /pages/move` `{pageId,position,parentPageId?}` | classify within space (b) |
| spaces.list | `POST /spaces/` `{page?,limit?}` | folders to classify into (b) |
| labels.list | `POST /labels` `{type?}` | existing tag vocabulary (b) |
| page.addLabels | `POST /pages/labels/add` `{pageId,names[]}` | tag (upsert-by-name) (b) |
| page.labels | `POST /pages/labels` `{pageId}` | read a page's labels |
| search | `POST /search` `{query,spaceId?,limit?,offset?}` | keyword search (d) |
| dedup.analyze | `POST /dedup/analyze` `{spaceId?}` | cluster exact duplicates (e) |
| dedup.resolve | `POST /dedup/resolve` `{keepPageId,dropPageIds[],mode?}` | soft-delete dups (e) |
| organize.open | `POST /organize-tasks/create` `{spaceId?,source?,title?,total?,fileTaskId?}` | open task → `statusUrl` (f) |
| organize.status | `POST /organize-tasks/info` `{organizeTaskId}` | poll task + events |
| organize.report | `POST /organize-tasks/events` `{organizeTaskId,step,status?,pageId?,title?,detail?,countsAsProgress?}` | narrate progress (g) |
| organize.close | `POST /organize-tasks/update` `{organizeTaskId,status,completed?}` | finalize (f) |

## Permissions
Calls run as the API key owner. Reads need space view; writes (`create/update/move/addLabels/
setSummary/dedup.resolve/organize.create`) need space **Edit**. Errors come back as
`{ message }` with an HTTP status.

## Typical flow
Run [`RECIPE.organize.md`](./RECIPE.organize.md): upload → open task (share `statusUrl`) →
per page: get → dedup → summarize → tag → classify, **reporting each step** → close.
