# ⚠️ GOLDEN RULE — Fork Upstream Sync Policy

This repository is a **fork tracking an upstream project**. Upstream changes are merged/rebased into this fork periodically. **Minimizing diff against core (upstream-owned) code is the single most important constraint in this project — more important than code elegance, DRY, or "correct" architecture placement.**

## The rule

- **All new features, customizations, and behavior changes MUST be implemented under `apps/client/src/ee/` (or the equivalent `ee/` path for other apps/packages), NEVER by adding logic directly inside core/upstream files.**
- Core files (anything outside `ee/`) may only receive **minimal, mechanical hook-in points**: an import line, and a single line/prop wiring an `ee/` component or hook into the render tree or call site. No business logic, no new state, no new conditionals beyond what's needed to call into `ee/`.
- If a feature seems to require real logic inside a core file (e.g. a core function must branch based on new behavior), prefer exposing an extension point (a prop, a callback, a hook from `ee/`) over inlining the logic in core.
- This applies to ALL tasks — features, bug fixes, refactors — not just ones the user explicitly labels as "add to ee". Default to `ee/` unless the user explicitly says the change must be in core (e.g. fixing an actual upstream bug that must be patched at the source).

## Before writing any code, ask:

1. Can this be built as a new file/component/hook entirely inside `ee/`?
2. What is the absolute minimum touch to a core file needed to wire it in (ideally: one import + one line of usage)?
3. Am I adding any conditional, state, or business logic to a core file? If yes — stop and move it into `ee/`.

## Reference implementation

See `apps/client/src/ee/breadcrumb/space-breadcrumb-link.tsx` and its single-import wiring into `apps/client/src/features/page/components/breadcrumbs/breadcrumb.tsx` as the pattern to replicate: all logic (data fetching, rendering) lives in `ee/`; core only imports the component and drops it into the existing JSX.

## Reviewing a change before it's done

- Before finishing any task that touches a core file, re-check the diff: if it contains anything beyond an import statement and a trivial usage line, move that logic into `ee/` and re-wire.
- When in doubt about whether something counts as "core", ask the user rather than guessing.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **sc_doc** (15264 symbols, 36152 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/sc_doc/context` | Codebase overview, check index freshness |
| `gitnexus://repo/sc_doc/clusters` | All functional areas |
| `gitnexus://repo/sc_doc/processes` | All execution flows |
| `gitnexus://repo/sc_doc/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
