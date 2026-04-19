# Stop Client from Overriding Server Sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a view has a sort applied, stop the client from re-sorting the fetched rows by `position` (the fractional-index column), which silently overwrites the server's sort order and visibly corrupts the list as more pages are loaded.

**Architecture:** One-line conditional in the `rows` `useMemo` in `base-table.tsx`: if a sort is active, pass through the server-ordered rows unchanged; otherwise keep the existing position-based sort (which is useful when no sort is active so that optimistically-created rows and ws-pushed rows land in their natural order).

**Tech Stack:** React 18, TanStack Query v5 (infinite), the existing server-side keyset pagination on `(sort keys..., position, id)`.

---

## Background

Reported symptom: user applies "Title ascending" in the sort popover. Initial view looks plausible. Scroll down — further pages load in title order. Scroll back up — the top of the list is now a random-looking mess (screenshots confirm `Update Proposal Sierra`, `Echo November ...` at the top instead of `Alpha ...`).

### Why it happens

Row fetch uses an infinite query, keyed by sort/filter/search:

```ts
// apps/client/src/features/base/queries/base-row-query.ts:57-72
return useInfiniteQuery({
  queryKey: ["base-rows", baseId, activeFilter, activeSorts, activeSearch],
  queryFn: ({ pageParam }) =>
    listRows(baseId!, { cursor: pageParam, limit: 100, filter, sorts, search }),
  ...
});
```

Server-side, [`base-row.repo.ts:list`](apps/server/src/database/repos/base/base-row.repo.ts) takes a different path when sort/filter/search is present: `runListQuery(base, opts)` builds a keyset-paginated SELECT ordered by the requested sort keys (with `position, id` as stable tie-breakers). Page N+1's cursor picks up exactly where page N left off. Server pages are correct.

Client-side, [`base-table.tsx:66-69`](apps/client/src/features/base/components/base-table.tsx:66):

```ts
const rows = useMemo(() => {
  const flat = flattenRows(rowsData);
  return flat.sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0));
}, [rowsData]);
```

This flattens all fetched pages and then re-sorts them by `position` — the fractional-index that the server uses only as a tie-breaker. That completely discards the server's sort-key ordering and re-orders the list by an unrelated key. Each additional page fetched adds more "small position" rows near the top, progressively clobbering whatever made sense before.

### Why the sort-by-position exists in the first place

When NO sort is active, the server's fast path returns rows ordered by `position` (see `base-row.repo.ts:99-120`). Optimistic row creates (from `useCreateRowMutation.onSuccess`) and ws-pushed rows from other clients append to the last page in cache. In the no-sort case, the client-side position sort puts those appended rows into the correct visual slot without waiting for a refetch — a real benefit.

So we can't remove the sort unconditionally. We just need to skip it when the server already sorted the rows for us.

---

## File Structure

**Modified:** `apps/client/src/features/base/components/base-table.tsx` — one `useMemo`.

No new files, no new deps, no server changes.

---

## Task 1: Conditionally skip the client-side position sort

**File:** `apps/client/src/features/base/components/base-table.tsx`

- [ ] **Step 1: Replace the rows memo**

Find the existing memo at roughly lines 66-69:

```ts
const rows = useMemo(() => {
  const flat = flattenRows(rowsData);
  return flat.sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0));
}, [rowsData]);
```

Replace with:

```ts
const rows = useMemo(() => {
  const flat = flattenRows(rowsData);
  // When a sort is active, the server returns rows in the requested
  // sort order via keyset pagination. Re-sorting by `position` on the
  // client would override that with fractional-index order — visibly
  // breaking the sort as more pages load. Only apply the position
  // sort when no view sort is active (where it keeps
  // optimistically-created and ws-pushed rows in place without a
  // refetch).
  if (activeSorts && activeSorts.length > 0) {
    return flat;
  }
  return flat.sort((a, b) =>
    a.position < b.position ? -1 : a.position > b.position ? 1 : 0,
  );
}, [rowsData, activeSorts]);
```

`activeSorts` is already in scope above this memo (line 46: `const activeSorts = activeView?.config?.sorts;`). Adding it to the dep array is safe.

- [ ] **Step 2: Build**

```bash
pnpm nx run client:build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/features/base/components/base-table.tsx
git commit -m "fix(base): don't override server sort with client-side position sort"
```

---

## Task 2: USER smoke test

> ⚠️ **Do not run `pnpm dev` as an agent.** Hand off to the user.

Ask the user to verify on the 1K or 10K seed base:

- [ ] **Sort by Title ascending, scroll to bottom, scroll back to top.**
  - Top of the list should still be the lowest-title rows (e.g. `Alpha ...`).
  - Bottom of the list should be the highest-title rows (e.g. `Zulu ...`).
  - No re-ordering after scrolling.

- [ ] **Sort by Estimate descending.**
  - Highest numeric estimates at the top. Same stability check after scrolling.

- [ ] **Remove all sorts.**
  - Rows appear in insert/position order (the default). Same as before the fix — this path shouldn't regress.

- [ ] **Add a new row with no sort active.**
  - New row appears at its natural position without waiting for a refetch (the position-sort path still protects this).

- [ ] **Add a new row WITH a sort active.**
  - Row appears at the end of the current list (known limitation — see Out of scope). This is acceptable for now.

- [ ] **Two-sort case.** Sort by Status ascending, then by Title ascending.
  - Rows group by Status (all "Not Started" first, then "In Progress", etc.); within each group, sorted by Title. Scrolling doesn't break it.

- [ ] **Regression: Virtualization still works.**
  - Scroll through the 10K base. Smooth, no crashes.

If any step misbehaves, report back with which one.

---

## Out of scope

- **New rows landing in the right slot when a sort is active.** Fixing that cleanly would require a binary insertion into the cached pages based on the sort keys, which depends on per-cell comparators (select/multi-select resolve via choice order, person via display name, etc.). Separate work. For now, users with a sort active see newly-created rows at the bottom until the next refetch.
- **ws-pushed rows with a sort active.** Same limitation — they append to the last page.
- **Removing the client-side `position` sort entirely.** Keeping it in the no-sort path preserves the good behavior for optimistic creates.
