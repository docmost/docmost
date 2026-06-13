# Infinite Scroll Fetch Loop Fix v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kill the pagination loop that still fires extra `POST /bases/rows` requests as the user scrolls continuously through a 10K+ base, even after the v1 rows-length guard.

**Architecture:** Replace the `virtualItems`-polling effect with a scroll-event-driven trigger plus a **synchronous** pending-fetch ref. Two independent dedup mechanisms: (a) only consider firing after a real scroll event (debounced), (b) never dispatch a second `fetchNextPage` until the previous one's resulting page has been committed to the cache. The previous v1 fix relied on `rows.length` growing after each commit, which under sustained scrolling lets react-query schedule multiple fetches before its own `isFetchingNextPage` observed-true state propagates to our render.

**Tech Stack:** React 18, `@tanstack/react-virtual`, `@tanstack/react-query` v5.

---

## Background

### What v1 fixed and what it missed

v1 ([grid-container.tsx, commit `c4d8b6c3`](apps/client/src/features/base/components/grid/grid-container.tsx)) added `lastTriggeredRowsLenRef` — "don't fire again until `rows.length` grows past the last value we triggered on." That breaks the *idle-at-bottom* loop (where the effect was firing every render on the same `rows.length`).

It still leaks under sustained scrolling:

1. User scrolls rapidly. Effect runs. Condition holds. Ref updates to N. `onFetchNextPage()` dispatched.
2. react-query enqueues a fetch. But the internal state object mutations reaching our `isFetchingNextPage` snapshot happen across a microtask boundary; within the SAME React render commit there's a window where `isFetchingNextPage` is still `false` from React's perspective.
3. The effect dep list includes `virtualItems`, which `virtualizer.getVirtualItems()` mints fresh every render. Any other state change (scroll position, virtual measurements, React 18 batching flushes) re-fires the effect.
4. Our `rows.length <= ref` gate blocks further fires AT THE SAME LENGTH. But because the user is SCROLLING, as soon as a page DOES commit, `rows.length` jumps, and on that same commit render the effect can fire repeatedly (e.g., due to scroll-driven re-measures) because the `isFetchingNextPage` false window can overlap with the new render.
5. If enough fetches pile up, react-query dispatches each in sequence. Requests are only partly deduped — each call while a fetch is in flight returns the same promise, BUT if the commit has already landed and `isFetchingNextPage` flipped briefly to false before our render observed it, that call dispatches a NEW fetch. Net: 10× more dispatches than pages committed.

Reported symptom: on the 10K base the loop kicks in after a while of scrolling. Network panel shows `1176 requests` initiated, only `124` loaded — ~10× over-dispatch.

### The fix shape

Two orthogonal locks that together make over-dispatch impossible:

**Lock A — synchronous pending flag.** A `pendingFetchRef` set to `true` SYNCHRONOUSLY right before `onFetchNextPage()` is called. Cleared in a separate effect that watches `isFetchingNextPage` transitioning back to `false` (i.e., the fetch that we started has resolved). While the ref is set, the trigger never re-fires. This eliminates the same-render-double-fire window that the v1 length guard couldn't cover.

**Lock B — real scroll events, not render-driven polling.** Attach a listener to `scrollRef`'s `scroll` event, debounced ~50 ms. On each debounced scroll, compute "am I near the bottom" from raw `scrollTop + clientHeight >= scrollHeight - threshold`. This removes `virtualItems` from the trigger path entirely — no effect is running on every render.

With both locks, the worst-case dispatch cadence is *one per debounced scroll tick where you're near the bottom*. Combined with Lock A's pending gate, you get *at most one request in flight at a time*, committing sequentially as the user scrolls.

Keep the v1 `lastTriggeredRowsLenRef` guard as a safety net (it's cheap and prevents re-trigger against stale row-set data).

---

## File Structure

**Modified:**
- `apps/client/src/features/base/components/grid/grid-container.tsx` — replace the current trigger effect; add a pending ref + a reset effect.

No new files, no new deps, nothing server-side.

---

## Task 1: Replace the trigger with a scroll-driven + pending-guarded version

**File:** `apps/client/src/features/base/components/grid/grid-container.tsx`

### Step 1: Add a pending ref next to the existing `lastTriggeredRowsLenRef`

Inside `GridContainer`, right after `const lastTriggeredRowsLenRef = useRef(0);` (around line 70), add:

```ts
// Synchronous guard: set to true the moment we dispatch `onFetchNextPage`,
// cleared only after `isFetchingNextPage` has transitioned back to false.
// This closes the "React 18 batching / snapshot staleness" window where
// `isFetchingNextPage` from the hook is still observed false even though
// a dispatch is already in flight — which is how the v1 length-only
// guard still permits over-dispatch during sustained scrolling.
const pendingFetchRef = useRef(false);
```

### Step 2: DELETE the existing trigger effect

Locate the effect at roughly lines 122-130:

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

Delete it entirely. We're replacing render-polling with scroll-event-driven.

### Step 3: Add a new scroll-event-driven effect in its place

Insert this (same location):

```ts
// Scroll-event-driven pagination trigger. Previously this was a
// render-effect that polled `virtualItems` — which runs on every render
// (virtualItems has fresh identity each call) and over-dispatches when
// React's `isFetchingNextPage` snapshot is stale relative to react-query's
// in-flight state. A plain scroll event with a small debounce and a
// synchronous pending ref fires at most once per scroll pulse AND
// at most one in-flight request at a time.
useEffect(() => {
  const el = scrollRef.current;
  if (!el) return;

  const NEAR_BOTTOM_PX = ROW_HEIGHT * OVERSCAN * 2;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const maybeFetch = () => {
    if (!onFetchNextPage) return;
    if (!hasNextPage) return;
    if (isFetchingNextPage) return;
    if (pendingFetchRef.current) return;
    const node = scrollRef.current;
    if (!node) return;
    const distanceFromBottom =
      node.scrollHeight - (node.scrollTop + node.clientHeight);
    if (distanceFromBottom > NEAR_BOTTOM_PX) return;
    if (rows.length <= lastTriggeredRowsLenRef.current) return;

    pendingFetchRef.current = true;
    lastTriggeredRowsLenRef.current = rows.length;
    onFetchNextPage();
  };

  const onScroll = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(maybeFetch, 50);
  };

  // Also evaluate once on mount / when deps change — covers the case
  // where the user hasn't scrolled yet but the viewport is already
  // past the near-bottom threshold (e.g. first page is short).
  maybeFetch();

  el.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    el.removeEventListener("scroll", onScroll);
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}, [rows.length, hasNextPage, isFetchingNextPage, onFetchNextPage]);
```

Notes the implementer must not change:
- The `maybeFetch()` call BEFORE adding the scroll listener is intentional — it handles "viewport already past threshold on mount/commit" without requiring a scroll.
- `NEAR_BOTTOM_PX = ROW_HEIGHT * OVERSCAN * 2` keeps the trigger threshold equivalent to the old `lastItem.index >= rows.length - OVERSCAN * 2` rule (20 rows * 36 px = 720 px).
- `pendingFetchRef.current = true` is set BEFORE `onFetchNextPage()` so a synchronous re-entry can't slip through.
- `passive: true` on the listener is performance-critical on large lists.

### Step 4: Add an effect that clears `pendingFetchRef` when a fetch resolves

Immediately after the effect from Step 3, add:

```ts
useEffect(() => {
  if (!isFetchingNextPage) {
    // react-query's fetch we triggered has resolved (data committed +
    // isFetchingNextPage back to false). Release the pending gate.
    pendingFetchRef.current = false;
  }
}, [isFetchingNextPage]);
```

This is the counterpart to Step 3's `pendingFetchRef.current = true`. The flag lifecycle:
- `false` initially
- set `true` synchronously just before `onFetchNextPage()`
- set back to `false` as soon as `isFetchingNextPage` observed goes back to `false`

Between those, no new dispatch is allowed.

### Step 5: Keep the existing reset effect

The effect at roughly lines 132-140 that resets `lastTriggeredRowsLenRef` to 0 when `rows.length` drops (view/filter/sort switch) must stay as-is. Do NOT delete it.

### Step 6: Build

```bash
pnpm nx run client:build
```

Expected: success.

### Step 7: Commit

```bash
git add apps/client/src/features/base/components/grid/grid-container.tsx
git commit -m "fix(base): drive pagination from scroll events with in-flight gate to kill dispatch loop"
```

---

## Task 2: USER smoke test

> ⚠️ **Do not run `pnpm dev` as an agent.** Hand off.

On the 10K base (should also work on 100K):

- [ ] **Rapid continuous scroll to bottom.**
  1. DevTools → Network → filter to `Fetch/XHR` → clear.
  2. Scroll the scrollbar smoothly from top to bottom of the 10K base, no pauses.
  3. Expected: roughly one `POST /bases/rows` per page (~100 total for 10K rows / 100 per page). NO "n requests in flight with only k loaded" state — completed count should track initiated count closely.

- [ ] **Idle at bottom for 30 s.**
  1. After reaching the bottom, wait.
  2. Zero additional requests fire.

- [ ] **Scroll up and back down.**
  1. Scroll up to row 5000, then back to bottom.
  2. No refetch of already-cached pages; only new pages (if any remain) fire.

- [ ] **Sort change mid-scroll.**
  1. While at row 5000, change the sort from Title-asc to Title-desc.
  2. Pagination resets cleanly. Fetches the first page of the new sort order; scrolling continues to fetch normally.

- [ ] **Filter that narrows to few hundred rows.**
  1. Apply a filter producing ~200 matches.
  2. Scroll to bottom. Exactly ~2 fetches (first page was already loaded + next one). Stops cleanly.

- [ ] **Regression: unsorted base.**
  1. Remove sort/filter. Scroll through. Fetches still fire correctly.

- [ ] **Regression: create row at top of scroll.**
  1. Scroll to top, add a new row. It appears. No extra pagination fires.

If any step shows over-dispatch (initiated » loaded) or misses a page, report which with approximate counts.

---

## Out of scope

- Swapping to an `IntersectionObserver` sentinel. Scroll-event + debounce achieves the same dedup without the complexity of maintaining a sentinel element inside a virtualized grid.
- Measuring real row heights via `measureElement`. Unrelated to the dispatch loop; useful later for pixel-perfect scrolling.
- A visible "loading more…" indicator during fetch. UX only.
