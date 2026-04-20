# Base View Draft (Local-First Filter & Sort) — Design Spec

**Date:** 2026-04-20
**Status:** Draft
**Feature area:** `apps/client/src/features/base` (client-only)

## Goal

Make filter and sort changes on a base view **local-first**: they apply instantly for the editing user, are scoped to their own browser/profile, and never touch the server baseline until the user explicitly clicks "Save for everyone". A banner at the top of the table surfaces the draft state and lets the user either promote the draft to the shared baseline or discard it.

This removes the current Notion-unlike behavior where every filter/sort tweak is auto-persisted and immediately inflicted on every teammate viewing the same view.

## Non-goals (v1)

- **Column layout in draft mode.** Column visibility, order, and widths continue to flow through the existing debounced `persistViewConfig` path in [use-base-table.ts:371-396](../../../apps/client/src/features/base/hooks/use-base-table.ts). No draft behavior for them. (Listed as a future extension.)
- **Server-side per-user drafts.** localStorage only. A user clearing their browser storage, switching devices, or using a different browser profile loses drafts — by design.
- **"Save as new view".** The screenshot hints at a dropdown caret next to the Save button for a "save as new view" split-action. Not in v1.
- **Kanban / calendar.** Only the `table` view type exists today; spec scopes to it but the hook is type-agnostic and will apply trivially when other view types land.
- **Automatic garbage collection of stale drafts.** Drafts persist indefinitely until the user resets or saves. No TTL, no eager cleanup when baseline values match the draft.
- **Conflict UI.** If another user writes a new baseline while I have local drafts, my draft silently wins on my client. No "baseline changed" warning.

## UX overview

### Draft banner

Placement: **between** the page title and [BaseToolbar](../../../apps/client/src/features/base/components/base-toolbar.tsx), inside [base-table.tsx](../../../apps/client/src/features/base/components/base-table.tsx) above the `<BaseToolbar />` node (around [base-table.tsx:192](../../../apps/client/src/features/base/components/base-table.tsx)). The banner is part of the table's own layout, not a workspace-level chrome element, because it's tied to a specific view.

Render condition: `isDirty === true` (see "Dirty check").

Layout (match the reference screenshot):

- Mantine `<Paper withBorder radius="sm" px="md" py="xs">` with a soft background (`bg="yellow.0"` or `bg="orange.0"` depending on theme palette — pick whichever tolerates dark mode) and a small info icon on the left.
- Left region: short message — `t("Filter and sort changes are visible only to you.")`.
- Right region (a `<Group gap="sm">`):
  - `<Button variant="subtle" color="gray" size="xs">{t("Reset")}</Button>` — underline-on-hover "text link" feel; wipes the draft.
  - `<Button variant="filled" size="xs">{t("Save for everyone")}</Button>` — primary accent (project's default theme color — orange in the screenshot maps to Mantine's configured `primaryColor`, so `color` is omitted and the theme default is used).
- The "Save for everyone" button is **omitted entirely** for users without edit permission (see "Permission gating"). "Reset" always shows.
- The banner never animates in/out on every keystroke — it only appears/disappears when `isDirty` flips. Add a Mantine `<Transition mounted={isDirty} transition="slide-down" duration={120}>` wrap if the flip is jarring; otherwise mount unconditionally with a `{isDirty && ...}` guard.

### Filter/sort editors in draft mode

No UI affordance changes inside the filter or sort popovers themselves. They keep the same open-on-click, add/remove/edit flow. The only behavioral change is that their `onChange` callback writes to the draft store rather than firing `updateView` — completely transparent to the editor components.

### Reset behavior

Click Reset → the draft hook removes its localStorage entry → the table re-renders reading filter/sorts from `activeView.config` (the server baseline). Any currently-open filter/sort popover closes on outside click as usual; if it's open when the user clicks Reset, the next render shows the baseline values. No notification — the banner disappearing is sufficient feedback.

### Save for everyone

Click Save → call the existing `useUpdateViewMutation` from [base-view-query.ts:43-112](../../../apps/client/src/features/base/queries/base-view-query.ts) with `{ viewId, baseId, config: { ...serverBaseline, filter: draft.filter, sorts: draft.sorts } }`. On success, clear the localStorage key and show a Mantine notification `t("View updated for everyone")`. On error, keep the draft; the mutation already wires the error toast.

### Permission gating

A user can edit this base iff their space membership grants `SpaceCaslAction.Edit, SpaceCaslSubject.Base` — the same check the server enforces in [base-view.controller.ts:68](../../../apps/server/src/core/base/controllers/base-view.controller.ts). Viewers still get local drafts (the entire point is that local changes don't require edit permission), but their "Save for everyone" button is hidden.

**Client caveat:** [permissions.type.ts](../../../apps/client/src/features/space/permissions/permissions.type.ts) currently only exports `Settings`, `Member`, and `Page` subjects. The server enum has `Base` but the client enum doesn't. The spec adds `Base = "base"` to `SpaceCaslSubject` and widens the `SpaceAbility` union — that's a one-line change plus import fix.

## Data model

### localStorage key

```
docmost:base-view-draft:v1:{userId}:{baseId}:{viewId}
```

- Namespace prefix `docmost:base-view-draft:` keeps us from colliding with other consumers.
- `v1` is the schema version so a future breaking change can shed old entries by skipping.
- `{userId}` scopes drafts so a shared-device login-swap doesn't leak drafts across accounts. `userId` comes from the existing `useCurrentUser()` hook (returns `{ data: ICurrentUser }` — read `user?.user.id`), the same helper used by other authenticated client code.
- `{baseId}` and `{viewId}` together uniquely identify which table state the draft applies to.

### Value shape

```ts
// apps/client/src/features/base/types/base.types.ts (additive)
export type BaseViewDraft = {
  filter?: FilterGroup;
  sorts?: ViewSortConfig[];
  updatedAt: string; // ISO timestamp, written on each put — used only for diagnostics
};
```

Both `filter` and `sorts` are optional, independently. An absent field means "inherit baseline for that axis". That matters because a user who's only dirtied sorts but not filters should see the baseline filter unchanged if the baseline's filter later shifts.

Serialized as JSON via `JSON.stringify` / `JSON.parse`. No schema validation on read — if the parse fails or the shape looks wrong, the hook drops it silently and falls back to baseline.

## Client architecture

### New hook: `useViewDraft`

**File:** `apps/client/src/features/base/hooks/use-view-draft.ts`

```ts
export type ViewDraftState = {
  draft: BaseViewDraft | null;
  // The filter/sorts that should actually drive the table and row query.
  // `draft.X ?? baseline.X` — i.e. draft wins per-axis, baseline fills gaps.
  effectiveFilter: FilterGroup | undefined;
  effectiveSorts: ViewSortConfig[] | undefined;
  isDirty: boolean;
  setFilter: (filter: FilterGroup | undefined) => void;
  setSorts: (sorts: ViewSortConfig[] | undefined) => void;
  reset: () => void;
  // Used by the Save handler — returns the composed config to pass to updateView.
  buildPromotedConfig: (baseline: ViewConfig) => ViewConfig;
};

export function useViewDraft(args: {
  userId: string | undefined;
  baseId: string | undefined;
  viewId: string | undefined;
  baselineFilter: FilterGroup | undefined;
  baselineSorts: ViewSortConfig[] | undefined;
}): ViewDraftState;
```

**Behavior:**

1. Compute the storage key `docmost:base-view-draft:v1:{userId}:{baseId}:{viewId}`. If any of the three ids is undefined, the hook returns a "passthrough" state (`draft=null`, `isDirty=false`, all setters no-op, effective* falls through to baseline).
2. On mount and whenever the key changes, read the value from `localStorage` and `JSON.parse`. Invalid or missing → `draft=null`.
3. `setFilter` / `setSorts` merge into the current draft, write to `localStorage`, update React state. An update that sets both axes back to `undefined` (i.e. no local divergence remaining) **removes the key entirely** rather than writing an empty `{}` — this keeps `isDirty` clean when the user manually undoes all their changes.
4. `reset` is `localStorage.removeItem(key)` + `setDraft(null)`.
5. `isDirty` is computed as: any draft key present, AND `!shallowEqualFilter(draft.filter, baselineFilter) || !shallowEqualSorts(draft.sorts, baselineSorts)`. The "orphan" rule (draft values matching baseline → banner hidden) is enforced here; see "Dirty check".
6. Subscribes to `window.addEventListener("storage", ...)` with a callback that re-reads on matching key changes from other tabs (see "Cross-tab sync").
7. Writes use a synchronous `localStorage.setItem` — no debouncing. localStorage writes are cheap and the filter/sort popovers commit in discrete user actions (clicking Save inside the popover), not keystroke-by-keystroke.
8. `buildPromotedConfig(baseline)` returns `{ ...baseline, filter: draft?.filter ?? baseline.filter, sorts: draft?.sorts ?? baseline.sorts }`. Used by the Save handler to compose the `updateView` payload — preserves everything else about the baseline (widths, order, etc.) and only overwrites the two axes the draft may have diverged on.

**Return composition:**

- `effectiveFilter = draft?.filter ?? baselineFilter`
- `effectiveSorts = draft?.sorts ?? baselineSorts`

### Integration into `useBaseTable` and `base-table.tsx`

`useBaseTable` at [use-base-table.ts:224](../../../apps/client/src/features/base/hooks/use-base-table.ts) currently derives the table's initial sort from `activeView.config.sorts`. In the new world the table's sort/filter state must come from the **effective** values (draft-or-baseline), not the raw `activeView.config`.

Two cut options were considered:

**Option A (chosen): drive from effective values via props.** `useBaseTable` takes an additional `effectiveConfig?: ViewConfig` parameter (or, cleaner, the caller passes a shallow-merged `activeView` whose `config` is `{ ...activeView.config, filter: effective.filter, sorts: effective.sorts }`). `buildSortingState` and the row query already read from `activeView.config`, so the cleanest shape is to mutate the config the hook receives, not to introduce a new parameter.

**Option B (rejected): thread draft deep into `useBaseTable`.** Adds the concept of drafts to a hook that only cares about the rendered state. Muddies responsibilities.

Going with A. In [base-table.tsx](../../../apps/client/src/features/base/components/base-table.tsx):

```ts
// NEW: wire the draft hook
const { data: user } = useCurrentUser();
const { draft, effectiveFilter, effectiveSorts, isDirty, setFilter, setSorts, reset, buildPromotedConfig } =
  useViewDraft({
    userId: user?.user.id,
    baseId,
    viewId: activeView?.id,
    baselineFilter: activeView?.config?.filter,
    baselineSorts: activeView?.config?.sorts,
  });

// Swap the raw `activeView` for a view with effective config so the table and row query see drafts.
const effectiveView = useMemo(
  () =>
    activeView
      ? { ...activeView, config: { ...activeView.config, filter: effectiveFilter, sorts: effectiveSorts } }
      : undefined,
  [activeView, effectiveFilter, effectiveSorts],
);

// Row query reads effective filter/sorts.
const { data: rowsData, ... } = useBaseRowsQuery(
  base ? baseId : undefined,
  effectiveFilter,
  effectiveSorts,
);

// Table is seeded from effectiveView for rendering, but the auto-persist
// write-path uses the real `activeView.config` as the baseline so draft
// filter/sort values can never leak into a column-layout save.
// See "Filter & sort write-path changes" below for the exact mechanism.
const { table, persistViewConfig } = useBaseTable(base, rows, effectiveView, {
  baselineConfig: activeView?.config,
});
```

The server-roundtrip `persistViewConfig` keeps being called for column layout changes. It reads from `baselineConfig` — never from the effective/draft state — so a pending layout write cannot bake draft filter/sort values into the server baseline. See the next subsection for the exact implementation.

### Filter & sort write-path changes

Today, filter/sort editors feed `BaseToolbar`'s handlers:

- [base-toolbar.tsx:135-148](../../../apps/client/src/features/base/components/base-toolbar.tsx) `handleSortsChange` → builds config via `buildViewConfigFromTable(table, activeView.config, { sorts: newSorts })` → `updateViewMutation.mutate(...)`.
- [base-toolbar.tsx:150-169](../../../apps/client/src/features/base/components/base-toolbar.tsx) `handleFiltersChange` → same pattern with `{ filter }`.

Both write directly to the server. That's the exact site to branch.

**New `base-toolbar.tsx`:** accept two new callbacks from `base-table.tsx`:

```ts
onDraftSortsChange: (sorts: ViewSortConfig[]) => void;
onDraftFiltersChange: (filter: FilterGroup | undefined) => void;
```

The toolbar drops its internal `updateViewMutation.mutate` calls for sort/filter (retains them for view tabs / view type flip if any exists elsewhere). `handleSortsChange` becomes:

```ts
const handleSortsChange = useCallback(
  (newSorts: ViewSortConfig[]) => {
    onDraftSortsChange(newSorts); // writes to useViewDraft via base-table
  },
  [onDraftSortsChange],
);
```

Same for filters — the FilterCondition[]→FilterGroup wrapping logic at [base-toolbar.tsx:152-157](../../../apps/client/src/features/base/components/base-toolbar.tsx) stays; only the final dispatch target changes.

**`base-table.tsx`** wires those callbacks to the draft hook:

```ts
const handleDraftSortsChange = useCallback(
  (sorts: ViewSortConfig[]) => setSorts(sorts.length ? sorts : undefined),
  [setSorts],
);
const handleDraftFiltersChange = useCallback(
  (filter: FilterGroup | undefined) => setFilter(filter),
  [setFilter],
);
```

The "normalize empty to undefined" rule is how we let the draft go clean after the user deletes every filter — the draft hook's "remove key if both axes are undefined" rule then kicks in.

**Toolbar badge counts:** [base-toolbar.tsx:118-128](../../../apps/client/src/features/base/components/base-toolbar.tsx) currently derives `sorts` and `conditions` from `activeView.config`. Switch these to read from the **effective** config (`effectiveView.config`) so the toolbar badges reflect the draft's count, not the baseline. The toolbar already accepts `activeView` — pass it `effectiveView` instead, since everything the toolbar reads from `activeView` (name, sorts, filter) should be in the effective form.

**The `buildViewConfigFromTable` call site in `handleColumnReorder` / `handleResizeEnd` / field-visibility:** these continue reading from `activeView.config` (the real baseline) and going through `updateViewMutation`. They do **not** read from the draft. This is deliberate — column layout stays auto-persisted.

However: `buildViewConfigFromTable` currently spreads its `base` argument and emits `sorts` from the live table state. For the debounced `persistViewConfig` call at [use-base-table.ts:382](../../../apps/client/src/features/base/hooks/use-base-table.ts), the `base` arg is the effective config (because we pass `effectiveView` into `useBaseTable`), but the emitted `sorts` comes from the table's live state — which was seeded from effective. That means if the user drafts a sort and then reorders a column, the debounced persist would write `{ ...effectiveConfig, sorts: draftSorts }` back to the server. **Bug.**

Fix: when building the config for the auto-persist path in `persistViewConfig`, override the emitted `sorts` and `filter` with the **baseline** values, not the effective ones. Concretely, change [use-base-table.ts:382](../../../apps/client/src/features/base/hooks/use-base-table.ts) to

```ts
const config = buildViewConfigFromTable(table, activeView.config, {
  sorts: activeView.config?.sorts,
  filter: activeView.config?.filter,
});
```

where `activeView` in that callsite is the **real** activeView (not the effective one). So `useBaseTable` needs both: the effective view for seeding and rendering, and the real baseline for the persist path.

Simplest refactor: give `useBaseTable` an optional `baselineConfig?: ViewConfig` argument. If omitted (existing callers), behave as today. If provided, `persistViewConfig` uses `baselineConfig` for sort/filter overrides. `base-table.tsx` passes `activeView.config` as the baseline and the effective-wrapped view as the active.

This keeps `useBaseTable`'s own responsibilities tidy and makes the "drafts don't leak into the layout write-path" rule explicit.

**Note on `useBaseTable`'s re-seed effect:** A draft edit changes `effectiveView.config.filter/sorts`, which propagates through the `derivedColumnOrder` / `derivedColumnVisibility` memos and re-fires the sync effect at [use-base-table.ts:280](../../../apps/client/src/features/base/hooks/use-base-table.ts). This is harmless because (a) `activeView.id` is unchanged, so the full re-seed branch doesn't trigger, and (b) the `hasPendingEdit` branch preserves live column state when no layout mutation is pending, and adopts derived values otherwise — those derived values are still driven by the same `properties`, so they're content-equal. No action required, but worth naming so the implementer doesn't chase a non-issue.

## Banner component

**File:** `apps/client/src/features/base/components/base-view-draft-banner.tsx`

```ts
type BaseViewDraftBannerProps = {
  isDirty: boolean;
  canSave: boolean;
  onReset: () => void;
  onSave: () => void;
  saving: boolean;
};

export function BaseViewDraftBanner({ isDirty, canSave, onReset, onSave, saving }: BaseViewDraftBannerProps) {
  const { t } = useTranslation();
  if (!isDirty) return null;
  return (
    <Paper withBorder radius="sm" px="md" py="xs" /* soft bg per theme */>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <IconInfoCircle size={16} />
          <Text size="sm">{t("Filter and sort changes are visible only to you.")}</Text>
        </Group>
        <Group gap="sm" wrap="nowrap">
          <Button variant="subtle" color="gray" size="xs" onClick={onReset}>{t("Reset")}</Button>
          {canSave && (
            <Button size="xs" onClick={onSave} loading={saving}>{t("Save for everyone")}</Button>
          )}
        </Group>
      </Group>
    </Paper>
  );
}
```

Wiring in [base-table.tsx](../../../apps/client/src/features/base/components/base-table.tsx), inserted between the existing page chrome and `<BaseToolbar />`:

```ts
const { data: space } = useSpaceQuery(base?.spaceId ?? "");
const spaceAbility = useSpaceAbility(space?.membership?.permissions);
const canSave = spaceAbility.can(SpaceCaslAction.Edit, SpaceCaslSubject.Base);
const updateViewMutation = useUpdateViewMutation();
const handleSaveDraft = useCallback(async () => {
  if (!activeView || !base) return;
  const config = buildPromotedConfig(activeView.config);
  await updateViewMutation.mutateAsync({ viewId: activeView.id, baseId: base.id, config });
  reset();
  notifications.show({ message: t("View updated for everyone") });
}, [activeView, base, buildPromotedConfig, reset, updateViewMutation, t]);

return (
  <div style={{...}}>
    <BaseViewDraftBanner
      isDirty={isDirty}
      canSave={canSave}
      onReset={reset}
      onSave={handleSaveDraft}
      saving={updateViewMutation.isPending}
    />
    <BaseToolbar ... />
    <GridContainer ... />
  </div>
);
```

The `useSpaceQuery`/`useSpaceAbility` pair follows the same pattern as [use-history-restore.tsx:35-41](../../../apps/client/src/features/page-history/hooks/use-history-restore.tsx).

## Cross-tab sync

The draft hook subscribes to the browser `storage` event:

```ts
useEffect(() => {
  const handler = (e: StorageEvent) => {
    if (e.key !== storageKey) return;
    // e.newValue is the serialized draft or null if the key was removed.
    if (e.newValue === null) {
      setDraftState(null);
    } else {
      try {
        setDraftState(JSON.parse(e.newValue));
      } catch {
        setDraftState(null);
      }
    }
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}, [storageKey]);
```

The `storage` event fires in *other* tabs of the same origin when this tab writes (not in the writing tab itself), which is exactly what we need: the writing tab already updated its own state synchronously inside `setFilter`/`setSorts`, and the subscription catches the echo elsewhere.

No explicit rebroadcast is required — `localStorage.setItem` in the source tab triggers the storage event in every other tab automatically. The hook in those tabs re-parses and re-renders the table with updated draft values. React Query's row cache keyed by `(baseId, filter, sorts, search)` rehydrates the new filter/sort as a fresh infinite query, so rows reload via the normal path.

Edge case: two tabs editing simultaneously — both writes land in localStorage, each emits a storage event to the other, and the most recent write wins. This is acceptable given the single-user scope (multi-tab same-user).

## Save flow (pseudocode)

```ts
async function onSaveForEveryone() {
  if (!activeView || !base) return;
  // 1. Compose the promoted config from the server baseline + draft values.
  //    baseline is activeView.config (NOT effectiveView.config) because the
  //    baseline might include layout fields (propertyWidths, propertyOrder,
  //    hiddenPropertyIds, visiblePropertyIds) that we must preserve verbatim.
  const config: ViewConfig = {
    ...activeView.config,
    filter: draft.filter ?? activeView.config.filter,
    sorts: draft.sorts ?? activeView.config.sorts,
  };
  // 2. Fire the existing mutation. `updateViewMutation` already:
  //    - optimistically updates the ["bases", baseId] query cache
  //    - rolls back on error
  //    - writes the server response back on success
  await updateViewMutation.mutateAsync({ viewId: activeView.id, baseId: base.id, config });
  // 3. Clear the draft. Because the baseline has now caught up to what the
  //    draft said, isDirty flips to false and the banner unmounts.
  reset();
  notifications.show({ message: t("View updated for everyone") });
}
```

Error handling: `useUpdateViewMutation` already shows a red toast and rolls back the optimistic cache update on failure. We do *not* call `reset()` in that case — the draft stays, the banner stays, the user can retry.

## Dirty check

`isDirty` lives inside `useViewDraft`. Returns `true` iff the draft file exists AND at least one of these is true:

- `draft.filter !== undefined` AND `!deepEqualFilter(draft.filter, baselineFilter)`
- `draft.sorts !== undefined` AND `!deepEqualSorts(draft.sorts, baselineSorts)`

**Deep equality:** the codebase has no `lodash` or `fast-deep-equal` in [client package.json](../../../apps/client/package.json). Options:

1. **`JSON.stringify` both sides and compare strings.** Trivially correct for `FilterGroup` (a pure data tree) and `ViewSortConfig[]`. Key ordering inside objects is deterministic in V8+ for non-numeric keys, which is the case here. Pick this — it's 4 lines and good enough for this shape.
2. Hand-written structural compare — overkill for two types with known finite shapes.

Go with option 1. Helpers live in `use-view-draft.ts`:

```ts
function filterEq(a: FilterGroup | undefined, b: FilterGroup | undefined) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
function sortsEq(a: ViewSortConfig[] | undefined, b: ViewSortConfig[] | undefined) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
```

**Orphan suppression.** The agreed rule: when the draft's values equal the baseline, the banner hides. The dirty check above already does that — a draft with `filter: X` where baseline is also `X` yields `filterEq === true` for that axis, and if the sorts axis is also equal (or absent), `isDirty === false`. The key stays in localStorage (no eager GC), but the banner is invisible until the user next diverges or another tab updates the baseline.

## Testing

Per [CLAUDE.md](../../../CLAUDE.md), the client has no test infrastructure (no `vitest` in the workspace). This spec does not block on adding one. Testing is primarily manual QA + optional unit tests if Vitest is introduced alongside this feature.

### Unit tests (proposed, Vitest — gated on harness being added)

`use-view-draft.test.ts`:

- **Initialize with no stored value.** Hook returns `draft=null`, `isDirty=false`, effective values fall through to baseline.
- **`setFilter` writes to localStorage and updates state.** After `setFilter(X)`, `localStorage.getItem(key)` parses back to `{ filter: X, updatedAt: ... }`, `draft.filter === X`, `isDirty === true`.
- **`setSorts` writes independently.** `draft.filter` stays undefined even after `setSorts(...)`, and vice versa.
- **`setFilter(undefined)` then `setSorts(undefined)` removes the key.** After both axes are cleared, `localStorage.getItem(key)` is null.
- **`reset` clears both state and storage.**
- **Draft values equal to baseline → `isDirty === false` without clearing storage.** Set baseline to `B`, set draft filter to `B`, assert `isDirty === false` and `localStorage.getItem(key)` is still non-null (no eager GC).
- **Baseline change while draft exists.** Baseline shifts from `B1` to `B2`, draft filter is `X`. Effective filter stays `X`, `isDirty` stays `true`. Then baseline shifts again to `X` — `isDirty` flips to `false` without draft being cleared.
- **Cross-tab storage event.** Dispatch `new StorageEvent('storage', { key, newValue: JSON.stringify(newDraft) })`, assert hook state picks up the new draft. Dispatch with `newValue: null` and assert hook resets to `null`.
- **Malformed storage value.** Seed localStorage with garbage → hook reads `draft=null`, `isDirty=false`, table receives baseline.
- **`userId` missing → passthrough.** All setters are no-ops, `isDirty=false`, effective = baseline.

### Manual QA checklist

**Single user, single tab.**
- Apply a filter. Banner appears. Row list updates locally.
- Click Reset. Banner disappears. Filter in the popover reverts to baseline. Row list reverts.
- Apply a filter and a sort. Click Save for everyone. Banner disappears. Refresh the page — the filter/sort is now the new baseline (i.e. came back from the server).
- Apply a filter, then manually delete it via the filter popover. Banner disappears. Subsequent refresh does not restore the deleted filter (baseline untouched).

**Single user, multiple tabs.**
- Open base in tab A and tab B. In tab A, add a sort. Tab B re-renders with the same sort applied (verified by checking the sort popover badge and the row order). Tab B shows the banner.
- In tab B, click Reset. Tab A's banner disappears and sort reverts.

**Multi-user baseline race.**
- User X (editor) opens base. Applies a filter (draft). User Y (editor) in another session saves a brand-new baseline via their own Save flow. User X's client receives the websocket `base:schema:bumped` → `["bases", baseId]` invalidates → `activeView.config` updates. User X's `effectiveFilter` still shows X's draft filter (draft wins). Banner stays. No UI prompt. If X now clicks Reset, they see Y's new baseline.

**Permission gating.**
- As a space Viewer (who has Read but not Edit on `Base`): open base, apply a filter. Banner appears but shows only "Reset" — no "Save for everyone" button.
- Server check: attempting Save as a viewer would have been blocked by [base-view.controller.ts:68](../../../apps/server/src/core/base/controllers/base-view.controller.ts) anyway; the UI gate is belt-and-suspenders.

**Reset with popover open.**
- Open the filter popover and add conditions. Without closing the popover, click Reset (the banner is visible behind the popover dropdown — it's positioned above). Popover closes on outside-click, baseline conditions show next open.

**Save clears draft + updates server.**
- Save. Banner vanishes. localStorage key for `{user,base,view}` is absent. Re-open the base in an incognito/second-account browser — the filter/sort shows too (from the server).

**Browser storage cleared.**
- In DevTools, wipe `localStorage`. Base re-renders with baseline. Banner gone. Expected.

## Rollout

- **No DB migration.** No server change.
- **No feature flag.** Behavior change ships as-is.
- **No data migration.** Existing users have no drafts; the system starts empty.
- **Behavioral change vs. today.** Existing users' muscle memory is "touch a filter → auto-saves for everyone". After this ships, that becomes "touch a filter → only I see it until I hit Save for everyone". This is the entire point of the feature but will surprise power users on day one.
  - Mitigation: none in v1. A one-time popover/tooltip pointing at the banner ("New: filter and sort changes are now a draft until you save") is worth doing, but falls squarely in YAGNI territory for the first ship.
  - **Followup:** consider a dismissible one-time in-product hint the first time a user diverges from baseline after the deploy. Flag this as a follow-up task; do not ship with v1.

## Risks & open questions

- **localStorage quota.** `FilterGroup` + `ViewSortConfig[]` is tiny — a realistic draft is under 2KB. A worst-case malicious user with thousands of views could hit the 5–10MB per-origin cap, but practically negligible. No cleanup logic needed.
- **Users losing drafts via browser data clear.** Expected. The banner is a live indicator, not a durable source of truth. Flagged in non-goals.
- **Multi-device divergence.** Same user on laptop and phone: drafts don't sync. Expected and flagged.
- **Dropdown caret ("Save as new view") in the screenshot.** Explicitly out of scope for v1. If we add it, the caret menu would include:
  1. "Save for everyone" (current behavior)
  2. "Save as new view" (creates a new `IBaseView` with draft values baked into `config`)
- **Baseline layout fields overriding draft.** Save flow does `{ ...activeView.config, filter: X, sorts: Y }`. If another user changed column widths right before Save, those widths land in the Save's payload (we already read the latest optimistic cache). Acceptable — the alternative (send a sparse patch with only `{filter, sorts}`) would require a server-side partial-update endpoint we don't have.
- **Invalid draft for stale schema.** If a property is deleted while a user's draft references it by id, the predicate/sort engine on the server silently drops unknown property ids. Client-side, the sort/filter popover shows the condition with a missing-property label (existing behavior — the toolbar already does `properties.find((p) => p.id === …)` and tolerates the `undefined` case). No special handling needed here; the draft just falls away when the user next edits and doesn't re-add the dead condition.
- **`SpaceCaslSubject.Base` missing from client enum.** Single-line fix at [permissions.type.ts:12](../../../apps/client/src/features/space/permissions/permissions.type.ts). Flagged so reviewers notice.

## Future extension

1. **Draft column layout.** Extend the draft shape to carry `propertyWidths`, `propertyOrder`, `hiddenPropertyIds`, `visiblePropertyIds`. Column reorder / hide / resize call the draft hook instead of `persistViewConfig`. `useBaseTable` then seeds column state from effective values. Mechanically identical to filter/sort — the hook already takes arbitrary ViewConfig fragments. The only reason this isn't in v1 is to minimize behavioral change surface and keep the spec scope narrow.
2. **Server-side per-user drafts.** For cross-device sync, add a `base_view_drafts` table keyed by `(userId, viewId)` storing the same shape. The client hook swaps localStorage for a paired mutation + query. The banner UX stays identical.
3. **Split-button save.** Dropdown caret next to "Save for everyone" offering "Save as new view" — creates an `IBaseView` via `createView` with the effective config. Deepens the Notion parallel.
4. **Draft conflict hint.** When baseline changes while I have drafts, show a subtle "Baseline has changed since your last edit" line inside the banner with a "Discard draft and load latest" affordance. Expected to be low value in practice — flag once real users report it.
