# Base `page` Property Type — Design Spec

**Date:** 2026-04-20
**Status:** Draft
**Feature area:** `apps/server/src/core/base`, `apps/client/src/features/base`, `apps/server/src/core/page`

## Goal

Add a new base property type `page` that lets a user search for and link **one existing page** per cell. Modeled on how the editor's `@` page-mention works — the picker searches existing pages workspace-wide (with current-space prioritized) and the cell renders a live pill with the page's icon and title. No page is auto-created from the picker; users can only link pages that already exist.

Why: today users who want a page-reference column would have to paste a URL into a `url` cell, which loses the icon + title and doesn't validate. We also want to avoid the Focalboard-style pattern of auto-creating a page-row per table row, which would bloat the pages tree.

## Non-goals (v1)

- **Multiple pages per cell.** Single page only. Forward-compatible: the schema widens trivially to `z.union([z.uuid(), z.array(z.uuid())])` + an `allowMultiple` type option later, with zero data migration (see "Future extension" below).
- **Sorting by page title.** Would require a JOIN against `pages` in the row-list query; skip in v1. Filter suffices.
- **Creating pages from within the picker.**
- **Cross-workspace page linking.**
- **Rich previews / hover cards** showing page excerpts — pill-only.
- **Confluence-style section grouping** in the property type picker (e.g. the "Page and live doc" section in the screenshot). Flat list for v1; grouping is a separate polish task.

## UX overview

### Picker (edit mode)

- Popover modeled on [cell-person.tsx](../../../apps/client/src/features/base/components/cells/cell-person.tsx) but stripped for single-select. `width=300`, `position="bottom-start"`, `trapFocus`.
- Top: search input, auto-focused. If a page is currently linked, a removable "tag" for it sits above the search (same shape as `personTag`).
- Body: results list (max 25), fed by `searchSuggestions({ query, includePages: true, spaceId: base.spaceId, limit: 25 })` — reuses the existing suggestion endpoint, which prioritizes `spaceId` results.
- Each row: `{icon or IconFileDescription} {title}` + muted space name on the right (so cross-space picks are visually distinct).
- Empty-query state: if pulling recent-pages is easy to plug in, show recent pages; otherwise "Type to search…" hint.
- Click or Enter on a highlighted row → `onCommit(pageId)`, popover closes.
- Esc / click-outside → `onCancel`.
- Clicking the "Remove" affordance on the current tag → `onCommit(null)`.
- Keyboard: reuse `useListKeyboardNav`.

### View mode

- Empty cell → empty placeholder (same class as `cellClasses.emptyValue`).
- Resolved page → pill `{icon or IconFileDescription} {title}`, anchor that navigates to `buildPageUrl(space.slug, slugId, title)` using the helper that [mention-view.tsx](../../../apps/client/src/features/editor/components/mention/mention-view.tsx) already uses.
- Unresolved (deleted or viewer has no access) → greyed pill "Page not found", no link, `aria-disabled`.
- Single click on the pill = navigate. Double-click on the cell = open picker (same rule grid-cell applies to other types).

### Sort / filter UI

- [view-sort-config.tsx](../../../apps/client/src/features/base/components/views/view-sort-config.tsx): exclude `page` properties from the sortable set.
- [view-filter-config.tsx](../../../apps/client/src/features/base/components/views/view-filter-config.tsx): filter editor branch for `page` with operators `isEmpty`, `isNotEmpty`, `any`, `none`. The value picker reuses the same search dropdown from the cell picker.

## Data model

### Cell value

- **Stored shape:** `string` (page UUID) or `null`. Parallels `person` in single mode.
- **Example:** `{ "01998b7e-...": "01998b80-..." }` — property UUID → page UUID.

### Property type options

- **v1:** empty `{}` (reuse `emptyTypeOptionsSchema`).
- **Future:** `{ allowMultiple?: boolean }`.

### Schema additions

**Server — [base.schemas.ts](../../../apps/server/src/core/base/base.schemas.ts):**

```ts
export const BasePropertyType = {
  // ...existing entries...
  PAGE: 'page',
} as const;

// typeOptionsSchemaMap
[BasePropertyType.PAGE]: emptyTypeOptionsSchema,

// cellValueSchemaMap
[BasePropertyType.PAGE]: z.uuid(),
```

**Client — [base.types.ts](../../../apps/client/src/features/base/types/base.types.ts):**

```ts
export type BasePropertyType = ... | 'page';
export type PageTypeOptions = Record<string, never>;
```

### Property kind & engine

**[engine/kinds.ts](../../../apps/server/src/core/base/engine/kinds.ts):**

```ts
export const PropertyKind = {
  // ...existing...
  PAGE: 'page',
} as const;

// propertyKind()
case BasePropertyType.PAGE:
  return PropertyKind.PAGE;
```

**[engine/predicate.ts](../../../apps/server/src/core/base/engine/predicate.ts):** new `pageCondition()` handler — shape follows `selectCondition()` (single UUID stored as text):

- `isEmpty` / `isNotEmpty` → `textCell` is null or empty
- `eq` / `neq` → text equality / inequality (null-safe for `neq`)
- `any` → `textCell IN (...)`
- `none` → `textCell NOT IN (...)` or null

Wired into the `switch (kind)` in `buildCondition`:
```ts
case PropertyKind.PAGE:
  return pageCondition(eb, cond);
```

**[engine/sort.ts](../../../apps/server/src/core/base/engine/sort.ts):** no new branch. `page` falls into the default text-sentinel path (sorts by raw UUID string, which is unhelpful but harmless — the sort UI won't expose this type in v1).

### Type conversion

**[base.schemas.ts `CellConversionContext`](../../../apps/server/src/core/base/base.schemas.ts:191):** add a new field:

```ts
export type CellConversionContext = {
  fromTypeOptions?: unknown;
  userNames?: Map<string, string>;
  attachmentNames?: Map<string, string>;
  pageTitles?: Map<string, string>; // NEW
};
```

**[base-type-conversion.task.ts](../../../apps/server/src/core/base/tasks/base-type-conversion.task.ts):** when `fromType === 'page'`, batch-load titles via the same page repo path used by the new resolver endpoint (see below) and populate `ctx.pageTitles`.

**`attemptCellConversion` branches:**
- `page → text`: resolve `ctx.pageTitles.get(uuid)` → title (or `""` if missing).
- `page → *` (anything else): return `{converted: true, value: null}`.
- `* → page`: return `{converted: true, value: null}` (free text or other IDs can't be coerced to a valid page UUID).

## Server: page resolver endpoint

New endpoint for cell hydration on the client. Reusing `/pages/info` is inappropriate — it returns full page content and is one-at-a-time.

### `POST /bases/pages/resolve`

**Request:**
```ts
{ pageIds: string[] }  // 1 <= length <= 100, enforced server-side; 400 on violation
```

**Response:**
```ts
{
  items: Array<{
    id: string;
    slugId: string;
    title: string | null;
    icon: string | null;
    spaceId: string;
    space: { id: string; slug: string; name: string };
  }>;
}
```

### Behavior

1. Deduplicate input IDs.
2. Select from `pages` where `id IN (...)` AND `deletedAt IS NULL` AND `workspaceId = current`.
3. Filter the result set through `pagePermissionRepo.filterAccessiblePageIds({ pageIds, userId })` — same mechanism used by [search.service.ts:131-139](../../../apps/server/src/core/search/search.service.ts).
4. Join `spaces` to include `space.slug` and `space.name` for navigation.
5. Silently omit any ID the user can't see (deleted, restricted, cross-workspace). The client treats any requested ID missing from `items` as "Page not found".

### Code layout

- **Controller:** add method to [base.controller.ts](../../../apps/server/src/core/base/controllers/base.controller.ts) at path `@Post('pages/resolve')`. Guarded by the same `JwtAuthGuard` + workspace check the rest of `/bases/*` uses.
- **Service:** new file `apps/server/src/core/base/services/base-page-resolver.service.ts` with `resolvePagesForBase(pageIds, workspaceId, userId)`. Keeps the coupling to `PageRepo` + `PagePermissionRepo` isolated to this one file.
- **Module:** wire the new service into [base.module.ts](../../../apps/server/src/core/base/base.module.ts). `PageRepo` + `PagePermissionRepo` are already shared modules.

## Client: cell component & resolver

### Batch resolver hook

New file `apps/client/src/features/base/queries/base-page-resolver-query.ts`:

```ts
export function useResolvedPages(pageIds: string[]): Map<string, ResolvedPage | null>
```

- Deduplicate + sort IDs to form a stable React Query key.
- Fetch `POST /bases/pages/resolve` with `{ pageIds }`.
- Return a `Map` keyed by every requested ID — `null` for any ID absent from the server response.
- `staleTime: 30_000`, `gcTime: 5 * 60_000`.
- Realtime invalidation: listen for existing page-level websocket events (rename, delete) and invalidate the query when a touched ID intersects our key. Exact event names to be surveyed during plan writing.

### Cell component

New file `apps/client/src/features/base/components/cells/cell-page.tsx`:

```ts
type CellPageProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};
```

**Behavior:**
- Parse value: accept `string` only (ignore arrays — they'd be from a future multi mode that we drop until upgraded).
- `useResolvedPages([value])` — yes even for single lookups; the hook dedupes internally so multiple cells sharing the same page ID hit one request.
- View mode: resolved → pill with icon+title, anchor to `buildPageUrl`. Unresolved → greyed "Page not found".
- Edit mode: popover picker (see UX overview). Search via existing `searchSuggestions`.

Wire into [grid-cell.tsx](../../../apps/client/src/features/base/components/grid/grid-cell.tsx):

```ts
const cellComponents = {
  // ...existing...
  page: CellPage,
};
```

### Property type picker

[property-type-picker.tsx](../../../apps/client/src/features/base/components/property/property-type-picker.tsx): append one entry (after `file`):

```ts
{ type: "page", icon: IconFileDescription, labelKey: "Page" },
```

### Filter editor

[view-filter-config.tsx](../../../apps/client/src/features/base/components/views/view-filter-config.tsx): new branch for `page`:
- Operators: `isEmpty`, `isNotEmpty`, `any`, `none`.
- Value picker for `any`/`none`: reuses the same `searchSuggestions`-backed search dropdown from the cell picker — user picks one or more pages as filter operands.

### Sort editor

[view-sort-config.tsx](../../../apps/client/src/features/base/components/views/view-sort-config.tsx): exclude `page` from the list of sortable property types.

## Testing

### Server — unit

- **Schema:** `validateCellValue('page', uuid)` passes; with garbage string / number → fails; with `null` → passes (null = empty).
- **Conversion:**
  - `attemptCellConversion('page', 'text', uuid, { pageTitles: Map<uuid,title> })` → resolved title.
  - Same call with empty `pageTitles` → `""`.
  - `page → number/date/select/…` → `{converted: true, value: null}`.
  - `text → page` with any string input → `{converted: true, value: null}`.
- **Predicate:** for each operator (`isEmpty`, `isNotEmpty`, `eq`, `neq`, `any`, `none`), `pageCondition()` returns the expected Kysely expression shape.

### Server — integration

- **Resolver endpoint `POST /bases/pages/resolve`:**
  - valid IDs in an accessible space → present in `items`
  - deleted pages (trash) → absent
  - pages in a space the user isn't a member of → absent
  - pages in another workspace → absent
  - empty array → 400
  - array length > 100 → 400
- **Row CRUD:** create a property of type `page`, write a cell with a UUID, read back → round-trip shape is `string`.
- **View filter:** create a view config with `{ op: 'any', propertyId, value: [uuidA, uuidB] }`, hit row-list, verify only matching rows returned.

### Client — unit (Vitest + React Testing Library)

- `cell-page.test.tsx`:
  - view mode with resolved page → renders pill with icon + title and an `<a>` to the computed URL
  - view mode with unresolved page (null in resolver map) → renders greyed "Page not found", no `<a>`
  - double-click opens picker
  - Enter on highlighted result commits `pageId`
  - Esc cancels
  - Remove tag button commits `null`
- `base-page-resolver-query.test.ts`:
  - dedupes IDs
  - stable query key across re-renders with same set
  - missing IDs render as `null` in the returned map

### Manual QA checklist

- Link a page in the same space.
- Link a page in another space → pill shows, picker shows muted space-name hint.
- Remove link → cell empties.
- Delete linked page (via trash) → cell flips to "Page not found" on next resolver refetch.
- Viewer loses space access → same "Page not found" fallback.
- Rename linked page → within ≤30s (staleTime) the pill reflects the new title; realtime event should also trigger refetch.
- Filter: `isEmpty`, `isNotEmpty`, `any` (multi-select), `none`.
- Conversion `page → text` populates cells with page titles.
- Conversion `text → page` wipes cells.

## Rollout

- **No DB migration.** All changes are code-only: new enum value, new cell-value validator entry, new engine kind branch, new endpoint.
- **No feature flag.** The type appears in the picker as soon as the build ships. Backwards-compatible since `'page'` is a new type identifier.
- Existing bases continue to work unchanged.

## Risks & open questions

- **30s staleTime.** Renames take up to 30s to propagate without realtime invalidation. The realtime hook should shrink this to near-zero in practice; verify in QA. If it feels slow, drop `staleTime` to `0` and rely solely on realtime + refetch-on-window-focus.
- **"Page not found" label.** i18n-friendly; run through the translation pipeline. Consider whether to differentiate deleted vs. restricted — current answer: no, one label covers both and matches Confluence's behavior.
- **Cross-space name exposure.** The picker surfaces the space name of pages the user can access cross-space. This is already exposed via the existing page-mention flow, so no new exposure, but flag in review.

## Future extension (multiple pages per cell)

When `allowMultiple` lands:

1. Widen cell-value schema: `z.uuid()` → `z.union([z.uuid(), z.array(z.uuid())])`. Existing single-UUID cells continue to validate.
2. Add `allowMultiple` boolean to `pageTypeOptionsSchema` (default `false` for existing properties).
3. In [predicate.ts](../../../apps/server/src/core/base/engine/predicate.ts), branch `pageCondition` on `allowMultiple`: `true` → reuse `arrayOfIdsCondition`; `false` → keep the current text-based path.
4. Client cell normalizes on read (`Array.isArray(value) ? value : typeof value === 'string' ? [value] : []`), mirrors [cell-person.tsx:33](../../../apps/client/src/features/base/components/cells/cell-person.tsx).
5. No data writes required for existing cells.

This spec leaves room for that change without locking the storage shape.
