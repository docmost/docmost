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
