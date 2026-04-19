# Base Cell Dropdown Keyboard Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add keyboard navigation (ArrowUp/Down/Home/End/Enter) to all four base cell dropdowns — `CellPerson`, `CellSelect`, `CellMultiSelect`, `CellStatus` — so users can pick values without a mouse, matching Mantine `MultiSelect`'s keyboard UX.

**Architecture:** All four cells use the same custom `Popover` + HTML dropdown pattern (not `useCombobox`). Instead of editing each in isolation, factor the shared logic (activeIndex, arrow/Home/End handling, reset-on-filter, scroll-into-view, option ref tracking) into one hook `useListKeyboardNav`. Each cell flattens its visible items into a single linear list (including the "Add option" row for select/multi, and flattening across status categories), passes the count to the hook, and wires up Enter selection locally.

**Tech Stack:** React 18, TypeScript, Mantine v8 `Popover` / `TextInput`, CSS Modules.

---

## Scope

**In scope:**
- `cell-person.tsx` — members, tag input with Backspace-removes-tag behavior.
- `cell-select.tsx` — single choice, optional "Add option" row.
- `cell-multi-select.tsx` — multi choice, optional "Add option" row.
- `cell-status.tsx` — single choice, grouped by category (flattened for nav).
- Shared hook `use-list-keyboard-nav.ts`.
- One new CSS class for keyboard-active highlight.

**Out of scope:**
- Swapping any cell to Mantine `MultiSelect` / `useCombobox` — too disruptive; all four have deliberate custom UIs.
- Automated tests — this codebase has no existing unit tests for base cells, and a harness just for this is scope creep. Task 7 is a manual QUX walkthrough.
- Other editors in the base feature (e.g., toolbar pickers, filter UIs) — out of scope unless they hit the same bug.

---

## File Structure

**Create:**
- `apps/client/src/features/base/hooks/use-list-keyboard-nav.ts` — shared hook.

**Modify:**
- `apps/client/src/features/base/styles/cells.module.css` — add `.selectOptionKeyboardActive`.
- `apps/client/src/features/base/components/cells/cell-person.tsx`
- `apps/client/src/features/base/components/cells/cell-select.tsx`
- `apps/client/src/features/base/components/cells/cell-multi-select.tsx`
- `apps/client/src/features/base/components/cells/cell-status.tsx`

**No other files touched.**

---

## Design Notes (read before coding)

### Why a hook and not copy-paste per cell

Four cells would get the same 40-line block. C-9 ("SHOULD NOT extract unless reused") is satisfied here — the logic is reused in 4 places, and diverging across them later would be a bug farm. The hook owns only the *navigation* concern (activeIndex, arrow keys, scroll). Each cell still owns its own Enter semantics, Escape, Backspace, and filter computation, because those diverge.

### Why `activeIndex: -1` initially

No highlight on open. First ArrowDown moves to 0. Enter at `-1` is a no-op — we don't guess, we don't commit. This matches Mantine MultiSelect behavior.

### Why a new CSS class instead of reusing `selectOptionActive`

`selectOptionActive` means "this item is currently selected" (blue). Keyboard nav needs a *separate* "Enter will land here" state or users can't tell which unselected option is focused. Add `selectOptionKeyboardActive` and stack it with `selectOptionActive` when both apply (selected + keyboard-focused uses a slightly darker blue).

### Flattening the nav list

- **cell-person:** `filteredMembers` (already flat).
- **cell-select / cell-multi-select:** `filteredChoices` plus one trailing "Add option" virtual entry when `showAddOption`. Arrow nav must include it; Enter on that index calls `handleAddOption()`. Represent as a discriminated union so Enter can dispatch correctly.
- **cell-status:** flatten `groups.flatMap(g => g.choices)`. Build a `Map<choiceId, flatIndex>` once per render and use it to attach refs and compute highlighting inside the grouped render loop.

### Mouse + keyboard sync

Mouse hover on an option sets `activeIndex` to that index. Prevents the "mouse hover shows A, keyboard focus is B, Enter selects B" mismatch. Applies to all four cells.

### `onMouseDown.preventDefault` on options

Without it, clicking an option can blur the input before `onClick` fires; in some browsers, Mantine's `trapFocus` + popover close sequence then cancels the selection. Mantine's `useCombobox` hides this — we don't use it, so add the guard. Applies to all four cells.

### Reset triggers

Reset `activeIndex` to `-1` whenever:
- the search string changes (filter changed → stale index)
- `isEditing` flips (reopening the editor)
- for cell-select/multi: whether the "Add option" row is visible, since that also changes the list length

Pass all three as `resetDeps` to the hook.

### Scroll into view

Dropdowns are capped at `max-height: 240px` with `overflow-y: auto` ([cells.module.css:219-222](apps/client/src/features/base/styles/cells.module.css:219)). Use `scrollIntoView({ block: "nearest" })` on the active option when `activeIndex` changes.

### Preserve existing behaviors

- **cell-person:** Escape cancels, Backspace on empty search removes last tag — keep both.
- **cell-select:** Escape cancels, Enter with `showAddOption` and no active index adds — keep the Enter-adds-when-no-nav fallback. Priority: if `activeIndex >= 0`, Enter uses that (which may itself be the add-option virtual entry). Else fall through to the existing `handleAddOption()` call if `showAddOption`.
- **cell-multi-select:** same as cell-select.
- **cell-status:** Escape cancels. No Add-option row. Enter with `activeIndex >= 0` selects.

---

## Task 1: Add keyboard-active CSS class

**Files:**
- Modify: `apps/client/src/features/base/styles/cells.module.css`

- [ ] **Step 1: Append after the existing `.selectOptionActive` rule (ending at line 240)**

```css
.selectOptionKeyboardActive {
  background-color: light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-5));
}

.selectOptionActive.selectOptionKeyboardActive {
  background-color: light-dark(var(--mantine-color-blue-1), var(--mantine-color-blue-8));
}
```

First rule: unselected + keyboard-focused (matches hover shade). Second: selected + keyboard-focused (slightly darker blue than plain selected, distinguishable).

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/features/base/styles/cells.module.css
git commit -m "style(base): add keyboard-active option style for cell dropdowns"
```

---

## Task 2: Create the `useListKeyboardNav` hook

**Files:**
- Create: `apps/client/src/features/base/hooks/use-list-keyboard-nav.ts`

- [ ] **Step 1: Write the hook**

```tsx
import { useCallback, useEffect, useRef, useState } from "react";

type UseListKeyboardNavResult = {
  activeIndex: number;
  setActiveIndex: (idx: number) => void;
  handleNavKey: (e: React.KeyboardEvent) => boolean;
  setOptionRef: (idx: number) => (el: HTMLElement | null) => void;
};

export function useListKeyboardNav(
  itemCount: number,
  resetDeps: ReadonlyArray<unknown>,
): UseListKeyboardNavResult {
  const [activeIndex, setActiveIndex] = useState(-1);
  const optionRefs = useRef<Array<HTMLElement | null>>([]);

  // Reset highlight when filter/open-state changes. resetDeps is intentional.
  useEffect(() => {
    setActiveIndex(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetDeps);

  useEffect(() => {
    if (activeIndex < 0) return;
    const el = optionRefs.current[activeIndex];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const setOptionRef = useCallback(
    (idx: number) => (el: HTMLElement | null) => {
      optionRefs.current[idx] = el;
    },
    [],
  );

  const handleNavKey = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (itemCount === 0) return false;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((idx) => (idx < itemCount - 1 ? idx + 1 : 0));
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((idx) => (idx <= 0 ? itemCount - 1 : idx - 1));
        return true;
      }
      if (e.key === "Home") {
        e.preventDefault();
        setActiveIndex(0);
        return true;
      }
      if (e.key === "End") {
        e.preventDefault();
        setActiveIndex(itemCount - 1);
        return true;
      }
      return false;
    },
    [itemCount],
  );

  return { activeIndex, setActiveIndex, handleNavKey, setOptionRef };
}
```

Notes:
- `handleNavKey` returns `true` if it handled the key, so callers can `if (nav.handleNavKey(e)) return;` before their own Enter/Escape/Backspace branches.
- Wrap-around on both ends.
- `resetDeps` uses an eslint-disable because it's a variadic dep array by design — the hook name and the `resetDeps` argument make the intent clear without a comment inside the body beyond the one-liner. This is the C-7-approved kind of caveat comment.

- [ ] **Step 2: Build verification**

Run: `pnpm nx run client:build`.
Expected: success, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/features/base/hooks/use-list-keyboard-nav.ts
git commit -m "feat(base): add useListKeyboardNav hook for dropdown keyboard nav"
```

---

## Task 3: Wire keyboard nav into `CellPerson`

**Files:**
- Modify: `apps/client/src/features/base/components/cells/cell-person.tsx`

- [ ] **Step 1: Import the hook**

Add to the imports at the top:

```tsx
import { useListKeyboardNav } from "@/features/base/hooks/use-list-keyboard-nav";
```

- [ ] **Step 2: Instantiate the hook**

After the `filteredMembers` declaration (currently ending line 61), add:

```tsx
const nav = useListKeyboardNav(filteredMembers.length, [search, isEditing]);
```

- [ ] **Step 3: Extend `handleKeyDown`**

Replace the existing `handleKeyDown` `useCallback` (lines 97–109) with:

```tsx
const handleKeyDown = useCallback(
  (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }
    if (nav.handleNavKey(e)) return;
    if (e.key === "Enter") {
      if (nav.activeIndex < 0 || nav.activeIndex >= filteredMembers.length) return;
      e.preventDefault();
      handleSelect(filteredMembers[nav.activeIndex].id);
      return;
    }
    if (e.key === "Backspace" && search === "" && personIds.length > 0) {
      e.preventDefault();
      handleRemove(personIds[personIds.length - 1]);
    }
  },
  [onCancel, nav, filteredMembers, handleSelect, search, personIds, handleRemove],
);
```

- [ ] **Step 4: Render the keyboard-active highlight, ref, hover sync, and mousedown guard**

Replace the filtered-members map (currently lines 173–191) with:

```tsx
{filteredMembers.map((member, idx) => {
  const isSelected = selectedSet.has(member.id);
  const isKeyboardActive = idx === nav.activeIndex;
  const className = [
    cellClasses.selectOption,
    isSelected ? cellClasses.selectOptionActive : "",
    isKeyboardActive ? cellClasses.selectOptionKeyboardActive : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      key={member.id}
      ref={nav.setOptionRef(idx)}
      className={className}
      onMouseEnter={() => nav.setActiveIndex(idx)}
      onMouseDown={(e) => {
        // Keep focus on the search input so click doesn't blur + close popover.
        e.preventDefault();
      }}
      onClick={() => handleSelect(member.id)}
    >
      <CustomAvatar
        avatarUrl={member.avatarUrl}
        name={member.name}
        size={24}
        radius="xl"
      />
      <span className={cellClasses.personOptionName}>
        {member.name}
      </span>
    </div>
  );
})}
```

- [ ] **Step 5: Build verification**

Run: `pnpm nx run client:build`.
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/features/base/components/cells/cell-person.tsx
git commit -m "feat(base): keyboard navigation for person cell dropdown"
```

---

## Task 4: Wire keyboard nav into `CellSelect`

**Files:**
- Modify: `apps/client/src/features/base/components/cells/cell-select.tsx`

Recall: this cell has `filteredChoices` plus a conditional "Add option" row when `showAddOption === true`. Both must be navigable. Enter on a choice selects it; Enter on the add-option virtual entry calls `handleAddOption`.

- [ ] **Step 1: Import the hook**

```tsx
import { useListKeyboardNav } from "@/features/base/hooks/use-list-keyboard-nav";
```

- [ ] **Step 2: Build the nav item list and instantiate the hook**

After the `showAddOption` declaration (currently line 71), add:

```tsx
type NavItem =
  | { kind: "choice"; choice: Choice }
  | { kind: "add" };

const navItems: NavItem[] = useMemo(
  () => [
    ...filteredChoices.map((c) => ({ kind: "choice" as const, choice: c })),
    ...(showAddOption ? [{ kind: "add" as const }] : []),
  ],
  [filteredChoices, showAddOption],
);

const nav = useListKeyboardNav(navItems.length, [search, isEditing, showAddOption]);
```

- [ ] **Step 3: Replace `handleKeyDown`**

Replace the existing `handleKeyDown` `useCallback` (currently lines 98–110) with:

```tsx
const handleKeyDown = useCallback(
  (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }
    if (nav.handleNavKey(e)) return;
    if (e.key === "Enter") {
      if (nav.activeIndex >= 0 && nav.activeIndex < navItems.length) {
        e.preventDefault();
        const item = navItems[nav.activeIndex];
        if (item.kind === "choice") handleSelect(item.choice);
        else handleAddOption();
        return;
      }
      if (showAddOption) {
        e.preventDefault();
        handleAddOption();
      }
    }
  },
  [onCancel, nav, navItems, handleSelect, handleAddOption, showAddOption],
);
```

- [ ] **Step 4: Update the choices render loop**

Replace the `filteredChoices.map` block (currently lines 146–161) with:

```tsx
{filteredChoices.map((choice, idx) => {
  const isSelected = choice.id === selectedId;
  const isKeyboardActive = idx === nav.activeIndex;
  const className = [
    cellClasses.selectOption,
    isSelected ? cellClasses.selectOptionActive : "",
    isKeyboardActive ? cellClasses.selectOptionKeyboardActive : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      key={choice.id}
      ref={nav.setOptionRef(idx)}
      className={className}
      onMouseEnter={() => nav.setActiveIndex(idx)}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={() => handleSelect(choice)}
    >
      <span
        className={cellClasses.badge}
        style={choiceColor(choice.color)}
      >
        {choice.name}
      </span>
    </div>
  );
})}
```

- [ ] **Step 5: Update the "Add option" row**

Replace the `showAddOption && (...)` block (currently lines 162–175) with:

```tsx
{showAddOption && (() => {
  const idx = filteredChoices.length;
  const isKeyboardActive = idx === nav.activeIndex;
  return (
    <div
      ref={nav.setOptionRef(idx)}
      className={`${cellClasses.addOptionRow} ${
        isKeyboardActive ? cellClasses.selectOptionKeyboardActive : ""
      }`}
      onMouseEnter={() => nav.setActiveIndex(idx)}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={handleAddOption}
    >
      <span className={cellClasses.addOptionLabel}>Add option:</span>
      <span
        className={cellClasses.badge}
        style={choiceColor(addOptionColor)}
      >
        {trimmedSearch}
      </span>
    </div>
  );
})()}
```

The IIFE is the least-disruptive way to introduce a local `idx` binding without restructuring the parent JSX.

- [ ] **Step 6: Build verification**

Run: `pnpm nx run client:build`.
Expected: success.

- [ ] **Step 7: Commit**

```bash
git add apps/client/src/features/base/components/cells/cell-select.tsx
git commit -m "feat(base): keyboard navigation for single-select cell dropdown"
```

---

## Task 5: Wire keyboard nav into `CellMultiSelect`

**Files:**
- Modify: `apps/client/src/features/base/components/cells/cell-multi-select.tsx`

This mirrors Task 4. Only differences: `handleSelect` is named `handleToggle`, selected check uses `selectedSet.has(...)`, and `handleAddOption` commits `[...selectedIds, newChoice.id]` rather than replacing.

- [ ] **Step 1: Import the hook**

```tsx
import { useListKeyboardNav } from "@/features/base/hooks/use-list-keyboard-nav";
```

- [ ] **Step 2: Build the nav item list and instantiate the hook**

After `showAddOption` (currently line 74), add:

```tsx
type NavItem =
  | { kind: "choice"; choice: Choice }
  | { kind: "add" };

const navItems: NavItem[] = useMemo(
  () => [
    ...filteredChoices.map((c) => ({ kind: "choice" as const, choice: c })),
    ...(showAddOption ? [{ kind: "add" as const }] : []),
  ],
  [filteredChoices, showAddOption],
);

const nav = useListKeyboardNav(navItems.length, [search, isEditing, showAddOption]);
```

- [ ] **Step 3: Replace `handleKeyDown`**

Replace lines 102–114 with:

```tsx
const handleKeyDown = useCallback(
  (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }
    if (nav.handleNavKey(e)) return;
    if (e.key === "Enter") {
      if (nav.activeIndex >= 0 && nav.activeIndex < navItems.length) {
        e.preventDefault();
        const item = navItems[nav.activeIndex];
        if (item.kind === "choice") handleToggle(item.choice);
        else handleAddOption();
        return;
      }
      if (showAddOption) {
        e.preventDefault();
        handleAddOption();
      }
    }
  },
  [onCancel, nav, navItems, handleToggle, handleAddOption, showAddOption],
);
```

- [ ] **Step 4: Update the choices render loop**

Replace `filteredChoices.map(...)` (currently lines 143–160) with:

```tsx
{filteredChoices.map((choice, idx) => {
  const isSelected = selectedSet.has(choice.id);
  const isKeyboardActive = idx === nav.activeIndex;
  const className = [
    cellClasses.selectOption,
    isSelected ? cellClasses.selectOptionActive : "",
    isKeyboardActive ? cellClasses.selectOptionKeyboardActive : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      key={choice.id}
      ref={nav.setOptionRef(idx)}
      className={className}
      onMouseEnter={() => nav.setActiveIndex(idx)}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={() => handleToggle(choice)}
    >
      <span
        className={cellClasses.badge}
        style={choiceColor(choice.color)}
      >
        {choice.name}
      </span>
    </div>
  );
})}
```

- [ ] **Step 5: Update the "Add option" row**

Replace `showAddOption && (...)` (currently lines 161–174) with the same IIFE pattern as Task 4:

```tsx
{showAddOption && (() => {
  const idx = filteredChoices.length;
  const isKeyboardActive = idx === nav.activeIndex;
  return (
    <div
      ref={nav.setOptionRef(idx)}
      className={`${cellClasses.addOptionRow} ${
        isKeyboardActive ? cellClasses.selectOptionKeyboardActive : ""
      }`}
      onMouseEnter={() => nav.setActiveIndex(idx)}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={handleAddOption}
    >
      <span className={cellClasses.addOptionLabel}>Add option:</span>
      <span
        className={cellClasses.badge}
        style={choiceColor(addOptionColor)}
      >
        {trimmedSearch}
      </span>
    </div>
  );
})()}
```

- [ ] **Step 6: Build verification**

Run: `pnpm nx run client:build`.
Expected: success.

- [ ] **Step 7: Commit**

```bash
git add apps/client/src/features/base/components/cells/cell-multi-select.tsx
git commit -m "feat(base): keyboard navigation for multi-select cell dropdown"
```

---

## Task 6: Wire keyboard nav into `CellStatus`

**Files:**
- Modify: `apps/client/src/features/base/components/cells/cell-status.tsx`

This cell renders choices grouped by category. Flatten the groups for nav indexing while keeping the grouped rendering.

- [ ] **Step 1: Import the hook**

```tsx
import { useListKeyboardNav } from "@/features/base/hooks/use-list-keyboard-nav";
```

- [ ] **Step 2: Flatten and instantiate the hook**

After the `groups` declaration (currently ending line 74), add:

```tsx
const flatChoices = useMemo(
  () => groups.flatMap((g) => g.choices),
  [groups],
);
const choiceIdxMap = useMemo(() => {
  const m = new Map<string, number>();
  flatChoices.forEach((c, i) => m.set(c.id, i));
  return m;
}, [flatChoices]);

const nav = useListKeyboardNav(flatChoices.length, [search, isEditing]);
```

- [ ] **Step 3: Replace `handleKeyDown`**

Replace lines 83–91 with:

```tsx
const handleKeyDown = useCallback(
  (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }
    if (nav.handleNavKey(e)) return;
    if (e.key === "Enter") {
      if (nav.activeIndex < 0 || nav.activeIndex >= flatChoices.length) return;
      e.preventDefault();
      handleSelect(flatChoices[nav.activeIndex]);
    }
  },
  [onCancel, nav, flatChoices, handleSelect],
);
```

- [ ] **Step 4: Update the choice render inside groups**

Replace the inner `group.choices.map(...)` block (currently lines 132–149) with:

```tsx
{group.choices.map((choice) => {
  const idx = choiceIdxMap.get(choice.id) ?? -1;
  const isSelected = choice.id === selectedId;
  const isKeyboardActive = idx === nav.activeIndex;
  const className = [
    cellClasses.selectOption,
    isSelected ? cellClasses.selectOptionActive : "",
    isKeyboardActive ? cellClasses.selectOptionKeyboardActive : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      key={choice.id}
      ref={nav.setOptionRef(idx)}
      className={className}
      onMouseEnter={() => nav.setActiveIndex(idx)}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={() => handleSelect(choice)}
    >
      <span
        className={cellClasses.badge}
        style={choiceColor(choice.color)}
      >
        {choice.name}
      </span>
    </div>
  );
})}
```

- [ ] **Step 5: Build verification**

Run: `pnpm nx run client:build`.
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/features/base/components/cells/cell-status.tsx
git commit -m "feat(base): keyboard navigation for status cell dropdown"
```

---

## Task 7: Manual QUX verification

No automated tests exist for cell components. Verify manually in a running dev client (only if the user asks — per CLAUDE.md, do not launch the client yourself).

For **each** of the four cells (person, select, multi-select, status), walk this checklist in the base grid:

**Golden path:**
1. Click the cell → popover opens, search focused, no initial highlight.
2. ArrowDown → first option highlights.
3. Repeat ArrowDown → highlight moves; dropdown scrolls past viewport.
4. Enter on highlight → that value is selected/toggled.
5. ArrowUp from index 0 → wraps to last item.
6. ArrowDown from last → wraps to first.

**Search + keyboard:**
7. Type a partial string → list filters, highlight resets.
8. ArrowDown → lands on first *filtered* option, not a stale index.
9. Clear the search → list expands, highlight resets.

**Mouse + keyboard interplay:**
10. Hover an option with mouse → that option becomes keyboard-active.
11. Move mouse away, press ArrowDown → nav continues from hovered index.
12. Click an option → selects cleanly, popover does not flicker-close (validates `onMouseDown.preventDefault`).

**Edge cases:**
13. Empty filter result → ArrowUp/Down/Home/End/Enter are no-ops; Escape still closes; cell-person's Backspace-removes-tag still works.
14. Home / End → jump to first / last item.
15. Escape at any time → popover closes, no commit.

**Cell-specific:**
- **cell-person** (multi mode): Backspace on empty search removes the last tag (existing behavior preserved).
- **cell-person** (single mode, `allowMultiple: false`): Enter still selects; selecting an already-selected person clears it.
- **cell-select** with typed new value: the "Add option" row appears as the last navigable item; ArrowDown reaches it and Enter triggers `handleAddOption`. Enter with no active index (user typed and hasn't pressed ArrowDown) still triggers `handleAddOption` (fallback preserved).
- **cell-multi-select**: same as cell-select for add-option behavior.
- **cell-status**: navigation crosses category boundaries seamlessly (To Do → In Progress → Complete).

**Visual:**
- Selected-only → blue.
- Keyboard-focused-only → gray.
- Both → darker blue (distinguishable from plain selected).

- [ ] **Step 1: Walk the checklist per cell. If any scenario fails, fix and re-verify that cell before moving on.**

---

## Remember

- Exact file paths above; don't grep for them at edit time.
- Preserve existing Escape/Backspace/Enter-adds-new behaviors verbatim.
- Don't swap to `useCombobox` — scope creep.
- One CSS class, one hook, four cell edits — that's the whole change.
- Commit after each task (GH-1, Conventional Commits).
- No Anthropic/Claude attribution in commits (undercover mode).
