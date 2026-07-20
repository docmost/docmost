# Page Review Workflow — Design

Status: draft (approved by user in chat, pending final spec review)
Owner: EE (`page-verification` module)
Golden rule: all business logic lives under `apps/server/src/ee/page-verification` and `apps/client/src/ee/page-verification`; core files receive at most a hook-in import/line.

## 1. Problem

Contributors write documents that need sign-off from a designated reviewer before they're trusted. Today, `apps/server/src/ee/page-verification` already implements a QMS-style approval flow (`draft → in_approval → approved/obsolete`, verifiers, rejection comment, notifications) but lacks:

- A "Need Clarify" outcome distinct from Reject.
- Gating review actions on unresolved comments.
- A dedicated review page (inline + page comments, full document view).
- Automatic re-verification when an already-`approved` page is edited.

This design extends the existing QMS flow rather than building a parallel system.

## 2. State machine — multi-reviewer, unanimous approval required

A `page_verification` record can have **multiple verifiers**. The overall document status is an *aggregate* over each verifier's individual decision for the current review cycle, not a single shared field:

- **All** verifiers must `approve` for the record to become `approved`.
- **Any single** `reject` or `request-clarification` from any one verifier immediately flips the whole cycle — the other verifiers' pending/approved decisions for that cycle become moot, and the contributor must address it and resubmit.

```
draft --(submit, requires 0 unresolved comments)--> in_approval
                                                       (all verifier decisions reset to 'pending')

in_approval, per verifier decision:
  approve            -> if this was the LAST pending verifier to approve: record status -> approved
                         else: record stays in_approval, this verifier's decision recorded, others still pending
  reject              -> record status -> draft immediately (rejectedAt/rejectedById/rejectionComment
                         set from THIS verifier); other verifiers' pending decisions are discarded
  request-clarification -> record status -> needs_clarification immediately (same discard rule)

needs_clarification --(all comments resolved, contributor submits again)--> in_approval (fresh decision set)
draft (after reject) --(contributor edits + resolves comments, submits again)--> in_approval (fresh decision set)
approved --(page content changes, new page_history version)--> new page_verification row, status=draft
approved --(manual)--> obsolete
```

**First-decisive-action-wins**: reject/need-clarify is not "voted" — the first verifier to submit either one ends the cycle for everyone. This mirrors real review processes (one blocking objection is enough) and avoids needing a quorum/tie-break rule. If two verifiers submit conflicting decisions in a race, the DB update is guarded by `WHERE status = 'in_approval'` so only the first write applies; the second gets a 409/400 "cycle already resolved" instead of corrupting state.

Reviewer's available actions are still gated server-side (and mirrored client-side) by unresolved-comment count on the page at action time:

- Unresolved comments > 0 → only `request-clarification` allowed.
- Unresolved comments == 0 → only `approve` / `reject` allowed.

"Send for Review" (draft → in_approval) is blocked entirely while unresolved comments exist, regardless of who is reviewer.

## 3. Data model changes

### 3.1 `page_verifications` (existing EE table, QMS rows only unless noted)

| Column | Type | Notes |
|---|---|---|
| `status` | enum | add `needs_clarification` to existing `draft \| in_approval \| approved \| obsolete`. This is the **aggregate** status (§2), not any single reviewer's decision. |
| `pageHistoryId` | uuid, nullable, FK `page_history.id` | version under review, set on submit |
| `submittedAt` | timestamp, nullable | when the current review cycle started; also used to scope which `page_verification_reviews` rows belong to the current cycle |
| `rejectedAt` / `rejectedById` / `rejectionComment` | (existing) | set from whichever verifier's reject decisively ended the cycle |
| `clarificationRequestedAt` | timestamp, nullable | |
| `clarificationRequestedById` | uuid, nullable, FK `users.id` | set from whichever verifier's request-clarification decisively ended the cycle |

No `clarificationComment` field: `request-clarification` is only reachable when ≥1 unresolved comment already exists (§2 gate), so the substance always lives in the comment thread. A separate free-text field would duplicate that and encourage bypassing the comment mechanic.

Multiplicity change: a page may have **multiple** `page_verification` rows over time (one per submit-cycle after an approved version is edited), instead of the current 1:1 enforced by `setup()`. The "current" status shown to users is the row with the latest `createdAt`/`pageHistoryId` for that `pageId`. Historical rows (previous `approved` cycles) are kept for audit, surfaced in `verified-pages.tsx` history view.

### 3.2 `page_verification_reviews` (new table — per-verifier decision for the current cycle)

Tracks each verifier's individual decision within one `page_verification` row's *current* review cycle. Reset (rows deleted or superseded) every time `submit` starts a fresh cycle — per the "all verifiers re-approve from scratch" decision, there is no need to retain a per-verifier row across cycles; only the terminal outcome of a past cycle matters for audit, and that already lives on `page_verifications` (§3.1) plus the historical rows themselves.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `pageVerificationId` | uuid, FK `page_verifications.id` | |
| `verifierId` | uuid, FK `users.id` | |
| `decision` | enum `pending \| approved \| rejected \| needs_clarification` | starts `pending` on submit |
| `decidedAt` | timestamp, nullable | |
| `createdAt` | timestamp | |

On `submit`: delete existing rows for this `pageVerificationId` (or reuse the row set from `replaceVerifiers`) and insert one `pending` row per current verifier — same transaction as the `status → in_approval` update.

Aggregation rule (computed in `PageVerificationService`, not stored redundantly): `page_verifications.status` becomes `approved` when the `approve` action detects zero remaining `pending` rows for that cycle; becomes `draft`/`needs_clarification` immediately on the first `reject`/`request-clarification`, using an atomic `UPDATE ... WHERE status = 'in_approval'` guard (§2) so a race between two verifiers' decisive actions can't double-apply.

Migration: `apps/server/src/database/migrations/<timestamp>-add-page-review-fields.ts` (new file, standard Kysely migration — not a core touch, this directory is shared infra for all modules including EE, per existing `page-verification` migrations already living there).

## 4. Content-change → re-verification trigger

Requirement: no business logic inside core files that create `page_history` rows.

Mechanism: `apps/server/src/common/events/event.contants.ts` already declares `EventName.PAGE_CONTENT_UPDATED = 'page-content-updated'`, but nothing emits it today. `apps/server/src/collaboration/processors/history.processor.ts` (core) is the single place that saves a `page_history` row *only when content actually changed* (`isDeepStrictEqual(lastHistory.content, page.content)` check, line ~69-81). The core touch is exactly the golden-rule reference pattern — one constructor-injected dependency (`EventEmitter2`, already a NestJS-standard import, no new abstraction) and one emit call, no new conditional:

```ts
const savedHistory = await this.pageHistoryRepo.saveHistory(page, { contributorIds });
this.eventEmitter.emit(EventName.PAGE_CONTENT_UPDATED, {
  pageId, spaceId: page.spaceId, workspaceId: page.workspaceId, historyId: savedHistory.id,
});
```

`EventEmitter2` is pub/sub (unlike the `QueueJob.PAGE_HISTORY`/`PAGE_UPDATED` BullMQ jobs already consumed exactly once each by `HistoryProcessor`/`NotificationProcessor` — those can't gain a second consumer). Multiple independent listeners on one event already has precedent: `apps/server/src/database/listeners/page.listener.ts` listens on `EventName.PAGE_UPDATED` today.

Handler (EE, `apps/server/src/ee/page-verification/page-content-updated.listener.ts`, `@OnEvent(EventName.PAGE_CONTENT_UPDATED)`):
1. Look up latest `page_verification` row for `pageId`.
2. If `status === 'approved'`, insert a new `page_verification` row: `status='draft'`, `pageHistoryId` = new history id, verifiers copied from the previous row's `page_verification_verifiers`.
3. Emit `PAGE_REVERIFICATION_REQUIRED_NOTIFICATION` to the previous verifiers — additive `case` in the already EE-routed notification switch (see §7), plus one EE service method mirroring the existing `PAGE_APPROVAL_REQUESTED_NOTIFICATION` handler. In scope (not skipped): a verifier should know a page they approved regressed to unverified.

## 5. API surface (EE controller, `page-verification.controller.ts`)

All under existing `/page-verification` prefix.

- `POST /page-verification/submit` — draft → in_approval. 400 if unresolved comments > 0 on the page. Sets `submittedAt`, `pageHistoryId` (current live content's latest history id), and (re)creates one `pending` row per verifier in `page_verification_reviews` for this fresh cycle.
- `POST /page-verification/approve` — records this verifier's `page_verification_reviews` row as `approved`. 400 if unresolved comments > 0, 403 if not this verifier's pending decision, 409 if the cycle was already decisively closed by another verifier (race guard, §2). If this was the last `pending` row for the cycle, also flips `page_verifications.status → approved` in the same transaction; otherwise the aggregate status stays `in_approval` and other verifiers remain pending.
- `POST /page-verification/reject` — Body: `{ comment: string }`, required. Records this verifier's decision as `rejected` and immediately flips `page_verifications.status → draft` (`rejectedAt/rejectedById/rejectionComment` from this verifier), regardless of other verifiers' pending/already-approved decisions for the cycle. 409 if the cycle is already closed.
- `POST /page-verification/request-clarification` — 400 if unresolved comments == 0 (nothing to clarify). Records this verifier's decision as `needs_clarification` and immediately flips `page_verifications.status → needs_clarification`. 409 if the cycle is already closed.
- `GET /page-verification/:pageId/review` — review page payload: verification detail (current + brief history), page content at `pageHistoryId`, comment list (inline + page, resolved + unresolved), full per-verifier decision breakdown (`page_verification_reviews` rows — who approved, who's still pending), `permissions.isReviewer`.

Server is the source of truth for action legality; client-side disabling is UX only. All decisive-action endpoints (`approve` when it closes the cycle, `reject`, `request-clarification`) use `UPDATE page_verifications SET status = $new WHERE id = $id AND status = 'in_approval'` and check `rowCount`, returning 409 if zero rows updated — this is the concurrency guard from §2, not optimistic-locking scaffolding for a hypothetical case.

## 6. Frontend

- New route + page: `apps/client/src/ee/page-verification/pages/review-page.tsx`, path e.g. `/review/:pageId`. Composed of:
  - Read-only document render (reuse core page content renderer).
  - `CommentSidebar` (existing component, already supports inline `selection` + page-level comments and resolve action).
  - `ReviewActionBar` — 3 buttons; `Approve`/`Reject` enabled together, `Need Clarify` enabled alone, mutually exclusive based on live unresolved-comment count (poll/subscribe via existing comment query). Buttons reflect *this* reviewer's own pending/decided state (a reviewer who already acted this cycle sees their decision, not the buttons again) and only apply to their own `page_verification_reviews` row.
  - Reject click → modal requiring non-empty reason before submit.
  - `ReviewerProgress` — small list of all verifiers with their per-cycle decision (pending/approved/rejected/needs_clarification), sourced from `GET .../review`'s decision breakdown, so a reviewer can see "waiting on 2 of 3" before or after acting.
- `page-verification-modal.tsx` / `manage-verification-form.tsx`: add "Send for Review" button when `status === 'draft'`; disabled + tooltip explaining "resolve N comments first" when blocked.
- `verification-status.ts`: add label/color for `needs_clarification`.
- Notification routing to the review page: core `notification-item.tsx` currently derives `pageUrl` from `notification.page`/`notification.space` unconditionally. Hook-in: core imports an EE-provided lookup (`ee/page-verification/notification-url-override.ts`) exporting a function `getReviewUrlOverride(notification)` returning `string | undefined`; core uses it only if non-empty (`const url = getReviewUrlOverride(n) ?? defaultPageUrl`). This is the one-import/one-line core touch, no new conditionals beyond the null-coalescing call.

## 7. Notifications

Reuse existing queue jobs: `PAGE_APPROVAL_REQUESTED_NOTIFICATION`, `PAGE_APPROVAL_REJECTED_NOTIFICATION`. Add `PAGE_APPROVAL_CLARIFICATION_NOTIFICATION`, handled in the existing EE `verificationNotificationService` (already the target for approval jobs) — core `notification.processor.ts` needs exactly one new `case` line routing the new job name to the existing EE service method, matching how the two existing approval jobs are already wired (same file, so this is additive to an already-EE-routing switch, not new business logic in core).

## 8. Resolved design decisions

1. Content-change trigger uses the already-declared-but-unemitted `EventName.PAGE_CONTENT_UPDATED`, emitted from one line in `history.processor.ts` (see §4). Chosen over BullMQ job reuse because BullMQ jobs are single-consumer and already claimed by core processors; `EventEmitter2` is pub/sub with existing multi-listener precedent (`page.listener.ts`).
2. Previous verifiers ARE notified on silent revert-to-draft (§4 step 3) via a new `PAGE_REVERIFICATION_REQUIRED_NOTIFICATION` job, additive to the already EE-routed notification switch — cost is one switch case plus one EE service method, not new core surface.
3. `clarificationComment` field dropped — see §3 rationale (comment thread already carries the substance whenever `request-clarification` is reachable).

## 9. Out of scope

- Editing/versioning UI changes beyond what's needed to read `pageHistoryId` content.
- Changing space roles/CASL enums.
- Email templates (existing transactional email pattern reused as-is for new job type).
