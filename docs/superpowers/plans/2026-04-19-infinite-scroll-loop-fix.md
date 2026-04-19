# Infinite Scroll Fetch Loop Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `fetchNextPage` from firing in a tight re-render loop when the user is near the bottom of a large sorted base — currently produces 900+ redundant page fetches and only stops when the user scrolls back up.

**Architecture:** The current trigger is a `useEffect` whose dependency list includes `virtualItems` (a fresh array from `virtualizer.getVirtualItems()` on every render). The effect re-runs on every render, and once the "near bottom" condition is satisfied it re-fires until the virtualizer's computed visible range moves away from the end. Fix: gate the trigger with a ref that records the `rows.length` at which we last fetched — guarantees at most one fetch per new page of data until the user actually scrolls further down.

**Tech Stack:** React 18, `@tanstack/react-virtual`, `@tanstack/react-query` v5 `useInfiniteQuery`.

---

## Background

Screenshot from the field shows the Network panel accumulating `POST /bases/rows` requests — roughly 1 request per ~40 ms — for the 10K-row seed base while a sort is active. Status stays at "50 / 971 requests" and climbing. The loop ends only when the user scrolls back up.

### Why the loop happens

Current trigger at [grid-container.tsx:114-121](apps/client/src/features/base/components/grid/grid-container.tsx:114):

```ts
useEffect(() => {
  if (!hasNextPage || isFetchingNextPage || !onFetchNextPage) return;
  const lastItem = virtualItems[virtualItems.length - 1];
  if (!lastItem) return;
  if (lastItem.index >= rows.length - OVERSCAN * 2) {
    onFetchNextPage();
  }
}, [virtualItems, rows.length, hasNextPage, isFetchingNextPage, onFetchNextPage]);
```

Three compounding issues:

1. **`virtualItems` is a fresh array on every render.** `virtualizer.getVirtualItems()` returns a newly-constructed array each call, so React sees a changed dep every render. The effect executes on every render.

2. **After a fetch resolves, rows grow but `lastItem.index` can still satisfy the "near bottom" threshold** — particularly when the user was scrolled all the way to the bottom. The virtualizer preserves `scrollTop`, so the previously-rendered last row is now near the middle-end of the new (larger) virtual list, and its index is right inside the `rows.length - OVERSCAN * 2` window.

3. **Heights are estimated via `estimateSize: () => 36`.** When `.cell`'s actual rendered height exceeds 36 (min-height only), the virtualizer re-measures, which shifts the reported `virtualItems` by a few indices each render — enough to keep `lastItem.index` hovering inside the trigger zone indefinitely.

So on each render: `virtualItems` has new identity → effect runs → `isFetchingNextPage` just transitioned to `false` after the previous page's commit → condition still holds → fire again. The loop can only break when the user scrolls far enough up that `lastItem.index < rows.length - OVERSCAN * 2` on the next render.

### The fix shape

Add a ref `lastTriggeredRowsLenRef` that records the `rows.length` value at which we last fired `onFetchNextPage`. The trigger is allowed only when `rows.length > lastTriggeredRowsLenRef.current` — i.e., the previous fetch has committed new rows, AND we haven't yet fired against this new length. When a page arrives, `rows.length` grows, the guard permits one fire, we update the ref, and subsequent re-renders at the same `rows.length` are no-ops.

This pattern is standard for effect-based infinite scroll and is exactly what's missing here.

---

## File Structure

**Modified:**
- `apps/client/src/features/base/components/grid/grid-container.tsx` — one ref + one guard line added to the existing effect.

No new files, no new deps, nothing server-side.

---

## Task 1: Guard the fetch trigger against repeat fires at the same rows.length

**File:** `apps/client/src/features/base/components/grid/grid-container.tsx`

- [ ] **Step 1: Add `useRef` to the existing react import**

The file currently imports `{ useCallback, useEffect, useMemo, useRef, useState }` — confirm `useRef` is already present (it almost certainly is, given `scrollRef` exists). If not, add it.

- [ ] **Step 2: Declare the ref next to the other refs inside `GridContainer`**

Find where `scrollRef` is declared near the top of the component. Add immediately after it:

```ts
// Records the `rows.length` at which we last triggered a page fetch.
// The trigger effect re-runs on every render (its `virtualItems` dep
// has a new identity each call) and can't rely on `isFetchingNextPage`
// alone: once a page commits, `isFetchingNextPage` flips to false for
// one render, the "near bottom" condition still holds because the
// virtualizer anchors on the old scroll position, and we'd fire again.
// Gating on `rows.length` guarantees at most one fire per new page.
const lastTriggeredRowsLenRef = useRef(0);
```

- [ ] **Step 3: Add the guard to the trigger effect**

Replace the existing effect block at roughly lines 114-121:

Before:
```ts
useEffect(() => {
  if (!hasNextPage || isFetchingNextPage || !onFetchNextPage) return;
  const lastItem = virtualItems[virtualItems.length - 1];
  if (!lastItem) return;
  if (lastItem.index >= rows.length - OVERSCAN * 2) {
    onFetchNextPage();
  }
}, [virtualItems, rows.length, hasNextPage, isFetchingNextPage, onFetchNextPage]);
```

After:
```ts
useEffect(() => {
  if (!hasNextPage || isFetchingNextPage || !onFetchNextPage) return;
  const lastItem = virtualItems[virtualItems.length - 1];
  if (!lastItem) return;
  if (lastItem.index < rows.length - OVERSCAN * 2) return;
  if (rows.length <= lastTriggeredRowsLenRef.current) return;
  lastTriggeredRowsLenRef.current = rows.length;
  onFetchNextPage();
}, [virtualItems, rows.length, hasNextPage, isFetchingNextPage, onFetchNextPage]);
```

Why `<=` and not `<`: after a fire, the ref holds the pre-fetch `rows.length`. When the page commits, `rows.length` grows, so `rows.length > ref` and the next fire is allowed (exactly once, since the ref then captures the new length).

- [ ] **Step 4: Reset the ref when the row set resets (new base / view / sort / filter)**

Different query-key means `rowsData` is discarded and pagination starts over from page 1. We need to reset our guard too, or it'll block the first fetch of the next query.

Find the existing effect (around line 62 in the parent `BaseTable`, or an equivalent in `GridContainer`) that reacts to `baseId` / activeView id changing, OR use the infinite query's data being discarded. In `GridContainer`, the `rows` prop comes in fresh when the parent re-runs the infinite query. When `rows.length` becomes `0` (reset) OR becomes *smaller* than what we'd last seen, the ref must reset. Add this effect AFTER the trigger effect from Step 3:

```ts
useEffect(() => {
  // When the underlying row set shrinks (filter changed, sort toggled,
  // view switched) or resets to zero, we're on a fresh pagination
  // sequence — un-gate the trigger so the first page triggers a
  // potential next fetch correctly.
  if (rows.length === 0 || rows.length < lastTriggeredRowsLenRef.current) {
    lastTriggeredRowsLenRef.current = 0;
  }
}, [rows.length]);
```

- [ ] **Step 5: Build**

```bash
pnpm nx run client:build
```

Expected: success.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/features/base/components/grid/grid-container.tsx
git commit -m "fix(base): stop infinite fetch loop when sorted list scrolled to bottom"
```

---

## Task 2: USER smoke test

> ⚠️ **Do not run `pnpm dev` as an agent.** Hand off.

On the 10K seed base:

- [ ] **Sorted scroll to bottom, count requests.**
  1. Open the 10K base. Apply sort by Title ascending.
  2. Open DevTools → Network → filter to `Fetch/XHR`.
  3. Clear the Network log.
  4. Scroll to the very bottom using the scrollbar.
  5. Count the `bases/rows` requests. Expected: roughly 10K / 100 = **~100**, not 900+. It's fine if it's slightly over 100 due to pre-fetch, but it should cleanly stop within a few seconds of reaching the bottom.

- [ ] **Dwell at the bottom without scrolling.**
  1. Stay at the bottom for 10 seconds.
  2. No additional `bases/rows` requests should fire. (Before the fix: would be dozens per second.)

- [ ] **Scroll back up, then back down.**
  1. Scroll to top. Verify sort order is still correct (the earlier fix for client-side position sort should still hold).
  2. Scroll back to bottom. Should not refetch already-cached pages.

- [ ] **Change the sort.**
  1. Remove the current sort and add a different one.
  2. Query resets. Pagination restarts from page 1. No lingering loop.

- [ ] **Unsorted base (regression).**
  1. Remove all sorts.
  2. Scroll through. Fetching still works and stops correctly.

- [ ] **Filter applied.**
  1. Add a filter that returns ~2,000 matches.
  2. Scroll. Should fetch ~20 pages and stop cleanly.

If any step misbehaves — especially if requests still loop — capture the Network count and which filter/sort was active, and report back.

---

## Out of scope

- Switching from the effect-based trigger to an `IntersectionObserver` sentinel. Cleaner pattern but larger diff; the ref guard is the surgical fix for the reported bug.
- Making the virtualizer measure actual row heights via `measureElement` (would remove one of the three compounding causes). Worth it later; not required to fix the loop.
- Showing a visible "loading more…" indicator at the bottom during fetch. Orthogonal UX improvement.
