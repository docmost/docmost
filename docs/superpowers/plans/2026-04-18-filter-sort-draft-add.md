# Draft-Then-Save Flow for New Sort / Filter Entries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking "Add sort" / "Add filter" no longer persists an incomplete entry to the view config; instead it opens a local draft row with Save / Cancel buttons so the user sets everything up in one go and commits once.

**Architecture:** Each popover (`ViewSortConfigPopover`, `ViewFilterConfigPopover`) gets local `draft` state. When non-null, a draft row renders at the bottom with property/direction (or property/operator/value) selects and Save/Cancel buttons. Save appends the draft to the existing `sorts` / `conditions` array via the existing `onChange` callback — a single mutation round-trip. Cancel clears the draft. Existing rows keep their current inline auto-save behavior (out of scope — they're already workable).

**Tech Stack:** React 18, Mantine v8 (`Popover`, `Select`, `Button`), existing `onChange` contract on both popovers (no changes to parents).

---

## Background

Current sort flow ([`view-sort-config.tsx:47-52`](apps/client/src/features/base/components/views/view-sort-config.tsx:47)):

```ts
const handleAdd = useCallback(() => {
  const usedIds = new Set(sorts.map((s) => s.propertyId));
  const available = properties.find((p) => !usedIds.has(p.id));
  if (!available) return;
  onChange([...sorts, { propertyId: available.id, direction: "asc" }]);
}, [sorts, properties, onChange]);
```

Clicking "Add sort" immediately calls `onChange` with a default-populated entry — that fires a mutation. The user then picks property → mutation. Picks direction → mutation. Four round-trips for one configured sort.

Filter is the same shape ([`view-filter-config.tsx:176-187`](apps/client/src/features/base/components/views/view-filter-config.tsx:176)).

## Desired behavior

1. Click "Add sort" / "Add filter" → draft row appears locally, NOT persisted yet.
2. User picks property, direction/operator, value in the draft row.
3. Click **Save** → draft is appended to `sorts` / `conditions` via `onChange` (one mutation). Draft clears.
4. Click **Cancel** → draft clears, nothing persisted.
5. While a draft is open, the "Add" button is hidden (or shown as "+ Save draft first").
6. Closing the popover (outside click / ESC) with a draft open: the draft is discarded silently. (Matches how Notion / Airtable treat incomplete-and-abandoned filter drafts.)
7. Existing entries continue to auto-save on inline edit — unchanged.

## File Structure

**Modified:**
- `apps/client/src/features/base/components/views/view-sort-config.tsx`
- `apps/client/src/features/base/components/views/view-filter-config.tsx`

No new files, no new deps, no server changes.

---

## Task 1: Sort popover — draft-then-save

**File:** `apps/client/src/features/base/components/views/view-sort-config.tsx`

### Design

Add local state:
```ts
const [draft, setDraft] = useState<ViewSortConfig | null>(null);
```

- On "Add sort" click: compute a sensible default (first unused property, `"asc"`) and call `setDraft(...)`. Do NOT call `onChange`.
- Render the draft row after the committed rows when `draft !== null`. It looks identical to a committed row but the property/direction selects bind to draft state via `setDraft`, and there are **Save** and **Cancel** buttons instead of a Trash icon.
- Save: `onChange([...sorts, draft]); setDraft(null);`
- Cancel: `setDraft(null);`
- When the popover closes (`opened` transitions `true → false`), auto-clear the draft via effect.
- Hide the "Add sort" button while a draft is open.

### Step 1: Add `useState` + `useEffect` imports

The file currently imports `useCallback` only. Replace with `useCallback, useEffect, useState`:

```ts
import { useCallback, useEffect, useState } from "react";
```

### Step 2: Import `Button`

Add `Button` to the existing `@mantine/core` import block so the draft can show Save/Cancel buttons.

### Step 3: Replace the component body

Read the current component carefully (lines 27-153) and replace it with:

```tsx
export function ViewSortConfigPopover({
  opened,
  onClose,
  sorts,
  properties,
  onChange,
  children,
}: ViewSortConfigProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ViewSortConfig | null>(null);

  // Discard any half-configured draft when the popover closes.
  useEffect(() => {
    if (!opened) setDraft(null);
  }, [opened]);

  const propertyOptions = properties.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const directionOptions = [
    { value: "asc", label: t("Ascending") },
    { value: "desc", label: t("Descending") },
  ];

  const handleStartDraft = useCallback(() => {
    const usedIds = new Set(sorts.map((s) => s.propertyId));
    const available = properties.find((p) => !usedIds.has(p.id));
    if (!available) return;
    setDraft({ propertyId: available.id, direction: "asc" });
  }, [sorts, properties]);

  const handleSaveDraft = useCallback(() => {
    if (!draft) return;
    onChange([...sorts, draft]);
    setDraft(null);
  }, [draft, sorts, onChange]);

  const handleCancelDraft = useCallback(() => {
    setDraft(null);
  }, []);

  const handleRemove = useCallback(
    (index: number) => {
      onChange(sorts.filter((_, i) => i !== index));
    },
    [sorts, onChange],
  );

  const handlePropertyChange = useCallback(
    (index: number, propertyId: string | null) => {
      if (!propertyId) return;
      onChange(
        sorts.map((s, i) => (i === index ? { ...s, propertyId } : s)),
      );
    },
    [sorts, onChange],
  );

  const handleDirectionChange = useCallback(
    (index: number, direction: string | null) => {
      if (!direction) return;
      onChange(
        sorts.map((s, i) =>
          i === index
            ? { ...s, direction: direction as "asc" | "desc" }
            : s,
        ),
      );
    },
    [sorts, onChange],
  );

  const canAddMore = properties.length > sorts.length + (draft ? 1 : 0);

  return (
    <Popover
      opened={opened}
      onClose={onClose}
      position="bottom-end"
      shadow="md"
      width={340}
      trapFocus
      withinPortal
    >
      <Popover.Target>{children}</Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Text size="xs" fw={600} c="dimmed">
            {t("Sort by")}
          </Text>

          {sorts.length === 0 && !draft && (
            <Text size="xs" c="dimmed">
              {t("No sorts applied")}
            </Text>
          )}

          {sorts.map((sort, index) => (
            <Group key={index} gap="xs" wrap="nowrap">
              <Select
                size="xs"
                data={propertyOptions}
                value={sort.propertyId}
                onChange={(val) => handlePropertyChange(index, val)}
                style={{ flex: 1 }}
              />
              <Select
                size="xs"
                data={directionOptions}
                value={sort.direction}
                onChange={(val) => handleDirectionChange(index, val)}
                w={110}
              />
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => handleRemove(index)}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Group>
          ))}

          {draft && (
            <Stack gap={6}>
              <Group gap="xs" wrap="nowrap">
                <Select
                  size="xs"
                  data={propertyOptions}
                  value={draft.propertyId}
                  onChange={(val) =>
                    val && setDraft({ ...draft, propertyId: val })
                  }
                  style={{ flex: 1 }}
                />
                <Select
                  size="xs"
                  data={directionOptions}
                  value={draft.direction}
                  onChange={(val) =>
                    val &&
                    setDraft({
                      ...draft,
                      direction: val as "asc" | "desc",
                    })
                  }
                  w={110}
                />
              </Group>
              <Group justify="flex-end" gap="xs">
                <Button
                  variant="default"
                  size="xs"
                  onClick={handleCancelDraft}
                >
                  {t("Cancel")}
                </Button>
                <Button size="xs" onClick={handleSaveDraft}>
                  {t("Save")}
                </Button>
              </Group>
            </Stack>
          )}

          {!draft && canAddMore && (
            <UnstyledButton
              onClick={handleStartDraft}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 0",
                fontSize: "var(--mantine-font-size-xs)",
                color: "var(--mantine-color-blue-6)",
              }}
            >
              <IconPlus size={14} />
              {t("Add sort")}
            </UnstyledButton>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
```

### Step 4: Build

```bash
pnpm nx run client:build
```

Expected: success. `IconSortAscending` import becomes unused — remove it from the import line.

### Step 5: Commit

```bash
git add apps/client/src/features/base/components/views/view-sort-config.tsx
git commit -m "feat(base): draft flow with save and cancel for new view sorts"
```

---

## Task 2: Filter popover — draft-then-save

**File:** `apps/client/src/features/base/components/views/view-filter-config.tsx`

### Design

Same shape as sort, with additional operator / value fields in the draft row. The `FilterValueInput` sub-component works as-is since it takes a `FilterCondition` and an `onChange(value)` — we pass the draft as the condition and a setter that updates the draft.

Edge case: when the user changes the draft's **property**, the valid operator set changes. Mirror the existing `handlePropertyChange` logic: keep the current operator if still valid, otherwise reset to the first valid operator and clear the value.

### Step 1: Add `useState, useEffect` to the react import

Current: `import { useCallback } from "react";`. Change to:
```ts
import { useCallback, useEffect, useState } from "react";
```

### Step 2: Add `Button` to the `@mantine/core` import

### Step 3: Add three draft helpers inside the component

After the existing `propertyOptions` declaration and before `handleAdd`, add:

```ts
const [draft, setDraft] = useState<FilterCondition | null>(null);

useEffect(() => {
  if (!opened) setDraft(null);
}, [opened]);

const handleStartDraft = useCallback(() => {
  const firstProperty = properties[0];
  if (!firstProperty) return;
  const validOperators = getOperatorsForType(firstProperty.type);
  const defaultOperator = validOperators.includes("contains")
    ? ("contains" as FilterOperator)
    : validOperators[0];
  setDraft({ propertyId: firstProperty.id, op: defaultOperator });
}, [properties]);

const handleSaveDraft = useCallback(() => {
  if (!draft) return;
  onChange([...conditions, draft]);
  setDraft(null);
}, [draft, conditions, onChange]);

const handleCancelDraft = useCallback(() => {
  setDraft(null);
}, []);

const handleDraftPropertyChange = useCallback(
  (propertyId: string | null) => {
    if (!propertyId || !draft) return;
    const newProperty = properties.find((p) => p.id === propertyId);
    if (!newProperty) {
      setDraft({ ...draft, propertyId });
      return;
    }
    const validOperators = getOperatorsForType(newProperty.type);
    const currentOperatorValid = validOperators.includes(draft.op);
    setDraft({
      ...draft,
      propertyId,
      op: currentOperatorValid ? draft.op : validOperators[0],
      value: currentOperatorValid ? draft.value : undefined,
    });
  },
  [draft, properties],
);

const handleDraftOperatorChange = useCallback(
  (operator: string | null) => {
    if (!operator || !draft) return;
    const op = operator as FilterOperator;
    const needsValue = !NO_VALUE_OPERATORS.includes(op);
    setDraft({ ...draft, op, value: needsValue ? draft.value : undefined });
  },
  [draft],
);

const handleDraftValueChange = useCallback(
  (value: string) => {
    if (!draft) return;
    setDraft({ ...draft, value: value || undefined });
  },
  [draft],
);
```

### Step 4: Replace the existing `handleAdd` function

Delete the existing `handleAdd` declaration entirely — `handleStartDraft` replaces it.

### Step 5: Render the draft row and hide the Add button when drafting

Find the `<UnstyledButton onClick={handleAdd} ...>` at the bottom of the dropdown (around line 325-338). Replace it with:

```tsx
{draft && (() => {
  const needsValue = !NO_VALUE_OPERATORS.includes(draft.op);
  const property = properties.find((p) => p.id === draft.propertyId);
  const validOperators = property
    ? getOperatorsForType(property.type)
    : OPERATORS.map((op) => op.value);
  const operatorOptions = OPERATORS.filter((op) =>
    validOperators.includes(op.value),
  ).map((op) => ({ value: op.value, label: t(op.labelKey) }));

  return (
    <Stack gap={6}>
      <Group gap="xs" wrap="nowrap">
        <Select
          size="xs"
          data={propertyOptions}
          value={draft.propertyId}
          onChange={handleDraftPropertyChange}
          style={{ flex: 1 }}
        />
        <Select
          size="xs"
          data={operatorOptions}
          value={draft.op}
          onChange={handleDraftOperatorChange}
          w={130}
        />
        {needsValue && (
          <FilterValueInput
            condition={draft}
            property={property}
            onChange={handleDraftValueChange}
            t={t}
          />
        )}
      </Group>
      <Group justify="flex-end" gap="xs">
        <Button variant="default" size="xs" onClick={handleCancelDraft}>
          {t("Cancel")}
        </Button>
        <Button size="xs" onClick={handleSaveDraft}>
          {t("Save")}
        </Button>
      </Group>
    </Stack>
  );
})()}

{!draft && (
  <UnstyledButton
    onClick={handleStartDraft}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 0",
      fontSize: "var(--mantine-font-size-xs)",
      color: "var(--mantine-color-blue-6)",
    }}
  >
    <IconPlus size={14} />
    {t("Add filter")}
  </UnstyledButton>
)}
```

### Step 6: Update the empty-state text conditional

The existing `{conditions.length === 0 && <Text ...>No filters applied</Text>}` should also hide when a draft is open — change to:

```tsx
{conditions.length === 0 && !draft && (
  <Text size="xs" c="dimmed">
    {t("No filters applied")}
  </Text>
)}
```

### Step 7: Build

```bash
pnpm nx run client:build
```

Expected: success.

### Step 8: Commit

```bash
git add apps/client/src/features/base/components/views/view-filter-config.tsx
git commit -m "feat(base): draft flow with save and cancel for new view filters"
```

---

## Task 3: USER smoke test

> ⚠️ **Do not run `pnpm dev` as an agent.** Hand off.

Ask the user to:

- [ ] **Sort: draft flow works.**
  1. Open the Sort popover. Click "Add sort".
  2. A draft row appears with Save / Cancel. The "Add sort" button is hidden.
  3. Pick a property, pick direction.
  4. Network tab stays quiet (no mutation yet).
  5. Click Save. A single `POST /bases/views/update` fires. The sort appears as a committed row; Save/Cancel row is gone; the "Add sort" button reappears.

- [ ] **Sort: cancel discards without mutation.**
  1. Click "Add sort". Configure something in the draft.
  2. Click Cancel. No mutation fires. Draft disappears.

- [ ] **Sort: closing popover with open draft discards it.**
  1. Click "Add sort". Click outside the popover (or press ESC).
  2. Popover closes. Re-open it — no draft, no committed new sort, no mutation was fired.

- [ ] **Sort: existing rows still auto-save.**
  1. After committing a sort, change its direction via its Select. The usual mutation fires as before.

- [ ] **Sort: max-reached hides Add button.**
  1. Add sorts until every property is used. The "Add sort" button should disappear (`canAddMore` is false).

- [ ] **Filter: repeat the same five checks.** Also verify:
  - Changing the draft's property resets the operator when incompatible (e.g., start with `contains` on text, switch property to a number → operator becomes `eq`).
  - "Is empty" / "Is not empty" operators hide the value field in the draft.

- [ ] **Regression: existing sorts/filters still load correctly on page load.**

Report back if any step misbehaves.

---

## Out of scope

- Edit-mode for existing rows (also behind Save/Cancel). User didn't ask for this; existing inline auto-save is fine.
- Batching multiple quick edits on existing rows into a single mutation (a debounce like the hide flow has). Separate optimization.
- Adding a "reorder sorts" UI — unrelated.
- Any server-side change. The `onChange` contract is unchanged from the popovers' parents' perspective (`base-toolbar.tsx`).
