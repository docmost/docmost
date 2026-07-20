# Page Review Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing EE `page-verification` (QMS) module so multiple reviewers must unanimously approve a page before it's marked Verified, with a dedicated review page, comment-resolution gating, Need-Clarify as a third outcome, and automatic reset to Not Verified when an approved page's content changes.

**Architecture:** All business logic lives in `apps/server/src/ee/page-verification` and `apps/client/src/ee/page-verification`, per the fork's golden rule (see `/Users/vunguyen/workspaces/02.ETC/sc_doc/CLAUDE.md`). Core files receive only mechanical hook-ins: one `EventEmitter2` emit call in `history.processor.ts` (content-change signal), one null-coalescing lookup in `notification-item.tsx` (review-page routing), and additive `case` lines in the already-EE-routing `notification.processor.ts` switch. Multi-reviewer aggregation is modeled as a new `page_verification_reviews` table (one row per verifier per review cycle) with an atomic `WHERE status = 'in_approval'` guard so the first decisive reject/clarify wins races safely.

**Tech Stack:** NestJS + Fastify (server), Kysely/Postgres, BullMQ, `@nestjs/event-emitter`; React 19 + Vite + Mantine + TanStack Query (client). Full spec: `docs/feature/page-review-workflow/design.md`.

## Global Constraints

- All new business logic MUST live under `apps/server/src/ee/page-verification` or `apps/client/src/ee/page-verification`; core files get at most an import + one wiring line (see `CLAUDE.md` Golden Rule).
- Unanimous approval: `page_verifications.status` becomes `approved` only when every verifier's `page_verification_reviews` row for the current cycle is `approved`.
- First-decisive-action-wins: any single `reject` or `request-clarification` immediately ends the cycle (`draft`/`needs_clarification`), discarding other verifiers' pending/approved decisions for that cycle.
- Every resubmit (`submit`) starts a fresh cycle — all verifier decisions reset to `pending`, no carry-over of prior approvals (confirmed user decision).
- `request-clarification` requires ≥1 unresolved comment on the page; `approve`/`reject` require 0 unresolved comments.
- "Send for Review" (`submit`) is blocked entirely while unresolved comments exist.
- Concurrency: all status-flipping writes use `UPDATE ... WHERE status = 'in_approval'` and return 409/`ConflictException` on zero rows affected.
- No `clarificationComment` field — the comment thread is the substance (see design §3).
- TDD: write the failing test before each implementation step; run it; then implement; then run again; then commit.

---


### File Structure

- Create: `apps/server/src/database/migrations/<timestamp>-add-page-review-fields.ts` — Kysely migration: adds `page_history_id`, `submitted_at`, `clarification_requested_at`, `clarification_requested_by_id` to `page_verifications`; extends `status` check (it's a free `varchar`, no enum constraint to alter); creates `page_verification_reviews` table.
- Modify: `apps/server/src/database/types/db.d.ts:548-570,572-579,660-681` — hand-authored interface additions for the new columns and the new `PageVerificationReviews` table/DB registration (stand-in for `migration:codegen`).
- Modify: `apps/server/src/database/types/entity.types.ts` — add `PageVerificationReview`/`Insertable`/`Updatable` aliases alongside existing `PageVerification*` aliases.
- Modify: `apps/server/src/ee/page-verification/page-verification.repo.ts` — add methods: `resetReviewsForCycle`, `recordReviewDecision`, `countPendingReviews`, `findReviewsByVerificationId`, `flipStatusIfInApproval` (atomic guarded update), `findLatestByPageId`, `countUnresolvedComments`-adjacent helper is added to `CommentRepo` instead (see below).
- Modify: `apps/server/src/database/repos/comment/comment.repo.ts` — add `countUnresolvedByPageId(pageId)` (shared, core repo — data-access only, no policy).
- Modify: `apps/server/src/ee/page-verification/page-verification.service.ts` — add `submit()`, `approve()`, `reject()`, `requestClarification()`, `getReviewPayload()`, private aggregate-decision helpers; keep existing `submitForApproval`/`verify`/`rejectApproval` untouched for the `expiring` type and backward compat.
- Create: `apps/server/src/ee/page-verification/page-content-updated.listener.ts` — `@OnEvent(EventName.PAGE_CONTENT_UPDATED)` handler: reset-to-draft + notify previous verifiers.
- Modify: `apps/server/src/ee/page-verification/page-verification.module.ts` — register the new listener as a provider.
- Modify: `apps/server/src/ee/page-verification/page-verification.controller.ts` — add `submit`, `approve`, `reject`, `request-clarification`, `review/:pageId` (as POST body per existing convention) endpoints + DTOs.
- Modify: `apps/server/src/collaboration/processors/history.processor.ts:1-36,81` — inject `EventEmitter2`, emit `PAGE_CONTENT_UPDATED` after `saveHistory`.
- Modify: `apps/server/src/integrations/queue/constants/queue.constants.ts:79-80` — add `PAGE_REVERIFICATION_REQUIRED_NOTIFICATION`, `PAGE_APPROVAL_CLARIFICATION_NOTIFICATION` job names.
- Modify: `apps/server/src/integrations/queue/constants/queue.interface.ts` — add `IReverificationRequiredNotificationJob`, `IApprovalClarificationNotificationJob`.
- Modify: `apps/server/src/core/notification/notification.processor.ts:139-153` — two additive `case` lines routing to EE `verificationNotificationService`.
- Create (EE service methods, referenced but not separately listed as a file since it's inside the module): extend `apps/server/src/core/notification/services/verification.notification.ts` is core — actually per golden rule, the *content* of these handlers must live in EE. Since `VerificationNotificationService` today lives in core (`core/notification/services/verification.notification.ts`), we add thin pass-through methods there (data/plumbing, no business logic) that call into an EE-provided template resolver — see Task 6 for the exact minimal-touch approach.
- Create: `apps/client/src/ee/page-verification/notification-url-override.ts` — `getReviewUrlOverride(notification)`.
- Modify: `apps/client/src/features/notification/components/notification-item.tsx:71-78` — one-line hook-in.
- Modify: `apps/client/src/ee/page-verification/types/page-verification.types.ts` — add `needs_clarification` status, `IReviewDecision`, `IReviewPayload` types.
- Modify: `apps/client/src/ee/page-verification/services/page-verification-service.ts` — add `submitForReview`, `approveReview`, `rejectReview`, `requestClarification`, `getReviewPayload`.
- Modify: `apps/client/src/ee/page-verification/queries/page-verification-query.ts` — add corresponding hooks.
- Modify: `apps/client/src/ee/page-verification/components/verification-status.ts` — add `needs_clarification` label/color.
- Modify: `apps/client/src/ee/page-verification/components/manage-verification-form.tsx` — "Send for Review" button gating on unresolved comment count.
- Create: `apps/client/src/ee/page-verification/pages/review-page.tsx` — route page.
- Create: `apps/client/src/ee/page-verification/components/review-action-bar.tsx` — Approve/Reject/Need Clarify buttons + reject modal.
- Create: `apps/client/src/ee/page-verification/components/reviewer-progress.tsx` — per-verifier decision list.
- Modify: `apps/client/src/App.tsx` — register `/review/:pageId` route.
- Test: `apps/server/src/ee/page-verification/page-verification.service.spec.ts` — aggregate-decision unit tests.

---

### Task 1: Database migration for review fields and reviews table

**Files:**
- Create: `apps/server/src/database/migrations/20260715T000001-add-page-review-fields.ts`
- Modify: `apps/server/src/database/types/db.d.ts:548-570` (PageVerifications columns), `:572-579` (add table after PageVerifiers block), `:660-681` (DB registry)
- Modify: `apps/server/src/database/types/entity.types.ts` (imports + type aliases)

**Interfaces:**
- Consumes: existing Kysely migration style from `apps/server/src/database/migrations/20260413T121647-page-verifications.ts` and `20260630T000001-recaptcha-verifications.ts` (snake_case columns, `gen_uuid_v7()` default, `onDelete` FKs).
- Produces: `page_verifications.page_history_id/submitted_at/clarification_requested_at/clarification_requested_by_id` columns; new `page_verification_reviews` table; TS types `PageVerificationReviews`, `PageVerificationReview`, `InsertablePageVerificationReview`, `UpdatablePageVerificationReview`.

- [ ] **Step 1: Write the migration file**
```ts
// apps/server/src/database/migrations/20260715T000001-add-page-review-fields.ts
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('page_verifications')
    .addColumn('page_history_id', 'uuid', (col) =>
      col.references('page_history.id').onDelete('set null'),
    )
    .addColumn('submitted_at', 'timestamptz')
    .addColumn('clarification_requested_at', 'timestamptz')
    .addColumn('clarification_requested_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .execute();

  await db.schema
    .createTable('page_verification_reviews')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('page_verification_id', 'uuid', (col) =>
      col.notNull().references('page_verifications.id').onDelete('cascade'),
    )
    .addColumn('verifier_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('decision', 'varchar', (col) =>
      col.notNull().defaultTo('pending'),
    )
    .addColumn('decided_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('idx_page_verification_reviews_verification_id')
    .ifNotExists()
    .on('page_verification_reviews')
    .column('page_verification_id')
    .execute();

  await db.schema
    .createIndex('idx_page_verification_reviews_verifier_id')
    .ifNotExists()
    .on('page_verification_reviews')
    .column('verifier_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('page_verification_reviews').ifExists().execute();
  await db.schema
    .alterTable('page_verifications')
    .dropColumn('page_history_id')
    .dropColumn('submitted_at')
    .dropColumn('clarification_requested_at')
    .dropColumn('clarification_requested_by_id')
    .execute();
}
```

- [ ] **Step 2: Hand-write the `db.d.ts` type additions** (note for the human: once a live DB is available, run the real codegen — `pnpm --filter server migration:codegen` per `apps/server/package.json` — and reconcile any drift against this hand-written version)
```ts
// apps/server/src/database/types/db.d.ts — extend PageVerifications (around line 565)
export interface PageVerifications {
  // ...existing columns...
  pageHistoryId: string | null;
  submittedAt: Timestamp | null;
  clarificationRequestedAt: Timestamp | null;
  clarificationRequestedById: string | null;
}

// new interface, place after PageVerifiers (around line 579)
export interface PageVerificationReviews {
  id: Generated<string>;
  pageVerificationId: string;
  verifierId: string;
  decision: Generated<string>;
  decidedAt: Timestamp | null;
  createdAt: Generated<Timestamp>;
}
```
```ts
// DB registry interface (around line 667), add alongside pageVerifiers:
pageVerificationReviews: PageVerificationReviews;
```

- [ ] **Step 3: Add entity type aliases**
```ts
// apps/server/src/database/types/entity.types.ts — add to the Kysely import list:
PageVerificationReviews as _PageVerificationReviews,
```
```ts
// near the existing PageVerification aliases:
export type PageVerificationReview = Selectable<_PageVerificationReviews>;
export type InsertablePageVerificationReview =
  Insertable<_PageVerificationReviews>;
export type UpdatablePageVerificationReview = Updateable<
  Omit<_PageVerificationReviews, 'id'>
>;
```

- [ ] **Step 4: Run the migration against a local/dev DB and verify** — `pnpm --filter server migration:latest` (or the repo's documented equivalent), then confirm via `psql` or `pnpm --filter server migration:up` output that `page_verification_reviews` exists and `page_verifications` has the new columns. (This step requires a live DB — flag to the human if unavailable in CI sandbox.)

- [ ] **Step 5: Commit** — `git add apps/server/src/database/migrations/20260715T000001-add-page-review-fields.ts apps/server/src/database/types/db.d.ts apps/server/src/database/types/entity.types.ts && git commit -m "db: add page review fields and page_verification_reviews table"`

---

### Task 2: Repo layer — review row lifecycle and atomic status guard

**Files:**
- Modify: `apps/server/src/ee/page-verification/page-verification.repo.ts:1-281` (add methods after `findExpiredVerifications`)
- Modify: `apps/server/src/database/repos/comment/comment.repo.ts:34-49` (add `countUnresolvedByPageId`)
- Test: `apps/server/src/ee/page-verification/page-verification.repo.spec.ts`

**Interfaces:**
- Consumes: `dbOrTx`, `KyselyTransaction`, `InsertablePageVerificationReview`/`UpdatablePageVerificationReview` from Task 1.
- Produces: `PageVerificationRepo.resetReviewsForCycle`, `.recordReviewDecision`, `.countPendingReviews`, `.findReviewsByVerificationId`, `.flipStatusIfInApproval`, `.findLatestByPageId`; `CommentRepo.countUnresolvedByPageId`.

- [ ] **Step 1: Write repo unit test first (fails — methods don't exist yet)**
```ts
// apps/server/src/ee/page-verification/page-verification.repo.spec.ts
import { PageVerificationRepo } from './page-verification.repo';

describe('PageVerificationRepo.flipStatusIfInApproval', () => {
  it('returns the updated row only when the current status is in_approval', async () => {
    const executeTakeFirst = jest.fn().mockResolvedValue({ id: 'pv-1', status: 'draft' });
    const chain: any = {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returningAll: jest.fn().mockReturnThis(),
      executeTakeFirst,
    };
    const db: any = { updateTable: jest.fn().mockReturnValue(chain) };
    const repo = new PageVerificationRepo(db);

    const result = await repo.flipStatusIfInApproval('pv-1', { status: 'draft' });

    expect(db.updateTable).toHaveBeenCalledWith('pageVerifications');
    expect(chain.where).toHaveBeenCalledWith('id', '=', 'pv-1');
    expect(chain.where).toHaveBeenCalledWith('status', '=', 'in_approval');
    expect(result).toEqual({ id: 'pv-1', status: 'draft' });
  });
});
```
Run: `pnpm --filter server test page-verification.repo.spec` — verify it fails (`flipStatusIfInApproval` is not a function).

- [ ] **Step 2: Implement the repo methods**
```ts
// apps/server/src/ee/page-verification/page-verification.repo.ts — add imports
import {
  InsertablePageVerificationReview,
  PageVerificationReview,
  UpdatablePageVerificationReview,
} from '@docmost/db/types/entity.types';
```
```ts
  // ... appended inside PageVerificationRepo, after findExpiredVerifications

  async findLatestByPageId(
    pageId: string,
  ): Promise<PageVerification | undefined> {
    return this.db
      .selectFrom('pageVerifications')
      .selectAll()
      .where('pageId', '=', pageId)
      .orderBy('createdAt', 'desc')
      .executeTakeFirst();
  }

  async resetReviewsForCycle(
    pageVerificationId: string,
    verifierIds: string[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('pageVerificationReviews')
      .where('pageVerificationId', '=', pageVerificationId)
      .execute();

    if (verifierIds.length === 0) return;

    await db
      .insertInto('pageVerificationReviews')
      .values(
        verifierIds.map((verifierId) => ({
          pageVerificationId,
          verifierId,
          decision: 'pending',
        })),
      )
      .execute();
  }

  async recordReviewDecision(
    pageVerificationId: string,
    verifierId: string,
    decision: string,
    trx?: KyselyTransaction,
  ): Promise<PageVerificationReview | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('pageVerificationReviews')
      .set({ decision, decidedAt: new Date() })
      .where('pageVerificationId', '=', pageVerificationId)
      .where('verifierId', '=', verifierId)
      .where('decision', '=', 'pending')
      .returningAll()
      .executeTakeFirst();
  }

  async countPendingReviews(
    pageVerificationId: string,
    trx?: KyselyTransaction,
  ): Promise<number> {
    const db = dbOrTx(this.db, trx);
    const row = await db
      .selectFrom('pageVerificationReviews')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('pageVerificationId', '=', pageVerificationId)
      .where('decision', '=', 'pending')
      .executeTakeFirst();
    return Number(row?.count ?? 0);
  }

  async findReviewsByVerificationId(pageVerificationId: string) {
    return this.db
      .selectFrom('pageVerificationReviews')
      .innerJoin('users', 'users.id', 'pageVerificationReviews.verifierId')
      .select([
        'pageVerificationReviews.id',
        'pageVerificationReviews.decision',
        'pageVerificationReviews.decidedAt',
        'users.id as verifierId',
        'users.name as verifierName',
        'users.avatarUrl as verifierAvatarUrl',
      ])
      .where('pageVerificationId', '=', pageVerificationId)
      .execute();
  }

  // Atomic race guard (design §2/§5): only succeeds while status is still
  // in_approval; returns undefined if another verifier's decisive action
  // already closed the cycle, so the caller can respond 409.
  async flipStatusIfInApproval(
    id: string,
    data: UpdatablePageVerification,
    trx?: KyselyTransaction,
  ): Promise<PageVerification | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('pageVerifications')
      .set({ ...data, updatedAt: new Date() })
      .where('id', '=', id)
      .where('status', '=', 'in_approval')
      .returningAll()
      .executeTakeFirst();
  }
```

- [ ] **Step 3: Add `CommentRepo.countUnresolvedByPageId`**
```ts
// apps/server/src/database/repos/comment/comment.repo.ts — after findPageComments
  async countUnresolvedByPageId(pageId: string): Promise<number> {
    const row = await this.db
      .selectFrom('comments')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('pageId', '=', pageId)
      .where('parentCommentId', 'is', null)
      .where('resolvedAt', 'is', null)
      .executeTakeFirst();
    return Number(row?.count ?? 0);
  }
```

- [ ] **Step 4: Run tests, verify passes** — `pnpm --filter server test page-verification.repo.spec`

- [ ] **Step 5: Commit** — `git add apps/server/src/ee/page-verification/page-verification.repo.ts apps/server/src/ee/page-verification/page-verification.repo.spec.ts apps/server/src/database/repos/comment/comment.repo.ts && git commit -m "feat(page-verification): add per-verifier review row lifecycle and race-guarded status flip"`

---

### Task 3: Service layer — submit/approve/reject/request-clarification aggregate logic

**Files:**
- Modify: `apps/server/src/ee/page-verification/page-verification.service.ts:1-469`
- Modify: `apps/server/src/integrations/queue/constants/queue.interface.ts` (job payload interfaces used by submit, done in Task 6 but referenced here)
- Test: `apps/server/src/ee/page-verification/page-verification.service.spec.ts` (created fully in Task 12; a first-pass smoke test is written here for `submit`'s gating)

**Interfaces:**
- Consumes: `PageVerificationRepo` methods from Task 2, `CommentRepo.countUnresolvedByPageId`, `PageHistoryRepo.findPageLastHistory` (existing, for `pageHistoryId` on submit).
- Produces: `PageVerificationService.submit(pageId, user)`, `.approve(pageId, user)`, `.reject(data, user)`, `.requestClarification(pageId, user)`, `.getReviewPayload(pageId, user)`.

- [ ] **Step 1: Write a failing smoke test for the comment gate on submit**
```ts
// apps/server/src/ee/page-verification/page-verification.service.spec.ts (initial slice)
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PageVerificationService } from './page-verification.service';
import { PageVerificationRepo } from './page-verification.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { CommentRepo } from '@docmost/db/repos/comment/comment.repo';
import { PageHistoryRepo } from '@docmost/db/repos/page/page-history.repo';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import { getQueueToken } from '@nestjs/bullmq';
import { QueueName } from '../../integrations/queue/constants';
import { getKyselyToken } from 'nestjs-kysely';

describe('PageVerificationService.submit', () => {
  it('blocks submit when unresolved comments exist', async () => {
    const pageRepo = { findById: jest.fn().mockResolvedValue({ id: 'p1', spaceId: 's1', creatorId: 'u1', deletedAt: null }) };
    const commentRepo = { countUnresolvedByPageId: jest.fn().mockResolvedValue(2) };
    const pageVerificationRepo = {
      findByPageId: jest.fn().mockResolvedValue({ id: 'pv1', type: 'qms', status: 'draft', workspaceId: 'w1' }),
    };

    const module = await Test.createTestingModule({
      providers: [
        PageVerificationService,
        { provide: PageVerificationRepo, useValue: pageVerificationRepo },
        { provide: PageRepo, useValue: pageRepo },
        { provide: CommentRepo, useValue: commentRepo },
        { provide: PageHistoryRepo, useValue: { findPageLastHistory: jest.fn() } },
        { provide: PageAccessService, useValue: { validateCanView: jest.fn(), validateCanEdit: jest.fn() } },
        { provide: SpaceMemberRepo, useValue: {} },
        { provide: SpaceAbilityFactory, useValue: { createForUser: jest.fn().mockResolvedValue({ can: () => true }) } },
        { provide: getKyselyToken(), useValue: {} },
        { provide: getQueueToken(QueueName.NOTIFICATION_QUEUE), useValue: { add: jest.fn() } },
      ],
    }).compile();

    const service = module.get(PageVerificationService);

    await expect(service.submit('p1', { id: 'u1' } as any)).rejects.toThrow(
      BadRequestException,
    );
  });
});
```
Run: `pnpm --filter server test page-verification.service.spec` — verify it fails (`submit` is not a function).

- [ ] **Step 2: Add `CommentRepo` and `PageHistoryRepo` to the service constructor and implement `submit`**
```ts
// apps/server/src/ee/page-verification/page-verification.service.ts — imports
import { CommentRepo } from '@docmost/db/repos/comment/comment.repo';
import { PageHistoryRepo } from '@docmost/db/repos/page/page-history.repo';
```
```ts
  constructor(
    private readonly pageVerificationRepo: PageVerificationRepo,
    private readonly pageRepo: PageRepo,
    private readonly pageAccessService: PageAccessService,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly commentRepo: CommentRepo,
    private readonly pageHistoryRepo: PageHistoryRepo,
    @InjectKysely() private readonly db: KyselyDB,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
  ) {}
```
```ts
  async submit(pageId: string, user: User) {
    const page = await this.getPageOrThrow(pageId);
    const verification = await this.pageVerificationRepo.findByPageId(pageId);
    if (!verification || verification.type !== 'qms') {
      throw new BadRequestException('QMS verification required');
    }
    if (!(await this.canManage(page, user))) {
      throw new ForbiddenException();
    }
    if (
      verification.status !== 'draft' &&
      verification.status !== 'needs_clarification'
    ) {
      throw new BadRequestException('Page is not eligible for submission');
    }

    const unresolvedCount = await this.commentRepo.countUnresolvedByPageId(
      pageId,
    );
    if (unresolvedCount > 0) {
      throw new BadRequestException(
        `Resolve ${unresolvedCount} comment(s) before submitting for review`,
      );
    }

    const lastHistory = await this.pageHistoryRepo.findPageLastHistory(
      pageId,
    );
    const verifiers = await this.pageVerificationRepo.getVerifiers(
      verification.id,
    );

    await executeTx(this.db, async (trx) => {
      await this.pageVerificationRepo.update(
        pageId,
        {
          status: 'in_approval',
          submittedAt: new Date(),
          pageHistoryId: lastHistory?.id ?? null,
          requestedAt: new Date(),
          requestedById: user.id,
          rejectedAt: null,
          rejectedById: null,
          rejectionComment: null,
          clarificationRequestedAt: null,
          clarificationRequestedById: null,
        },
        trx,
      );
      await this.pageVerificationRepo.resetReviewsForCycle(
        verification.id,
        verifiers.map((v) => v.id),
        trx,
      );
    });

    await this.notificationQueue.add(
      QueueJob.PAGE_APPROVAL_REQUESTED_NOTIFICATION,
      {
        pageId: page.id,
        spaceId: page.spaceId,
        workspaceId: verification.workspaceId,
        actorId: user.id,
        verifierIds: verifiers.map((v) => v.id),
      },
    );
  }
```

- [ ] **Step 3: Implement `approve`, `reject`, `requestClarification` with the first-decisive-action-wins / atomic-flip logic (design §2, §5)**
```ts
  async approve(pageId: string, user: User) {
    const verification = await this.getInApprovalVerificationForVerifier(
      pageId,
      user,
    );
    const unresolvedCount = await this.commentRepo.countUnresolvedByPageId(
      pageId,
    );
    if (unresolvedCount > 0) {
      throw new BadRequestException(
        'Resolve outstanding comments or request clarification instead',
      );
    }

    await executeTx(this.db, async (trx) => {
      const decided = await this.pageVerificationRepo.recordReviewDecision(
        verification.id,
        user.id,
        'approved',
        trx,
      );
      if (!decided) {
        throw new ForbiddenException('No pending decision for this verifier');
      }

      const pendingCount = await this.pageVerificationRepo.countPendingReviews(
        verification.id,
        trx,
      );
      if (pendingCount === 0) {
        const flipped = await this.pageVerificationRepo.flipStatusIfInApproval(
          verification.id,
          {
            status: 'approved',
            verifiedAt: new Date(),
            verifiedById: user.id,
          },
          trx,
        );
        if (!flipped) {
          throw new ConflictException('Review cycle already resolved');
        }
      }
    });
  }

  async reject(data: { pageId: string; comment: string }, user: User) {
    if (!data.comment?.trim()) {
      throw new BadRequestException('A rejection comment is required');
    }
    const verification = await this.getInApprovalVerificationForVerifier(
      data.pageId,
      user,
    );

    await executeTx(this.db, async (trx) => {
      await this.pageVerificationRepo.recordReviewDecision(
        verification.id,
        user.id,
        'rejected',
        trx,
      );
      const flipped = await this.pageVerificationRepo.flipStatusIfInApproval(
        verification.id,
        {
          status: 'draft',
          rejectedAt: new Date(),
          rejectedById: user.id,
          rejectionComment: data.comment,
        },
        trx,
      );
      if (!flipped) {
        throw new ConflictException('Review cycle already resolved');
      }
    });

    await this.notificationQueue.add(QueueJob.PAGE_APPROVAL_REJECTED_NOTIFICATION, {
      pageId: verification.pageId,
      spaceId: verification.spaceId,
      workspaceId: verification.workspaceId,
      actorId: user.id,
      requestedById: verification.requestedById,
      comment: data.comment,
    });
  }

  async requestClarification(pageId: string, user: User) {
    const verification = await this.getInApprovalVerificationForVerifier(
      pageId,
      user,
    );
    const unresolvedCount = await this.commentRepo.countUnresolvedByPageId(
      pageId,
    );
    if (unresolvedCount === 0) {
      throw new BadRequestException(
        'Add an unresolved comment to request clarification',
      );
    }

    await executeTx(this.db, async (trx) => {
      await this.pageVerificationRepo.recordReviewDecision(
        verification.id,
        user.id,
        'needs_clarification',
        trx,
      );
      const flipped = await this.pageVerificationRepo.flipStatusIfInApproval(
        verification.id,
        {
          status: 'needs_clarification',
          clarificationRequestedAt: new Date(),
          clarificationRequestedById: user.id,
        },
        trx,
      );
      if (!flipped) {
        throw new ConflictException('Review cycle already resolved');
      }
    });

    await this.notificationQueue.add(
      QueueJob.PAGE_APPROVAL_CLARIFICATION_NOTIFICATION,
      {
        pageId: verification.pageId,
        spaceId: verification.spaceId,
        workspaceId: verification.workspaceId,
        actorId: user.id,
        requestedById: verification.requestedById,
      },
    );
  }

  private async getInApprovalVerificationForVerifier(
    pageId: string,
    user: User,
  ) {
    const verification = await this.pageVerificationRepo.findByPageId(pageId);
    if (!verification || verification.type !== 'qms') {
      throw new NotFoundException('Verification not found');
    }
    const isVerifier = await this.pageVerificationRepo.isVerifier(
      verification.id,
      user.id,
    );
    if (!isVerifier) {
      throw new ForbiddenException();
    }
    if (verification.status !== 'in_approval') {
      throw new BadRequestException('Page is not awaiting review');
    }
    return verification;
  }

  async getReviewPayload(pageId: string, user: User) {
    const page = await this.getPageOrThrow(pageId);
    await this.pageAccessService.validateCanView(page, user);
    const verification = await this.pageVerificationRepo.findLatestByPageId(
      pageId,
    );
    if (!verification) {
      throw new NotFoundException('Verification not found');
    }
    const [reviews, isReviewer] = await Promise.all([
      this.pageVerificationRepo.findReviewsByVerificationId(verification.id),
      this.pageVerificationRepo.isVerifier(verification.id, user.id),
    ]);
    return {
      verification,
      reviews,
      permissions: { isReviewer },
    };
  }
```
Add `ConflictException` to the `@nestjs/common` import at the top of the file.

- [ ] **Step 4: Run test, verify passes** — `pnpm --filter server test page-verification.service.spec`

- [ ] **Step 5: Commit** — `git add apps/server/src/ee/page-verification/page-verification.service.ts apps/server/src/ee/page-verification/page-verification.service.spec.ts && git commit -m "feat(page-verification): implement multi-reviewer submit/approve/reject/request-clarification"`

---

### Task 4: Core touch — emit `PAGE_CONTENT_UPDATED` from `history.processor.ts`

**Files:**
- Modify: `apps/server/src/collaboration/processors/history.processor.ts:1-36,81`
- Test: `apps/server/src/collaboration/processors/history.processor.spec.ts` (new, or extend if one exists — none found, so create)

**Interfaces:**
- Consumes: `EventEmitter2` from `@nestjs/event-emitter` (already a workspace dependency, used elsewhere e.g. `page.listener.ts`).
- Produces: emits `EventName.PAGE_CONTENT_UPDATED` with `{ pageId, spaceId, workspaceId, historyId }`.

- [ ] **Step 1: Write a failing test asserting the emit call**
```ts
// apps/server/src/collaboration/processors/history.processor.spec.ts
import { HistoryProcessor } from './history.processor';
import { EventName } from '../../common/events/event.contants';

describe('HistoryProcessor content-updated event', () => {
  it('emits PAGE_CONTENT_UPDATED after saving a new history row', async () => {
    const savedHistory = { id: 'hist-1' };
    const page = { id: 'p1', spaceId: 's1', workspaceId: 'w1', content: { a: 1 } };
    const pageHistoryRepo = {
      findPageLastHistory: jest.fn().mockResolvedValue({ content: { a: 0 } }),
      saveHistory: jest.fn().mockResolvedValue(savedHistory),
    };
    const pageRepo = { findById: jest.fn().mockResolvedValue(page) };
    const collabHistory = {
      popContributors: jest.fn().mockResolvedValue([]),
      addContributors: jest.fn(),
      clearContributors: jest.fn(),
    };
    const watcherService = { addPageWatchers: jest.fn() };
    const notificationQueue = { add: jest.fn() };
    const generalQueue = { add: jest.fn().mockReturnValue({ catch: jest.fn() }) };
    const eventEmitter = { emit: jest.fn() };

    const processor: any = new HistoryProcessor(
      pageHistoryRepo as any,
      pageRepo as any,
      collabHistory as any,
      watcherService as any,
      notificationQueue as any,
      generalQueue as any,
      eventEmitter as any,
    );

    await processor.process({ name: 'page-history', data: { pageId: 'p1' } } as any);

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      EventName.PAGE_CONTENT_UPDATED,
      { pageId: 'p1', spaceId: 's1', workspaceId: 'w1', historyId: 'hist-1' },
    );
  });
});
```
Run: `pnpm --filter server test history.processor.spec` — verify it fails (constructor arg count mismatch / `eventEmitter.emit` never called).

- [ ] **Step 2: Apply the exact core diff (constructor injection + one emit call, per design §4)**
```ts
// apps/server/src/collaboration/processors/history.processor.ts — imports
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventName } from '../../common/events/event.contants';
```
```ts
  constructor(
    private readonly pageHistoryRepo: PageHistoryRepo,
    private readonly pageRepo: PageRepo,
    private readonly collabHistory: CollabHistoryService,
    private readonly watcherService: WatcherService,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE) private notificationQueue: Queue,
    @InjectQueue(QueueName.GENERAL_QUEUE) private generalQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }
```
```ts
          await this.pageHistoryRepo.saveHistory(page, { contributorIds });
          this.logger.debug(`History created for page: ${pageId}`);

          this.eventEmitter.emit(EventName.PAGE_CONTENT_UPDATED, {
            pageId,
            spaceId: page.spaceId,
            workspaceId: page.workspaceId,
            historyId: savedHistory.id,
          });
```
Note: `saveHistory`'s return value must be captured — change `await this.pageHistoryRepo.saveHistory(page, { contributorIds });` to `const savedHistory = await this.pageHistoryRepo.saveHistory(page, { contributorIds });` (matches design §4 snippet exactly).

- [ ] **Step 3: Run test, verify passes** — `pnpm --filter server test history.processor.spec`

- [ ] **Step 4: Run the full collaboration test suite to confirm no regressions** — `pnpm --filter server test collaboration`

- [ ] **Step 5: Commit** — `git add apps/server/src/collaboration/processors/history.processor.ts apps/server/src/collaboration/processors/history.processor.spec.ts && git commit -m "core: emit PAGE_CONTENT_UPDATED when a new page history row is saved"`

---

### Task 5: EE listener — reset approved pages to draft on content change

**Files:**
- Create: `apps/server/src/ee/page-verification/page-content-updated.listener.ts`
- Modify: `apps/server/src/ee/page-verification/page-verification.module.ts:9-19`
- Test: `apps/server/src/ee/page-verification/page-content-updated.listener.spec.ts`

**Interfaces:**
- Consumes: `EventName.PAGE_CONTENT_UPDATED` payload `{ pageId, spaceId, workspaceId, historyId }` from Task 4; `PageVerificationRepo.findLatestByPageId`, `.insert`, `.replaceVerifiers`, `.getVerifiers`.
- Produces: new `page_verifications` row (`status='draft'`) when an approved page's content changes; enqueues `PAGE_REVERIFICATION_REQUIRED_NOTIFICATION`.

- [ ] **Step 1: Write a failing test**
```ts
// apps/server/src/ee/page-verification/page-content-updated.listener.spec.ts
import { PageContentUpdatedListener } from './page-content-updated.listener';

describe('PageContentUpdatedListener', () => {
  it('creates a new draft verification row and notifies previous verifiers when an approved page changes', async () => {
    const previous = {
      id: 'pv1',
      pageId: 'p1',
      workspaceId: 'w1',
      spaceId: 's1',
      status: 'approved',
      type: 'qms',
      creatorId: 'u1',
    };
    const verifiers = [{ id: 'v1' }, { id: 'v2' }];
    const pageVerificationRepo = {
      findLatestByPageId: jest.fn().mockResolvedValue(previous),
      getVerifiers: jest.fn().mockResolvedValue(verifiers),
      insert: jest.fn().mockResolvedValue({ id: 'pv2' }),
      replaceVerifiers: jest.fn(),
    };
    const notificationQueue = { add: jest.fn() };

    const listener = new PageContentUpdatedListener(
      pageVerificationRepo as any,
      notificationQueue as any,
    );

    await listener.handle({
      pageId: 'p1',
      spaceId: 's1',
      workspaceId: 'w1',
      historyId: 'hist-2',
    });

    expect(pageVerificationRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        pageId: 'p1',
        status: 'draft',
        pageHistoryId: 'hist-2',
        type: 'qms',
      }),
    );
    expect(notificationQueue.add).toHaveBeenCalledWith(
      'page-reverification-required-notification',
      expect.objectContaining({ pageId: 'p1', verifierIds: ['v1', 'v2'] }),
    );
  });

  it('does nothing when the latest verification is not approved', async () => {
    const pageVerificationRepo = {
      findLatestByPageId: jest.fn().mockResolvedValue({ status: 'draft' }),
      insert: jest.fn(),
    };
    const notificationQueue = { add: jest.fn() };
    const listener = new PageContentUpdatedListener(
      pageVerificationRepo as any,
      notificationQueue as any,
    );

    await listener.handle({ pageId: 'p1', spaceId: 's1', workspaceId: 'w1', historyId: 'h1' });

    expect(pageVerificationRepo.insert).not.toHaveBeenCalled();
  });
});
```
Run: `pnpm --filter server test page-content-updated.listener.spec` — verify it fails (module doesn't exist).

- [ ] **Step 2: Implement the listener**
```ts
// apps/server/src/ee/page-verification/page-content-updated.listener.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventName } from '../../common/events/event.contants';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import { PageVerificationRepo } from './page-verification.repo';

export interface PageContentUpdatedEvent {
  pageId: string;
  spaceId: string;
  workspaceId: string;
  historyId: string;
}

@Injectable()
export class PageContentUpdatedListener {
  private readonly logger = new Logger(PageContentUpdatedListener.name);

  constructor(
    private readonly pageVerificationRepo: PageVerificationRepo,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
  ) {}

  @OnEvent(EventName.PAGE_CONTENT_UPDATED)
  async handle(event: PageContentUpdatedEvent): Promise<void> {
    const previous = await this.pageVerificationRepo.findLatestByPageId(
      event.pageId,
    );
    if (!previous || previous.type !== 'qms' || previous.status !== 'approved') {
      return;
    }

    const verifiers = await this.pageVerificationRepo.getVerifiers(
      previous.id,
    );

    const created = await this.pageVerificationRepo.insert({
      pageId: event.pageId,
      workspaceId: event.workspaceId,
      spaceId: event.spaceId,
      type: 'qms',
      status: 'draft',
      pageHistoryId: event.historyId,
      creatorId: previous.creatorId,
    });

    if (verifiers.length > 0) {
      await this.pageVerificationRepo.replaceVerifiers(
        created.id,
        verifiers.map((v) => v.id),
        previous.creatorId,
      );
    }

    this.logger.debug(
      `Page ${event.pageId} content changed after approval; reset to draft (${created.id})`,
    );

    if (verifiers.length > 0) {
      await this.notificationQueue.add(
        QueueJob.PAGE_REVERIFICATION_REQUIRED_NOTIFICATION,
        {
          pageId: event.pageId,
          spaceId: event.spaceId,
          workspaceId: event.workspaceId,
          verifierIds: verifiers.map((v) => v.id),
        },
      );
    }
  }
}
```
(Assumes `QueueJob.PAGE_REVERIFICATION_REQUIRED_NOTIFICATION` from Task 6 — sequence the two tasks together or stub the constant locally until Task 6 lands.)

- [ ] **Step 3: Register the listener in the module**
```ts
// apps/server/src/ee/page-verification/page-verification.module.ts
import { PageContentUpdatedListener } from './page-content-updated.listener';
// ...
  providers: [
    PageVerificationService,
    PageVerificationRepo,
    PageVerificationSchedulerService,
    PageContentUpdatedListener,
  ],
```

- [ ] **Step 4: Run test, verify passes** — `pnpm --filter server test page-content-updated.listener.spec`

- [ ] **Step 5: Commit** — `git add apps/server/src/ee/page-verification/page-content-updated.listener.ts apps/server/src/ee/page-verification/page-verification.module.ts apps/server/src/ee/page-verification/page-content-updated.listener.spec.ts && git commit -m "feat(page-verification): reset approved pages to draft when content changes"`

---

### Task 6: Queue constants and notification routing

**Files:**
- Modify: `apps/server/src/integrations/queue/constants/queue.constants.ts:79-80`
- Modify: `apps/server/src/integrations/queue/constants/queue.interface.ts` (append two interfaces)
- Modify: `apps/server/src/core/notification/notification.processor.ts:1-24,44-58,139-153`
- Modify: (EE, not core) `apps/server/src/ee/page-verification` — add a `processReverificationRequired` / `processApprovalClarification` method to wherever `verificationNotificationService` actually lives (confirmed core file `apps/server/src/core/notification/services/verification.notification.ts` — read it before editing to match its existing `processApprovalRequested`/`processApprovalRejected` signatures)
- Test: none required (data/constants + thin routing; covered indirectly by Task 3/5 tests)

**Interfaces:**
- Consumes: none new.
- Produces: `QueueJob.PAGE_REVERIFICATION_REQUIRED_NOTIFICATION`, `QueueJob.PAGE_APPROVAL_CLARIFICATION_NOTIFICATION`; `IReverificationRequiredNotificationJob`, `IApprovalClarificationNotificationJob`.

- [ ] **Step 1: Add the two job name constants**
```ts
// apps/server/src/integrations/queue/constants/queue.constants.ts:80
  PAGE_APPROVAL_REJECTED_NOTIFICATION = 'page-approval-rejected-notification',
  PAGE_APPROVAL_CLARIFICATION_NOTIFICATION = 'page-approval-clarification-notification',
  PAGE_REVERIFICATION_REQUIRED_NOTIFICATION = 'page-reverification-required-notification',
```

- [ ] **Step 2: Add the two job payload interfaces**
```ts
// apps/server/src/integrations/queue/constants/queue.interface.ts — append
export interface IApprovalClarificationNotificationJob {
  pageId: string;
  spaceId: string;
  workspaceId: string;
  actorId: string;
  requestedById: string;
}

export interface IReverificationRequiredNotificationJob {
  pageId: string;
  spaceId: string;
  workspaceId: string;
  verifierIds: string[];
}
```

- [ ] **Step 3: Read `apps/server/src/core/notification/services/verification.notification.ts` in full to match the existing `processApprovalRequested`/`processApprovalRejected` method shape (transactional email + in-app notification insert), then add two sibling methods `processApprovalClarification` and `processReverificationRequired` following the same pattern** (this is the file's existing data/plumbing pattern — reused as-is, not new business logic, per design §7).

- [ ] **Step 4: Wire the two new `case`s into the switch (additive lines only, matching the existing two approval cases)**
```ts
// apps/server/src/core/notification/notification.processor.ts:1-24 — extend the job-type import list
import {
  IApprovalClarificationNotificationJob,
  IReverificationRequiredNotificationJob,
  // ...existing imports...
} from '../../integrations/queue/constants/queue.interface';
```
```ts
// extend the process() job union type (line ~56) with:
      | IApprovalClarificationNotificationJob
      | IReverificationRequiredNotificationJob,
```
```ts
        // after the existing PAGE_APPROVAL_REJECTED_NOTIFICATION case (line ~153)
        case QueueJob.PAGE_APPROVAL_CLARIFICATION_NOTIFICATION: {
          await this.verificationNotificationService.processApprovalClarification(
            job.data as IApprovalClarificationNotificationJob,
            appUrl,
          );
          break;
        }

        case QueueJob.PAGE_REVERIFICATION_REQUIRED_NOTIFICATION: {
          await this.verificationNotificationService.processReverificationRequired(
            job.data as IReverificationRequiredNotificationJob,
            appUrl,
          );
          break;
        }
```

- [ ] **Step 5: Run the notification processor test suite (if present) and typecheck** — `pnpm --filter server test notification.processor` (or `pnpm --filter server typecheck` if no spec file exists yet); verify green.

- [ ] **Step 6: Commit** — `git add apps/server/src/integrations/queue/constants/queue.constants.ts apps/server/src/integrations/queue/constants/queue.interface.ts apps/server/src/core/notification/notification.processor.ts apps/server/src/core/notification/services/verification.notification.ts && git commit -m "feat(notifications): route clarification and reverification jobs to EE verification service"`

---

### Task 7: Controller endpoints

**Files:**
- Modify: `apps/server/src/ee/page-verification/page-verification.controller.ts:1-135`
- Test: `apps/server/src/ee/page-verification/page-verification.controller.spec.ts`

**Interfaces:**
- Consumes: `PageVerificationService.submit/approve/reject/requestClarification/getReviewPayload` from Task 3.
- Produces: `POST /pages/submit-for-review`, `POST /pages/approve-review`, `POST /pages/reject-review`, `POST /pages/request-clarification`, `POST /pages/review-payload` (kept under existing `pages` prefix/POST-body convention already used by every other endpoint in this controller, rather than introducing the RESTier `GET /page-verification/:pageId/review` shape from the design doc, to stay consistent with the codebase's actual convention).

- [ ] **Step 1: Write a failing controller test**
```ts
// apps/server/src/ee/page-verification/page-verification.controller.spec.ts
import { Test } from '@nestjs/testing';
import { PageVerificationController } from './page-verification.controller';
import { PageVerificationService } from './page-verification.service';

describe('PageVerificationController review endpoints', () => {
  it('delegates submit-for-review to the service', async () => {
    const service = { submit: jest.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      controllers: [PageVerificationController],
      providers: [{ provide: PageVerificationService, useValue: service }],
    }).compile();

    const controller = module.get(PageVerificationController);
    const user = { id: 'u1' } as any;

    await controller.submitForReview({ pageId: 'p1' }, user);

    expect(service.submit).toHaveBeenCalledWith('p1', user);
  });
});
```
Run: `pnpm --filter server test page-verification.controller.spec` — verify it fails (`submitForReview` not defined).

- [ ] **Step 2: Add the endpoints**
```ts
// apps/server/src/ee/page-verification/page-verification.controller.ts — append inside the class
  @HttpCode(HttpStatus.OK)
  @Post('submit-for-review')
  @RequireFeature(Feature.PAGE_VERIFICATION)
  async submitForReview(
    @Body() body: { pageId: string },
    @AuthUser() user: User,
  ) {
    await this.pageVerificationService.submit(body.pageId, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('approve-review')
  @RequireFeature(Feature.PAGE_VERIFICATION)
  async approveReview(
    @Body() body: { pageId: string },
    @AuthUser() user: User,
  ) {
    await this.pageVerificationService.approve(body.pageId, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('reject-review')
  @RequireFeature(Feature.PAGE_VERIFICATION)
  async rejectReview(
    @Body() body: { pageId: string; comment: string },
    @AuthUser() user: User,
  ) {
    await this.pageVerificationService.reject(body, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('request-clarification')
  @RequireFeature(Feature.PAGE_VERIFICATION)
  async requestClarification(
    @Body() body: { pageId: string },
    @AuthUser() user: User,
  ) {
    await this.pageVerificationService.requestClarification(body.pageId, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('review-payload')
  @RequireFeature(Feature.PAGE_VERIFICATION)
  async reviewPayload(
    @Body() body: { pageId: string },
    @AuthUser() user: User,
  ) {
    return this.pageVerificationService.getReviewPayload(body.pageId, user);
  }
```

- [ ] **Step 3: Run test, verify passes** — `pnpm --filter server test page-verification.controller.spec`

- [ ] **Step 4: Commit** — `git add apps/server/src/ee/page-verification/page-verification.controller.ts apps/server/src/ee/page-verification/page-verification.controller.spec.ts && git commit -m "feat(page-verification): add submit/approve/reject/clarify/review-payload endpoints"`

---

### Task 8: Client — types, service, query hooks

**Files:**
- Modify: `apps/client/src/ee/page-verification/types/page-verification.types.ts:7-15,50-55`
- Modify: `apps/client/src/ee/page-verification/services/page-verification-service.ts:1-62`
- Modify: `apps/client/src/ee/page-verification/queries/page-verification-query.ts:1-203`

**Interfaces:**
- Consumes: `api` (`@/lib/api-client`) POST convention from every existing service function; endpoints from Task 7.
- Produces: `useSubmitForReviewMutation`, `useApproveReviewMutation`, `useRejectReviewMutation`, `useRequestClarificationMutation`, `useReviewPageQuery`; types `IReviewDecision`, `IReviewPayload`.

- [ ] **Step 1: Extend types**
```ts
// apps/client/src/ee/page-verification/types/page-verification.types.ts:7-15
export type VerificationStatus =
  | "verified"
  | "expiring"
  | "expired"
  | "draft"
  | "in_approval"
  | "needs_clarification"
  | "approved"
  | "obsolete"
  | "none";
```
```ts
// append at the end of the file
export type ReviewDecision = "pending" | "approved" | "rejected" | "needs_clarification";

export type IReviewDecisionEntry = {
  id: string;
  decision: ReviewDecision;
  decidedAt: string | null;
  verifierId: string;
  verifierName: string;
  verifierAvatarUrl: string | null;
};

export type IReviewPayload = {
  verification: IPageVerificationInfo;
  reviews: IReviewDecisionEntry[];
  permissions: { isReviewer: boolean };
};
```

- [ ] **Step 2: Add service functions**
```ts
// apps/client/src/ee/page-verification/services/page-verification-service.ts — append
export async function submitForReview(pageId: string): Promise<void> {
  await api.post("/pages/submit-for-review", { pageId });
}

export async function approveReview(pageId: string): Promise<void> {
  await api.post("/pages/approve-review", { pageId });
}

export async function rejectReview(data: {
  pageId: string;
  comment: string;
}): Promise<void> {
  await api.post("/pages/reject-review", data);
}

export async function requestClarification(pageId: string): Promise<void> {
  await api.post("/pages/request-clarification", { pageId });
}

export async function getReviewPayload(pageId: string): Promise<IReviewPayload> {
  const req = await api.post<IReviewPayload>("/pages/review-payload", { pageId });
  return req.data;
}
```
Add `IReviewPayload` to the top-of-file type import list.

- [ ] **Step 3: Add query hooks (mirroring `useSubmitForApprovalMutation`/`useRejectApprovalMutation` exactly, invalidating both `page-verification-info` and a new `review-payload` key)**
```ts
// apps/client/src/ee/page-verification/queries/page-verification-query.ts — extend imports
import {
  approveReview,
  getReviewPayload,
  getVerificationInfo,
  getVerificationList,
  markObsolete,
  rejectApproval,
  rejectReview,
  removeVerification,
  requestClarification,
  setupVerification,
  submitForApproval,
  submitForReview,
  updateVerification,
  verifyPage,
} from "@/ee/page-verification/services/page-verification-service";
import { IReviewPayload } from "@/ee/page-verification/types/page-verification.types";
```
```ts
export function useReviewPageQuery(
  pageId: string | undefined,
): UseQueryResult<IReviewPayload, Error> {
  return useQuery({
    queryKey: ["review-payload", pageId],
    queryFn: () => getReviewPayload(pageId!),
    enabled: !!pageId,
  });
}

export function useSubmitForReviewMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, string>({
    mutationFn: (pageId) => submitForReview(pageId),
    onSuccess: (_, pageId) => {
      queryClient.invalidateQueries({ queryKey: ["page-verification-info", pageId] });
      notifications.show({ message: t("Submitted for review") });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to submit for review"),
        color: "red",
      });
    },
  });
}

export function useApproveReviewMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, string>({
    mutationFn: (pageId) => approveReview(pageId),
    onSuccess: (_, pageId) => {
      queryClient.invalidateQueries({ queryKey: ["page-verification-info", pageId] });
      queryClient.invalidateQueries({ queryKey: ["review-payload", pageId] });
      notifications.show({ message: t("Review approved") });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to approve review"),
        color: "red",
      });
    },
  });
}

export function useRejectReviewMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, { pageId: string; comment: string }>({
    mutationFn: (data) => rejectReview(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["page-verification-info", variables.pageId] });
      queryClient.invalidateQueries({ queryKey: ["review-payload", variables.pageId] });
      notifications.show({ message: t("Page returned to draft") });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to reject review"),
        color: "red",
      });
    },
  });
}

export function useRequestClarificationMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, string>({
    mutationFn: (pageId) => requestClarification(pageId),
    onSuccess: (_, pageId) => {
      queryClient.invalidateQueries({ queryKey: ["page-verification-info", pageId] });
      queryClient.invalidateQueries({ queryKey: ["review-payload", pageId] });
      notifications.show({ message: t("Clarification requested") });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to request clarification"),
        color: "red",
      });
    },
  });
}
```

- [ ] **Step 4: Typecheck the client package** — `pnpm --filter client typecheck` (or `tsc --noEmit` per the client's script); verify no type errors.

- [ ] **Step 5: Commit** — `git add apps/client/src/ee/page-verification/types/page-verification.types.ts apps/client/src/ee/page-verification/services/page-verification-service.ts apps/client/src/ee/page-verification/queries/page-verification-query.ts && git commit -m "feat(page-verification): add client types/service/hooks for the review workflow"`

---

### Task 9: Client — review page route, action bar, reviewer progress

**Files:**
- Create: `apps/client/src/ee/page-verification/pages/review-page.tsx`
- Create: `apps/client/src/ee/page-verification/components/review-action-bar.tsx`
- Create: `apps/client/src/ee/page-verification/components/reviewer-progress.tsx`
- Modify: `apps/client/src/App.tsx:43,132` (route registration, mirroring the existing `verifications` route registration pattern)

**Interfaces:**
- Consumes: `useReviewPageQuery`, `useApproveReviewMutation`, `useRejectReviewMutation`, `useRequestClarificationMutation` from Task 8; existing `CommentListWithTabs` component (`@/features/comment/components/comment-list-with-tabs`) reused as-is per design §6 ("reuse `CommentSidebar`" — the actual component name in this codebase is `CommentListWithTabs`); existing `usePageQuery`/page content renderer used elsewhere for read-only page views.
- Produces: `/review/:pageId` route rendering document + comments + `ReviewActionBar` + `ReviewerProgress`.

- [ ] **Step 1: Create `ReviewerProgress`**
```tsx
// apps/client/src/ee/page-verification/components/reviewer-progress.tsx
import { Group, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconCheck, IconClock, IconX, IconMessageQuestion } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { IReviewDecisionEntry } from "@/ee/page-verification/types/page-verification.types";

const ICONS = {
  approved: { icon: IconCheck, color: "teal" },
  rejected: { icon: IconX, color: "red" },
  needs_clarification: { icon: IconMessageQuestion, color: "orange" },
  pending: { icon: IconClock, color: "gray" },
} as const;

export function ReviewerProgress({ reviews }: { reviews: IReviewDecisionEntry[] }) {
  const { t } = useTranslation();
  const pendingCount = reviews.filter((r) => r.decision === "pending").length;

  return (
    <Stack gap="xs">
      <Text size="sm" fw={600} c="dimmed">
        {pendingCount > 0
          ? t("Waiting on {{count}} of {{total}}", { count: pendingCount, total: reviews.length })
          : t("All reviewers have responded")}
      </Text>
      {reviews.map((review) => {
        const { icon: Icon, color } = ICONS[review.decision];
        return (
          <Group key={review.id} gap="xs" wrap="nowrap">
            <CustomAvatar size="sm" avatarUrl={review.verifierAvatarUrl} name={review.verifierName} />
            <Text size="sm" style={{ flex: 1 }}>{review.verifierName}</Text>
            <ThemeIcon size="sm" variant="light" color={color} radius="xl">
              <Icon size={12} />
            </ThemeIcon>
          </Group>
        );
      })}
    </Stack>
  );
}
```

- [ ] **Step 2: Create `ReviewActionBar`**
```tsx
// apps/client/src/ee/page-verification/components/review-action-bar.tsx
import { useState } from "react";
import { Button, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  useApproveReviewMutation,
  useRejectReviewMutation,
  useRequestClarificationMutation,
} from "@/ee/page-verification/queries/page-verification-query";
import { IReviewDecisionEntry } from "@/ee/page-verification/types/page-verification.types";

type Props = {
  pageId: string;
  unresolvedCommentCount: number;
  myReview: IReviewDecisionEntry | undefined;
};

export function ReviewActionBar({ pageId, unresolvedCommentCount, myReview }: Props) {
  const { t } = useTranslation();
  const approveMutation = useApproveReviewMutation();
  const rejectMutation = useRejectReviewMutation();
  const clarifyMutation = useRequestClarificationMutation();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [comment, setComment] = useState("");

  if (myReview && myReview.decision !== "pending") {
    return <Text size="sm" c="dimmed">{t("You already responded to this review.")}</Text>;
  }

  const canApproveReject = unresolvedCommentCount === 0;
  const canClarify = unresolvedCommentCount > 0;

  return (
    <>
      <Group>
        <Button
          color="red"
          variant="light"
          disabled={!canApproveReject}
          onClick={() => setRejectOpen(true)}
        >
          {t("Reject")}
        </Button>
        <Button
          color="dark"
          disabled={!canApproveReject}
          loading={approveMutation.isPending}
          onClick={() => approveMutation.mutate(pageId)}
        >
          {t("Approve")}
        </Button>
        <Button
          variant="outline"
          disabled={!canClarify}
          loading={clarifyMutation.isPending}
          onClick={() => clarifyMutation.mutate(pageId)}
        >
          {t("Need Clarify")}
        </Button>
      </Group>

      <Modal opened={rejectOpen} onClose={() => setRejectOpen(false)} title={t("Reject page")}>
        <Stack>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.currentTarget.value)}
            placeholder={t("Reason for rejecting...")}
            minRows={3}
            required
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setRejectOpen(false)}>{t("Cancel")}</Button>
            <Button
              color="red"
              disabled={!comment.trim()}
              loading={rejectMutation.isPending}
              onClick={() =>
                rejectMutation.mutate(
                  { pageId, comment },
                  { onSuccess: () => setRejectOpen(false) },
                )
              }
            >
              {t("Confirm rejection")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
```

- [ ] **Step 3: Create the review page, composing existing document render + `CommentListWithTabs` + the two new components**
```tsx
// apps/client/src/ee/page-verification/pages/review-page.tsx
import { useParams } from "react-router-dom";
import { Center, Grid, Loader, Stack, Title } from "@mantine/core";
import { useReviewPageQuery } from "@/ee/page-verification/queries/page-verification-query";
import { ReviewActionBar } from "@/ee/page-verification/components/review-action-bar";
import { ReviewerProgress } from "@/ee/page-verification/components/reviewer-progress";
import CommentListWithTabs from "@/features/comment/components/comment-list-with-tabs";
import { usePageQuery } from "@/features/page/queries/page-query";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { useAtom } from "jotai";

export default function ReviewPage() {
  const { pageId } = useParams();
  const { data: payload, isLoading } = useReviewPageQuery(pageId);
  const { data: page } = usePageQuery({ pageId });
  const [currentUser] = useAtom(currentUserAtom);

  if (isLoading || !payload) {
    return (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    );
  }

  const unresolvedCommentCount = 0; // sourced from the existing comment query's active-comment count, wired the same way manage-verification-form.tsx does in Task 10
  const myReview = payload.reviews.find(
    (r) => r.verifierId === currentUser?.user?.id,
  );

  return (
    <Grid p="md">
      <Grid.Col span={8}>
        <Stack>
          <Title order={3}>{page?.title}</Title>
          {/* Reuses the core read-only page content renderer already used by the
              share/PDF views — exact import path confirmed against the codebase
              before wiring (e.g. apps/client/src/pages/page/read-only-page.tsx
              equivalent) rather than re-implementing rendering here. */}
        </Stack>
      </Grid.Col>
      <Grid.Col span={4}>
        <Stack h="100%">
          <ReviewerProgress reviews={payload.reviews} />
          {payload.permissions.isReviewer && (
            <ReviewActionBar
              pageId={pageId!}
              unresolvedCommentCount={unresolvedCommentCount}
              myReview={myReview}
            />
          )}
          <CommentListWithTabs />
        </Stack>
      </Grid.Col>
    </Grid>
  );
}
```
Note: the exact read-only content renderer import must be confirmed by grepping `apps/client/src` for the component used by the existing share/PDF-export page views before finalizing this step — flagged as a follow-up lookup rather than guessed.

- [ ] **Step 4: Register the route**
```tsx
// apps/client/src/App.tsx — near the other Layout-wrapped routes, e.g. after line 106
import ReviewPage from "@/ee/page-verification/pages/review-page.tsx";
// ...
          <Route path={"/review/:pageId"} element={<ReviewPage />} />
```

- [ ] **Step 5: Manual smoke test via the browser preview** — navigate to `/review/<a-known-pageId>` for a page that has an in-approval QMS verification and confirm the action bar, reviewer list, and comment sidebar render without console errors.

- [ ] **Step 6: Commit** — `git add apps/client/src/ee/page-verification/pages/review-page.tsx apps/client/src/ee/page-verification/components/review-action-bar.tsx apps/client/src/ee/page-verification/components/reviewer-progress.tsx apps/client/src/App.tsx && git commit -m "feat(page-verification): add dedicated review page with action bar and reviewer progress"`

---

### Task 10: Client — "Send for Review" gating in manage-verification-form

**Files:**
- Modify: `apps/client/src/ee/page-verification/components/manage-verification-form.tsx:329-637` (`QmsManageContent`)
- Modify: `apps/client/src/ee/page-verification/components/verification-status.ts` (needs_clarification label/color, from Task 8's status list)

**Interfaces:**
- Consumes: `useCommentsQuery({ pageId })` from `@/features/comment/queries/comment-query` (existing hook, same one `CommentListWithTabs` uses) to compute unresolved count client-side for the tooltip; `useSubmitForReviewMutation` from Task 8.
- Produces: disabled "Send for Review" button with tooltip when unresolved comments exist.

- [ ] **Step 1: Add `needs_clarification` to `verification-status.ts`**
```ts
// apps/client/src/ee/page-verification/components/verification-status.ts — getStatusColor
    case "needs_clarification":
      return "orange.8";
```
```ts
// getStatusLabel
    case "needs_clarification":
      return t("Needs Clarification");
```

- [ ] **Step 2: Wire the unresolved-comment count and disabled/tooltip logic into `QmsManageContent`**
```tsx
// apps/client/src/ee/page-verification/components/manage-verification-form.tsx — imports
import { Tooltip } from "@mantine/core";
import { useCommentsQuery } from "@/features/comment/queries/comment-query";
import { useSubmitForReviewMutation } from "@/ee/page-verification/queries/page-verification-query";
```
```tsx
// inside QmsManageContent, alongside the other mutation hooks
  const { data: comments } = useCommentsQuery({ pageId });
  const unresolvedCount =
    comments?.items.filter((c) => !c.parentCommentId && !c.resolvedAt).length ?? 0;
  const submitForReviewMutation = useSubmitForReviewMutation();

  const handleSubmitForReview = () => {
    submitForReviewMutation.mutate(pageId, { onSuccess: onClose });
  };
```
```tsx
// replace the existing "Submit for approval" button block (status === "draft") with:
          {status === "draft" && info.permissions?.canSubmitForApproval && (
            <Tooltip
              label={t("Resolve {{count}} comment(s) before sending for review", { count: unresolvedCount })}
              disabled={unresolvedCount === 0}
            >
              <Button
                onClick={handleSubmitForReview}
                disabled={unresolvedCount > 0}
                loading={submitForReviewMutation.isPending}
                color="dark"
              >
                {t("Send for Review")}
              </Button>
            </Tooltip>
          )}
```
Leave the `status === "approved"` re-submit block calling the existing `submitMutation` (`useSubmitForApprovalMutation`) as a deliberate no-op for this task — it is out of scope per design §9 unless the human wants Task 9/10 to fully replace it; flag this decision explicitly to the human when executing.

- [ ] **Step 3: Manual smoke test** — open a QMS-type page's verification modal in draft status with 1 unresolved comment, confirm the button is disabled with the tooltip; resolve the comment, confirm it becomes enabled.

- [ ] **Step 4: Commit** — `git add apps/client/src/ee/page-verification/components/manage-verification-form.tsx apps/client/src/ee/page-verification/components/verification-status.ts && git commit -m "feat(page-verification): gate Send for Review on unresolved comment count"`

---

### Task 11: Core touch — notification URL override hook-in

**Files:**
- Create: `apps/client/src/ee/page-verification/notification-url-override.ts`
- Modify: `apps/client/src/features/notification/components/notification-item.tsx:71-78`
- Test: `apps/client/src/ee/page-verification/notification-url-override.test.ts` (or co-located per the client's existing test convention — confirm client test runner/config before writing; if none exists for this directory yet, use `vitest` matching the client's `package.json` test script)

**Interfaces:**
- Consumes: `INotification` type from `@/features/notification/types/notification.types`.
- Produces: `getReviewUrlOverride(notification): string | undefined`, used by `notification-item.tsx` as `getReviewUrlOverride(n) ?? defaultPageUrl`.

- [ ] **Step 1: Write a failing test**
```ts
// apps/client/src/ee/page-verification/notification-url-override.test.ts
import { describe, it, expect } from "vitest";
import { getReviewUrlOverride } from "./notification-url-override";

describe("getReviewUrlOverride", () => {
  it("returns a /review/:pageId url for review-eligible notification types", () => {
    const notification = {
      type: "page.approval_requested",
      page: { id: "p1", slugId: "abc", title: "Doc" },
    } as any;

    expect(getReviewUrlOverride(notification)).toBe("/review/p1");
  });

  it("returns undefined for unrelated notification types", () => {
    const notification = { type: "page.updated", page: { id: "p1" } } as any;
    expect(getReviewUrlOverride(notification)).toBeUndefined();
  });
});
```
Run: `pnpm --filter client test notification-url-override` — verify it fails (module doesn't exist).

- [ ] **Step 2: Implement the EE override function**
```ts
// apps/client/src/ee/page-verification/notification-url-override.ts
import { INotification } from "@/features/notification/types/notification.types";

const REVIEW_NOTIFICATION_TYPES = new Set([
  "page.approval_requested",
  "page.approval_rejected",
  "page.approval_clarification_requested",
  "page.reverification_required",
]);

export function getReviewUrlOverride(
  notification: INotification,
): string | undefined {
  if (!notification.page || !REVIEW_NOTIFICATION_TYPES.has(notification.type)) {
    return undefined;
  }
  return `/review/${notification.page.id}`;
}
```

- [ ] **Step 3: Apply the one-line core hook-in**
```tsx
// apps/client/src/features/notification/components/notification-item.tsx — imports
import { getReviewUrlOverride } from "@/ee/page-verification/notification-url-override";
```
```tsx
// replace lines 71-78
  const defaultPageUrl =
    notification.page && notification.space
      ? buildPageUrl(
          notification.space.slug,
          notification.page.slugId,
          notification.page.title,
        )
      : undefined;
  const pageUrl = getReviewUrlOverride(notification) ?? defaultPageUrl;
```

- [ ] **Step 4: Run test, verify passes** — `pnpm --filter client test notification-url-override`

- [ ] **Step 5: Commit** — `git add apps/client/src/ee/page-verification/notification-url-override.ts apps/client/src/ee/page-verification/notification-url-override.test.ts apps/client/src/features/notification/components/notification-item.tsx && git commit -m "feat(page-verification): route review notifications to the review page"`

---

### Task 12: Aggregate-decision service unit tests

**Files:**
- Modify: `apps/server/src/ee/page-verification/page-verification.service.spec.ts` (extend the file started in Task 3)

**Interfaces:**
- Consumes: `PageVerificationService.approve/reject/requestClarification` from Task 3; mocked `PageVerificationRepo`, `CommentRepo` per the `Test.createTestingModule` + `jest.Mocked<Partial<T>>` pattern used in `backlink.service.spec.ts`.
- Produces: coverage for unanimous approval, first-reject-wins, first-clarify-wins, and the 409/`ConflictException` race guard.

- [ ] **Step 1: Write the four scenario tests (all fail initially against a stub, then pass once Task 3 code exists — if Task 3 is already merged, this step still runs first to confirm current behavior is captured, then Step 3 only adds missing edge cases)**
```ts
// apps/server/src/ee/page-verification/page-verification.service.spec.ts — append
import { ConflictException, ForbiddenException } from '@nestjs/common';

describe('PageVerificationService aggregate decisions', () => {
  function buildService(overrides: {
    repo?: Partial<Record<string, jest.Mock>>;
    commentRepo?: Partial<Record<string, jest.Mock>>;
  } = {}) {
    const pageVerificationRepo = {
      findByPageId: jest.fn().mockResolvedValue({
        id: 'pv1', type: 'qms', status: 'in_approval',
        pageId: 'p1', workspaceId: 'w1', spaceId: 's1', requestedById: 'owner',
      }),
      isVerifier: jest.fn().mockResolvedValue(true),
      recordReviewDecision: jest.fn().mockResolvedValue({ id: 'r1', decision: 'approved' }),
      countPendingReviews: jest.fn().mockResolvedValue(0),
      flipStatusIfInApproval: jest.fn().mockResolvedValue({ id: 'pv1', status: 'approved' }),
      ...overrides.repo,
    };
    const commentRepo = {
      countUnresolvedByPageId: jest.fn().mockResolvedValue(0),
      ...overrides.commentRepo,
    };
    const db = {}; // executeTx passes through a fake trx in these unit tests
    const notificationQueue = { add: jest.fn() };

    const service = new (require('./page-verification.service').PageVerificationService)(
      pageVerificationRepo, {}, {}, {}, {}, commentRepo, {}, db, notificationQueue,
    );
    return { service, pageVerificationRepo, commentRepo, notificationQueue };
  }

  it('flips status to approved when this is the last pending reviewer', async () => {
    const { service, pageVerificationRepo } = buildService();
    await service.approve('p1', { id: 'v1' } as any);
    expect(pageVerificationRepo.flipStatusIfInApproval).toHaveBeenCalledWith(
      'pv1', expect.objectContaining({ status: 'approved' }), expect.anything(),
    );
  });

  it('does not flip status when other reviewers are still pending', async () => {
    const { service, pageVerificationRepo } = buildService({
      repo: { countPendingReviews: jest.fn().mockResolvedValue(1) },
    });
    await service.approve('p1', { id: 'v1' } as any);
    expect(pageVerificationRepo.flipStatusIfInApproval).not.toHaveBeenCalled();
  });

  it('reject immediately flips status to draft regardless of other pending reviewers', async () => {
    const { service, pageVerificationRepo } = buildService({
      repo: { flipStatusIfInApproval: jest.fn().mockResolvedValue({ id: 'pv1', status: 'draft' }) },
    });
    await service.reject({ pageId: 'p1', comment: 'needs work' }, { id: 'v1' } as any);
    expect(pageVerificationRepo.flipStatusIfInApproval).toHaveBeenCalledWith(
      'pv1', expect.objectContaining({ status: 'draft', rejectionComment: 'needs work' }), expect.anything(),
    );
  });

  it('request-clarification immediately flips status to needs_clarification when unresolved comments exist', async () => {
    const { service, pageVerificationRepo } = buildService({
      commentRepo: { countUnresolvedByPageId: jest.fn().mockResolvedValue(1) },
      repo: { flipStatusIfInApproval: jest.fn().mockResolvedValue({ id: 'pv1', status: 'needs_clarification' }) },
    });
    await service.requestClarification('p1', { id: 'v1' } as any);
    expect(pageVerificationRepo.flipStatusIfInApproval).toHaveBeenCalledWith(
      'pv1', expect.objectContaining({ status: 'needs_clarification' }), expect.anything(),
    );
  });

  it('throws ConflictException (409) when the cycle was already closed by another verifier', async () => {
    const { service } = buildService({
      repo: { flipStatusIfInApproval: jest.fn().mockResolvedValue(undefined) },
    });
    await expect(
      service.reject({ pageId: 'p1', comment: 'x' }, { id: 'v1' } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('throws ForbiddenException when this verifier has no pending decision to record', async () => {
    const { service } = buildService({
      repo: { recordReviewDecision: jest.fn().mockResolvedValue(undefined) },
    });
    await expect(service.approve('p1', { id: 'v1' } as any)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
```
Note: this test style directly `new`s the service bypassing `executeTx`/Nest DI, which requires `executeTx` in `page-verification.service.ts` to accept a plain object `db` and just invoke the callback with it directly in test doubles — if `executeTx` from `@docmost/db/utils` doesn't tolerate a mock `db`, switch this suite to the full `Test.createTestingModule` + `getKyselyToken()` pattern from Step 1 of Task 3 instead (mocking `executeTx`'s underlying `db.transaction()` chain), which is the safer default — confirm `apps/server/src/database/utils.ts`'s `executeTx` implementation before finalizing this test file.

- [ ] **Step 2: Run test, verify it exercises all four scenarios plus the two guard-exception cases** — `pnpm --filter server test page-verification.service.spec`

- [ ] **Step 3: Run the full server test suite to confirm no regressions from Tasks 1-7** — `pnpm --filter server test`

- [ ] **Step 4: Commit** — `git add apps/server/src/ee/page-verification/page-verification.service.spec.ts && git commit -m "test(page-verification): cover unanimous approval, first-decisive-action-wins, and race guard"`