# Pitch: Native “external data table” block (render shared DB views as native tables)

> Proposal + working proof-of-concept for a Docmost editor block that turns a **shared database view link**
> (Baserow, NocoDB, … extensible) into a **native table** inside a page — instead of an iframe embed.

## Problem
Embedding a database table today means an **iframe** (e.g. a Baserow/NocoDB public view): it has its own scrollbar,
a visible load delay, and isn’t real page content (not selectable, not styled like Docmost tables). Users repeatedly
ask for tighter database integration:
- #668 — “NocoDB spreadsheet support” (embed a DB spreadsheet into a page)
- #464 / #1379 — plugin/extension system requests (so such integrations don’t bloat core)

What people actually want: **paste a shared-view link → get a native, always-fresh table**, multiple per page.

## Proposal
A new atom block node **`databaseTable`** (sibling of the existing `embed` node) that:
1. Stores a **public view URL** + a `source` (provider) attribute.
2. Renders via a React NodeView that **fetches the view’s data client-side** and draws a **native Tiptap/Mantine table**
   (loading/error states, manual refresh). Always current (fetched on render) — no webhook/sync needed.
3. Has a **paste rule**: pasting a recognized public-view link auto-converts it into the block; plus a slash-menu entry.

Provider detection mirrors the existing `embed-provider.ts` pattern (a small registry), so it generalizes:
- **Baserow**: `…/public/grid/<slug>` → `…/api/database/views/<slug>/public/info/` + `…/public/rows/`
- **NocoDB**: `…/nc/view/<uuid>` → `…/api/v2/public/shared-view/<uuid>/meta` + `…/rows`
- easily extensible (Airtable shared grids, Grist, generic JSON/CSV endpoint, …).

## Why native (vs. iframe)
| | iframe embed | `databaseTable` (native) |
|---|---|---|
| Look | external app chrome, scrollbar | native table, fits the doc |
| Load | full app | just the data |
| Multiple per page | heavy | trivial |
| Freshness | live | live (fetched on render) |
| Selectable/searchable content | no | table is real DOM (search/export can be added) |

## Working proof-of-concept (already implemented & tested)
Built against `v0.80.2`, **~371 additive lines**, no new dependencies:
- `packages/editor-ext/src/lib/database-table.ts` — the node (attrs `src`/`source`, `detectSource`, paste rule, command).
- `apps/client/.../components/database-table/database-table-view.tsx` — React NodeView (fetch + native table).
- registration in client `extensions.ts` + `slash-menu/menu-items.ts`, and server `collaboration.util.ts` (schema).
- CORS verified `*` on both Baserow and NocoDB public APIs → direct browser fetch, **no server proxy required**.
- Verified: server accepts/stores the node; client bundle ships the block; renders Baserow + NocoDB views as native tables.

(Patch available: `databaseTable-block.patch`.)

## Open questions for maintainers (how you’d want it upstream)
1. **As core block** (provider-registry like `embed-provider`) or **as the first showcase of a plugin API** (#464/#1379)?
   We’d happily build it as a plugin if the extension API lands.
2. **Server proxy option** for providers without permissive CORS (optional; not needed for Baserow/NocoDB).
3. **Search/export**: should the last-fetched snapshot also be persisted as text (for full-text search / markdown export)?
4. Scope of providers to ship by default.

## Offer
We have a working implementation and are happy to turn it into a proper PR following the contribution guidelines
(generic provider-based design, i18n, tests). Guidance on the preferred direction (core vs. plugin) would be great.

---
*Context: built for a self-hosted KB eval (Docmost as the wiki + Baserow/NocoDB as the data layer). Related issues:
[#668](https://github.com/docmost/docmost/issues/668), [#464](https://github.com/docmost/docmost/issues/464),
[#1379](https://github.com/docmost/docmost/issues/1379).*
