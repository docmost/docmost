---
name: codex-commit
description: Create categorized git commits with mandatory user approval, English Conventional Commit messages, trailing-whitespace cleanup, explicit staging, and strict exclusion of env files, secret files, selected assistant-tool files, and assistant attribution text. Use when the user asks to commit, git commit, categorized commit, split commits by area, or commit recent changes.
---

# Codex Commit

Use this skill whenever the user asks to commit current or recent work. The goal is to turn a mixed working tree into one or more small, reviewable commits while keeping user approval in control.

## Hard Rules

1. Never push.
2. Never use `git add .`, `git add -A`, `--no-verify`, `--force`, or destructive reset commands.
3. Do not delete files. If a file must be removed from its original path, move it to `./bak/<same-relative-path>` and commit the move only after approval.
4. Do not stage `.env`, `.env.*`, `*.key`, `*.pem`, `*.secret`, `credentials.*`, or other likely secret files.
5. Do not stage assistant-tool control files that the user has excluded, including the common uppercase markdown files for assistant-specific project memory.
6. Commit messages must be English and use exactly `<type>: <message>`.
7. Allowed types only: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `revert`.
8. Do not add assistant attribution or assistant-tool branding to commit messages or modified files.
9. Strip trailing spaces from every text file that will be staged before staging it.
10. Every commit needs manual user confirmation. Show details first, then wait for a clear affirmative before each `git commit`.

## Workflow

### 1. Gather State

Run these before planning:

```bash
git status --short
git diff --stat
git diff
git diff --staged
git log --oneline -10
```

Also list untracked files with:

```bash
git ls-files --others --exclude-standard
```

Avoid `git status -uall` in large repos.

### 2. Classify Files

Classify by both path and content:

| Bucket | Typical files | Commit type |
|---|---|---|
| Backend feature code | server source, APIs, services, repositories, modules | `feat` / `fix` / `refactor` |
| Frontend feature code | client source, UI, pages, components, styles with behavior | `feat` / `fix` / `refactor` |
| Tests | `*.spec.*`, `*.test.*`, `tests/**`, `__tests__/**` | `test` |
| Docs | `docs/**`, `*.md`, generated design references | `docs` |
| Config and tooling | `.gitignore`, package manifests, docker files, build config | `chore` |
| Excluded | env files, secrets, generated data, assistant-tool control files, user-unrelated old changes | do not stage |

Split commits by concern. If one message needs "and" to describe the change, split it.

Preferred order:

1. Recent backend code
2. Recent frontend code
3. Tests
4. Docs
5. Config/tooling

If the user asks for recent changes only, prefer files whose content and paths clearly belong to the recent task. Leave unrelated older changes unstaged.

### 3. Pre-Commit Hygiene

For each planned file:

1. Scan for excluded attribution or assistant-tool branding. If found, show the match location and do not stage until the user decides whether to remove or skip it.
2. Strip trailing spaces from text files.
3. Re-run focused tests or lint commands when practical. If checks fail, stop before committing and report the failure.

Never silently stage already-staged files you did not classify. If the index is not empty, report it in the plan.

### 4. Show Commit Details

Before any commit, show:

```text
Commit N - type: message
Files:
  - path/to/file
Diff summary:
  ...
Checks:
  ...
Skipped:
  - path (reason)

Approve this commit? (Y/yes/go/ok/confirm)
```

Stop after showing the details. Do not stage or commit until the user clearly approves that specific commit.

### 5. Stage and Commit

After approval, stage only the listed files:

```bash
git add path/to/file path/to/other-file
git diff --staged --stat
git commit -m "type: message"
```

After each commit, run:

```bash
git status --short
git log --oneline -1
```

Then show the next commit details and ask again. Repeat until all approved commits are done.

### 6. Final Report

Report:

- commits created, with short hashes and messages
- files intentionally skipped
- checks run and any checks not run
- confirmation that nothing was pushed
