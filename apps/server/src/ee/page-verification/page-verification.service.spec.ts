import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
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
import { KYSELY_MODULE_CONNECTION_TOKEN } from 'nestjs-kysely';

describe('PageVerificationService.submit', () => {
  it('blocks submit when unresolved comments exist', async () => {
    const pageRepo = { findById: jest.fn().mockResolvedValue({ id: 'p1', spaceId: 's1', creatorId: 'u1', deletedAt: null }) };
    const commentRepo = { countUnresolvedByPageId: jest.fn().mockResolvedValue(2) };
    const pageVerificationRepo = {
      findLatestByPageId: jest.fn().mockResolvedValue({ id: 'pv1', type: 'qms', status: 'draft', workspaceId: 'w1' }),
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
        { provide: KYSELY_MODULE_CONNECTION_TOKEN(), useValue: {} },
        { provide: getQueueToken(QueueName.NOTIFICATION_QUEUE), useValue: { add: jest.fn() } },
      ],
    }).compile();

    const service = module.get(PageVerificationService);

    await expect(service.submit('p1', { id: 'u1' } as any)).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('PageVerificationService.approve', () => {
  // Regression test for the write-skew bug: under READ COMMITTED, two
  // concurrent approve() calls on the last two pending reviews could each
  // see the other's decision as still "pending" via countPendingReviews,
  // and both would skip the flipStatusIfInApproval call — leaving the
  // verification stuck in `in_approval` forever.
  //
  // A full reproduction needs two real, interleaved Postgres transactions
  // (to exercise READ COMMITTED snapshot semantics), which this Jest unit
  // suite (mocked repo/db, no live database) cannot express. Instead this
  // asserts the structural fix: within a single approve() transaction,
  // the parent-row lock (lockForUpdate) is issued before the pending-count
  // check (countPendingReviews) is read. Locking first is what serializes
  // concurrent approve() transactions against each other in production,
  // because the second transaction then blocks on the row lock until the
  // first commits, and therefore observes the first transaction's
  // committed review-decision row instead of a stale/pending one.
  it('locks the parent verification row before checking pending reviews', async () => {
    const callOrder: string[] = [];

    const pageVerificationRepo = {
      findLatestByPageId: jest.fn().mockResolvedValue({
        id: 'pv1',
        type: 'qms',
        status: 'in_approval',
        workspaceId: 'w1',
        pageId: 'p1',
        spaceId: 's1',
        requestedById: 'u2',
      }),
      isVerifier: jest.fn().mockResolvedValue(true),
      lockForUpdate: jest.fn().mockImplementation(async () => {
        callOrder.push('lockForUpdate');
      }),
      recordReviewDecision: jest.fn().mockImplementation(async () => {
        callOrder.push('recordReviewDecision');
        return { id: 'review1', decision: 'approved' };
      }),
      countPendingReviews: jest.fn().mockImplementation(async () => {
        callOrder.push('countPendingReviews');
        return 0;
      }),
      flipStatusIfInApproval: jest.fn().mockImplementation(async () => {
        callOrder.push('flipStatusIfInApproval');
        return { id: 'pv1', status: 'approved' };
      }),
    };

    const commentRepo = { countUnresolvedByPageId: jest.fn().mockResolvedValue(0) };

    const trx = {};
    const db = {
      transaction: () => ({
        execute: (cb: (trx: unknown) => Promise<unknown>) => cb(trx),
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        PageVerificationService,
        { provide: PageVerificationRepo, useValue: pageVerificationRepo },
        { provide: PageRepo, useValue: { findById: jest.fn() } },
        { provide: CommentRepo, useValue: commentRepo },
        { provide: PageHistoryRepo, useValue: { findPageLastHistory: jest.fn() } },
        { provide: PageAccessService, useValue: { validateCanView: jest.fn(), validateCanEdit: jest.fn() } },
        { provide: SpaceMemberRepo, useValue: {} },
        { provide: SpaceAbilityFactory, useValue: { createForUser: jest.fn().mockResolvedValue({ can: () => true }) } },
        { provide: KYSELY_MODULE_CONNECTION_TOKEN(), useValue: db },
        { provide: getQueueToken(QueueName.NOTIFICATION_QUEUE), useValue: { add: jest.fn() } },
      ],
    }).compile();

    const service = module.get(PageVerificationService);

    await service.approve('p1', { id: 'u1' } as any);

    expect(callOrder).toEqual([
      'lockForUpdate',
      'recordReviewDecision',
      'countPendingReviews',
      'flipStatusIfInApproval',
    ]);
    expect(pageVerificationRepo.lockForUpdate).toHaveBeenCalledWith(
      'pv1',
      trx,
    );
  });
});

// Exhaustive coverage of the aggregate multi-reviewer state machine (design
// doc §2/§5): unanimous approval, first-decisive-action-wins for
// reject/request-clarification, resubmit resetting all decisions, the four
// comment gates, the 409 race guard, and authorization (non-verifier /
// already-decided verifier). Builds the service via Test.createTestingModule
// (not a bare `new PageVerificationService(...)`) because `executeTx`
// (apps/server/src/database/utils.ts) calls `db.transaction().execute(cb)` on
// the injected KyselyDB — a plain `{}` stub for `db` would throw, so the
// KYSELY_MODULE_CONNECTION_TOKEN provider must be a fake with a working
// `transaction().execute()` chain, mirroring the `approve` lock-order test
// above.
describe('PageVerificationService aggregate decisions', () => {
  const baseVerification = {
    id: 'pv1',
    type: 'qms',
    status: 'in_approval',
    pageId: 'p1',
    workspaceId: 'w1',
    spaceId: 's1',
    requestedById: 'owner',
  };

  function buildService(
    overrides: {
      repo?: Partial<Record<string, jest.Mock>>;
      commentRepo?: Partial<Record<string, jest.Mock>>;
    } = {},
  ) {
    const pageVerificationRepo = {
      findLatestByPageId: jest.fn().mockResolvedValue({ ...baseVerification }),
      isVerifier: jest.fn().mockResolvedValue(true),
      lockForUpdate: jest.fn().mockResolvedValue(undefined),
      recordReviewDecision: jest
        .fn()
        .mockResolvedValue({ id: 'r1', decision: 'approved' }),
      countPendingReviews: jest.fn().mockResolvedValue(0),
      flipStatusIfInApproval: jest
        .fn()
        .mockResolvedValue({ id: 'pv1', status: 'approved' }),
      resetReviewsForCycle: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      getVerifiers: jest
        .fn()
        .mockResolvedValue([{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }]),
      ...overrides.repo,
    };
    const commentRepo = {
      countUnresolvedByPageId: jest.fn().mockResolvedValue(0),
      ...overrides.commentRepo,
    };
    const pageRepo = {
      findById: jest
        .fn()
        .mockResolvedValue({ id: 'p1', spaceId: 's1', creatorId: 'owner', deletedAt: null }),
    };
    const pageHistoryRepo = {
      findPageLastHistory: jest.fn().mockResolvedValue({ id: 'h1' }),
    };
    const notificationQueue = { add: jest.fn() };

    const trx = {};
    const db = {
      transaction: () => ({
        execute: (cb: (trx: unknown) => Promise<unknown>) => cb(trx),
      }),
    };

    return {
      pageVerificationRepo,
      commentRepo,
      pageRepo,
      pageHistoryRepo,
      notificationQueue,
      trx,
      db,
    };
  }

  async function buildModule(
    overrides: Parameters<typeof buildService>[0] = {},
  ) {
    const mocks = buildService(overrides);

    const module = await Test.createTestingModule({
      providers: [
        PageVerificationService,
        { provide: PageVerificationRepo, useValue: mocks.pageVerificationRepo },
        { provide: PageRepo, useValue: mocks.pageRepo },
        { provide: CommentRepo, useValue: mocks.commentRepo },
        { provide: PageHistoryRepo, useValue: mocks.pageHistoryRepo },
        {
          provide: PageAccessService,
          useValue: { validateCanView: jest.fn(), validateCanEdit: jest.fn() },
        },
        { provide: SpaceMemberRepo, useValue: {} },
        {
          provide: SpaceAbilityFactory,
          useValue: {
            createForUser: jest.fn().mockResolvedValue({ can: () => true }),
          },
        },
        { provide: KYSELY_MODULE_CONNECTION_TOKEN(), useValue: mocks.db },
        {
          provide: getQueueToken(QueueName.NOTIFICATION_QUEUE),
          useValue: mocks.notificationQueue,
        },
      ],
    }).compile();

    const service = module.get(PageVerificationService);
    return { service, ...mocks };
  }

  describe('unanimous approval', () => {
    it('flips status to approved only when this is the last pending reviewer', async () => {
      const { service, pageVerificationRepo } = await buildModule();
      await service.approve('p1', { id: 'v1' } as any);
      expect(pageVerificationRepo.flipStatusIfInApproval).toHaveBeenCalledWith(
        'pv1',
        expect.objectContaining({ status: 'approved' }),
        expect.anything(),
      );
    });

    it('does not flip status when other reviewers are still pending', async () => {
      const { service, pageVerificationRepo } = await buildModule({
        repo: { countPendingReviews: jest.fn().mockResolvedValue(1) },
      });
      await service.approve('p1', { id: 'v1' } as any);
      expect(pageVerificationRepo.flipStatusIfInApproval).not.toHaveBeenCalled();
    });

    it('leaves status untouched (no ConflictException) when an earlier approval was recorded but reviewers remain pending', async () => {
      const { service, pageVerificationRepo } = await buildModule({
        repo: { countPendingReviews: jest.fn().mockResolvedValue(2) },
      });
      await expect(
        service.approve('p1', { id: 'v1' } as any),
      ).resolves.toBeUndefined();
      expect(pageVerificationRepo.flipStatusIfInApproval).not.toHaveBeenCalled();
    });
  });

  describe('first-decisive-action-wins', () => {
    it('reject immediately flips status to draft regardless of other pending reviewers', async () => {
      const { service, pageVerificationRepo } = await buildModule({
        repo: {
          flipStatusIfInApproval: jest
            .fn()
            .mockResolvedValue({ id: 'pv1', status: 'draft' }),
          countPendingReviews: jest.fn().mockResolvedValue(2), // other verifiers still pending
        },
      });
      await service.reject({ pageId: 'p1', comment: 'needs work' }, {
        id: 'v1',
      } as any);
      expect(pageVerificationRepo.flipStatusIfInApproval).toHaveBeenCalledWith(
        'pv1',
        expect.objectContaining({
          status: 'draft',
          rejectedById: 'v1',
          rejectionComment: 'needs work',
        }),
        expect.anything(),
      );
      // Reject is decisive: it never even consults the pending count.
      expect(pageVerificationRepo.countPendingReviews).not.toHaveBeenCalled();
    });

    it('request-clarification immediately flips status to needs_clarification when unresolved comments exist', async () => {
      const { service, pageVerificationRepo } = await buildModule({
        commentRepo: { countUnresolvedByPageId: jest.fn().mockResolvedValue(1) },
        repo: {
          flipStatusIfInApproval: jest
            .fn()
            .mockResolvedValue({ id: 'pv1', status: 'needs_clarification' }),
        },
      });
      await service.requestClarification('p1', { id: 'v1' } as any);
      expect(pageVerificationRepo.flipStatusIfInApproval).toHaveBeenCalledWith(
        'pv1',
        expect.objectContaining({
          status: 'needs_clarification',
          clarificationRequestedById: 'v1',
        }),
        expect.anything(),
      );
    });
  });

  describe('resubmit resets decisions for a fresh cycle', () => {
    it('submit resets ALL current verifiers to pending, discarding stale prior-cycle state', async () => {
      const { service, pageVerificationRepo } = await buildModule({
        repo: {
          findLatestByPageId: jest.fn().mockResolvedValue({
            ...baseVerification,
            status: 'draft',
          }),
        },
      });
      await service.submit('p1', { id: 'owner' } as any);
      expect(pageVerificationRepo.resetReviewsForCycle).toHaveBeenCalledWith(
        'pv1',
        ['v1', 'v2', 'v3'],
        expect.anything(),
      );
    });

    it('submit resets decisions from a needs_clarification cycle too', async () => {
      const { service, pageVerificationRepo } = await buildModule({
        repo: {
          findLatestByPageId: jest.fn().mockResolvedValue({
            ...baseVerification,
            status: 'needs_clarification',
          }),
        },
      });
      await service.submit('p1', { id: 'owner' } as any);
      expect(pageVerificationRepo.resetReviewsForCycle).toHaveBeenCalledWith(
        'pv1',
        ['v1', 'v2', 'v3'],
        expect.anything(),
      );
    });
  });

  describe('comment gates', () => {
    it('blocks approve when unresolved comments exist', async () => {
      const { service } = await buildModule({
        commentRepo: { countUnresolvedByPageId: jest.fn().mockResolvedValue(1) },
      });
      await expect(
        service.approve('p1', { id: 'v1' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks reject when unresolved comments exist', async () => {
      const { service } = await buildModule({
        commentRepo: { countUnresolvedByPageId: jest.fn().mockResolvedValue(1) },
      });
      await expect(
        service.reject({ pageId: 'p1', comment: 'x' }, { id: 'v1' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks request-clarification when there are zero unresolved comments', async () => {
      const { service } = await buildModule({
        commentRepo: { countUnresolvedByPageId: jest.fn().mockResolvedValue(0) },
      });
      await expect(
        service.requestClarification('p1', { id: 'v1' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows request-clarification when unresolved comments exist', async () => {
      const { service } = await buildModule({
        commentRepo: { countUnresolvedByPageId: jest.fn().mockResolvedValue(3) },
      });
      await expect(
        service.requestClarification('p1', { id: 'v1' } as any),
      ).resolves.toBeUndefined();
    });
  });

  describe('race guard: cycle already closed by another verifier', () => {
    it('approve throws ConflictException when flipStatusIfInApproval finds the cycle already closed', async () => {
      const { service } = await buildModule({
        repo: { flipStatusIfInApproval: jest.fn().mockResolvedValue(undefined) },
      });
      await expect(
        service.approve('p1', { id: 'v1' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('reject throws ConflictException when flipStatusIfInApproval finds the cycle already closed', async () => {
      const { service } = await buildModule({
        repo: { flipStatusIfInApproval: jest.fn().mockResolvedValue(undefined) },
      });
      await expect(
        service.reject({ pageId: 'p1', comment: 'x' }, { id: 'v1' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('request-clarification throws ConflictException when flipStatusIfInApproval finds the cycle already closed', async () => {
      const { service } = await buildModule({
        commentRepo: { countUnresolvedByPageId: jest.fn().mockResolvedValue(1) },
        repo: { flipStatusIfInApproval: jest.fn().mockResolvedValue(undefined) },
      });
      await expect(
        service.requestClarification('p1', { id: 'v1' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('authorization', () => {
    it('rejects approve from a non-verifier', async () => {
      const { service } = await buildModule({
        repo: { isVerifier: jest.fn().mockResolvedValue(false) },
      });
      await expect(
        service.approve('p1', { id: 'stranger' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects reject from a non-verifier', async () => {
      const { service } = await buildModule({
        repo: { isVerifier: jest.fn().mockResolvedValue(false) },
      });
      await expect(
        service.reject({ pageId: 'p1', comment: 'x' }, {
          id: 'stranger',
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects request-clarification from a non-verifier', async () => {
      const { service } = await buildModule({
        commentRepo: { countUnresolvedByPageId: jest.fn().mockResolvedValue(1) },
        repo: { isVerifier: jest.fn().mockResolvedValue(false) },
      });
      await expect(
        service.requestClarification('p1', { id: 'stranger' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    // Regression tests for a bug found while writing this suite: approve()
    // already checked recordReviewDecision's return value and threw
    // ForbiddenException when a verifier had no pending row to update (e.g.
    // they already decided this cycle), but reject() and
    // requestClarification() did not — see page-verification.service.ts.
    // Both were fixed alongside this suite to match approve()'s behavior.
    it('rejects approve from a verifier who already decided this cycle', async () => {
      const { service } = await buildModule({
        repo: { recordReviewDecision: jest.fn().mockResolvedValue(undefined) },
      });
      await expect(
        service.approve('p1', { id: 'v1' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects reject from a verifier who already decided this cycle', async () => {
      const { service } = await buildModule({
        repo: { recordReviewDecision: jest.fn().mockResolvedValue(undefined) },
      });
      await expect(
        service.reject({ pageId: 'p1', comment: 'x' }, { id: 'v1' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects request-clarification from a verifier who already decided this cycle', async () => {
      const { service } = await buildModule({
        commentRepo: { countUnresolvedByPageId: jest.fn().mockResolvedValue(1) },
        repo: { recordReviewDecision: jest.fn().mockResolvedValue(undefined) },
      });
      await expect(
        service.requestClarification('p1', { id: 'v1' } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

function buildBaseProviders(overrides: {
  pageVerificationRepo?: Record<string, jest.Mock>;
  commentRepo?: Record<string, jest.Mock>;
  pageHistoryRepo?: Record<string, jest.Mock>;
  db?: unknown;
}) {
  return [
    PageVerificationService,
    { provide: PageVerificationRepo, useValue: overrides.pageVerificationRepo },
    {
      provide: PageRepo,
      useValue: {
        findById: jest
          .fn()
          .mockResolvedValue({ id: 'p1', spaceId: 's1', creatorId: 'u1', deletedAt: null }),
      },
    },
    { provide: CommentRepo, useValue: overrides.commentRepo ?? { countUnresolvedByPageId: jest.fn().mockResolvedValue(0) } },
    { provide: PageHistoryRepo, useValue: overrides.pageHistoryRepo ?? { findPageLastHistory: jest.fn().mockResolvedValue({ id: 'h1' }) } },
    { provide: PageAccessService, useValue: { validateCanView: jest.fn(), validateCanEdit: jest.fn() } },
    { provide: SpaceMemberRepo, useValue: {} },
    { provide: SpaceAbilityFactory, useValue: { createForUser: jest.fn().mockResolvedValue({ can: () => true }) } },
    { provide: KYSELY_MODULE_CONNECTION_TOKEN(), useValue: overrides.db ?? {} },
    { provide: getQueueToken(QueueName.NOTIFICATION_QUEUE), useValue: { add: jest.fn() } },
  ];
}

// Regression coverage for Critical Finding 2: submit() must scope its
// status/pageHistoryId write to the resolved verification row's `id`, not a
// bare pageId — otherwise it would also flip any retained `approved` audit
// row for the same page back to `in_approval`.
describe('PageVerificationService.submit row-scoping', () => {
  it('writes to the specific verification id returned by findLatestByPageId, not the raw pageId', async () => {
    const updateSpy = jest.fn().mockResolvedValue(undefined);
    const pageVerificationRepo = {
      findLatestByPageId: jest.fn().mockResolvedValue({
        id: 'pv-current-cycle',
        type: 'qms',
        status: 'draft',
        workspaceId: 'w1',
      }),
      getVerifiers: jest.fn().mockResolvedValue([{ id: 'v1' }]),
      update: updateSpy,
      resetReviewsForCycle: jest.fn().mockResolvedValue(undefined),
    };
    const db = {
      transaction: () => ({
        execute: (cb: (trx: unknown) => Promise<unknown>) => cb({}),
      }),
    };

    const module = await Test.createTestingModule({
      providers: buildBaseProviders({ pageVerificationRepo, db }),
    }).compile();

    const service = module.get(PageVerificationService);
    await service.submit('p1', { id: 'u1' } as any);

    expect(updateSpy).toHaveBeenCalledWith(
      'pv-current-cycle',
      expect.objectContaining({ status: 'in_approval' }),
      expect.anything(),
    );
    // The raw pageId ('p1') must never be passed as the id-scoped argument —
    // that would match every historical row for the page.
    expect(updateSpy.mock.calls[0][0]).not.toBe('p1');
  });
});

// Regression coverage for Critical Finding 1: the old single-reviewer
// verify()/submitForApproval()/rejectApproval() endpoints must not be able
// to bypass the new unanimous multi-reviewer approval requirement for QMS
// verifications. They should reject with a clear error instead of silently
// flipping status.
describe('PageVerificationService old single-reviewer QMS bypass guard', () => {
  it('verify() throws for a qms verification instead of one-click approving', async () => {
    const pageVerificationRepo = {
      findByPageId: jest.fn().mockResolvedValue({
        id: 'pv1',
        type: 'qms',
        status: 'in_approval',
        workspaceId: 'w1',
      }),
      isVerifier: jest.fn().mockResolvedValue(true),
      update: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: buildBaseProviders({ pageVerificationRepo }),
    }).compile();

    const service = module.get(PageVerificationService);

    await expect(
      service.verify('p1', { id: 'u1' } as any),
    ).rejects.toThrow(BadRequestException);
    expect(pageVerificationRepo.update).not.toHaveBeenCalled();
  });

  it('verify() still works for non-qms (expiring) verifications', async () => {
    const pageVerificationRepo = {
      findByPageId: jest.fn().mockResolvedValue({
        id: 'pv1',
        type: 'expiring',
        status: null,
        mode: 'indefinite',
        workspaceId: 'w1',
      }),
      isVerifier: jest.fn().mockResolvedValue(true),
      update: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: buildBaseProviders({ pageVerificationRepo }),
    }).compile();

    const service = module.get(PageVerificationService);

    await expect(
      service.verify('p1', { id: 'u1' } as any),
    ).resolves.toBeUndefined();
    expect(pageVerificationRepo.update).toHaveBeenCalledWith(
      'pv1',
      expect.objectContaining({ verifiedById: 'u1' }),
    );
  });

  it('submitForApproval() throws for a qms verification', async () => {
    const pageVerificationRepo = {
      findByPageId: jest.fn().mockResolvedValue({
        id: 'pv1',
        type: 'qms',
        status: 'draft',
        workspaceId: 'w1',
      }),
      update: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: buildBaseProviders({ pageVerificationRepo }),
    }).compile();

    const service = module.get(PageVerificationService);

    await expect(
      service.submitForApproval('p1', { id: 'u1' } as any),
    ).rejects.toThrow(BadRequestException);
    expect(pageVerificationRepo.update).not.toHaveBeenCalled();
  });

  it('rejectApproval() throws for a qms verification instead of one-click rejecting', async () => {
    const pageVerificationRepo = {
      findByPageId: jest.fn().mockResolvedValue({
        id: 'pv1',
        type: 'qms',
        status: 'in_approval',
        workspaceId: 'w1',
      }),
      isVerifier: jest.fn().mockResolvedValue(true),
      update: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: buildBaseProviders({ pageVerificationRepo }),
    }).compile();

    const service = module.get(PageVerificationService);

    await expect(
      service.rejectApproval({ pageId: 'p1', comment: 'no' }, { id: 'u1' } as any),
    ).rejects.toThrow(BadRequestException);
    expect(pageVerificationRepo.update).not.toHaveBeenCalled();
  });
});
