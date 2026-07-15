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
