# Hide-Fields Popover Dismiss Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the hide-fields popover in the base toolbar dismiss on ESC and on outside click, matching the sort and filter popovers.

**Architecture:** One-line fix — the hide popover is missing `trapFocus` that the other two toolbar popovers already have. Mantine `Popover` only honours `closeOnEscape` when focus is trapped inside the dropdown, so without `trapFocus` the ESC key is never captured. We also make `closeOnClickOutside` and `closeOnEscape` explicit so the intent is clear and immune to future default changes.

**Tech Stack:** React, Mantine v8 `Popover`.

---

## Background

[apps/client/src/features/base/components/views/view-sort-config.tsx:86-93](apps/client/src/features/base/components/views/view-sort-config.tsx:86):

```tsx
<Popover
  opened={opened}
  onClose={onClose}
  position="bottom-end"
  shadow="md"
  width={340}
  trapFocus          // ← present
  withinPortal
>
```

[apps/client/src/features/base/components/views/view-filter-config.tsx:252-259](apps/client/src/features/base/components/views/view-filter-config.tsx:252) — same, has `trapFocus`.

[apps/client/src/features/base/components/views/view-field-visibility.tsx:65-72](apps/client/src/features/base/components/views/view-field-visibility.tsx:65):

```tsx
<Popover
  opened={opened}
  onClose={onClose}
  position="bottom-end"
  shadow="md"
  width={260}
  withinPortal       // ← no trapFocus
>
```

Mantine v8 defaults: `closeOnClickOutside=true`, `closeOnEscape=true`, `trapFocus=false`. ESC handling is wired to the trapped focus context; without `trapFocus` the ESC never fires `onClose`.

---

## File Structure

**Modified files:**
- `apps/client/src/features/base/components/views/view-field-visibility.tsx` — one `<Popover>` props edit.

No new files, no new deps, no tests (pure UI behaviour wiring; identical change pattern to the other two popovers already in production).

---

## Task 1: Enable focus trap + explicit dismiss flags

**Files:**
- Modify: `apps/client/src/features/base/components/views/view-field-visibility.tsx:65-72`

- [ ] **Step 1: Edit the Popover props**

Before:
```tsx
<Popover
  opened={opened}
  onClose={onClose}
  position="bottom-end"
  shadow="md"
  width={260}
  withinPortal
>
```

After:
```tsx
<Popover
  opened={opened}
  onClose={onClose}
  position="bottom-end"
  shadow="md"
  width={260}
  trapFocus
  closeOnEscape
  closeOnClickOutside
  withinPortal
>
```

- [ ] **Step 2: Build the client**

```bash
pnpm nx run client:build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/features/base/components/views/view-field-visibility.tsx
git commit -m "fix(base): dismiss hide-fields popover on escape and outside click"
```

---

## Task 2: USER smoke test

> ⚠️ **Do not run `pnpm dev` as an agent.** Hand off to the user.

Ask the user, with the dev server already running, to:

- [ ] Open a base → click the "Hide fields" (eye icon) button. Popover opens.
- [ ] Press ESC. Popover closes. ✓
- [ ] Open it again → click anywhere outside the popover (e.g. on the grid). Popover closes. ✓
- [ ] Open it → click a Switch inside. Column toggles. Popover stays open. ✓
- [ ] Open it → tab through with keyboard. Focus stays inside. ESC closes. ✓
- [ ] Regression: the sort and filter popovers still dismiss correctly on ESC + outside click.

If any step fails, report back; otherwise the fix is complete.

---

## Out of scope

- No refactor of the three popovers into a shared wrapper — `trapFocus` alone is the only behaviour diff, and the existing components are small and focused. Not worth abstracting three instances.
- No test added — Mantine `Popover` dismiss behaviour isn't something we own; testing it here would be testing the library.
