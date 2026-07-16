import { Test } from '@nestjs/testing';
import { KYSELY_MODULE_CONNECTION_TOKEN } from 'nestjs-kysely';

jest.mock(
  '../../integrations/transactional/emails/approval-clarification-email',
  () => ({ ApprovalClarificationEmail: jest.fn(() => null) }),
  { virtual: true },
);
jest.mock(
  '../../integrations/transactional/emails/reverification-required-email',
  () => ({ ReverificationRequiredEmail: jest.fn(() => null) }),
  { virtual: true },
);

import { ReviewNotificationService } from './review-notification.service';
import { NotificationService } from '../../core/notification/notification.service';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';

describe('ReviewNotificationService', () => {
  const page = { id: 'p1', title: 'My Page', slugId: 'slug-1' };
  const space = { id: 's1', slug: 'space-1', name: 'Space One' };

  const buildService = () => {
    const db: any = {
      selectFrom: jest.fn((table: string) => ({
        select: jest.fn().mockReturnThis(),
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(
          table === 'pages'
            ? page
            : table === 'spaces'
              ? space
              : table === 'users'
                ? { name: 'Reviewer' }
                : undefined,
        ),
      })),
    };

    const notificationService = {
      create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      queueEmail: jest.fn().mockResolvedValue(undefined),
    };

    const spaceMemberRepo = {
      getUserIdsWithSpaceAccess: jest
        .fn()
        .mockImplementation((userIds: string[]) => Promise.resolve(new Set(userIds))),
    };

    const pagePermissionRepo = {
      getUserIdsWithPageAccess: jest
        .fn()
        .mockImplementation((_pageId: string, userIds: string[]) => Promise.resolve(userIds)),
    };

    return {
      db,
      notificationService,
      spaceMemberRepo,
      pagePermissionRepo,
    };
  };

  const createModule = async (mocks: ReturnType<typeof buildService>) => {
    const module = await Test.createTestingModule({
      providers: [
        ReviewNotificationService,
        { provide: KYSELY_MODULE_CONNECTION_TOKEN(), useValue: mocks.db },
        { provide: NotificationService, useValue: mocks.notificationService },
        { provide: SpaceMemberRepo, useValue: mocks.spaceMemberRepo },
        { provide: PagePermissionRepo, useValue: mocks.pagePermissionRepo },
      ],
    }).compile();

    return module.get(ReviewNotificationService);
  };

  it('processApprovalClarification inserts an in-app notification for the requester and emails them', async () => {
    const mocks = buildService();
    const service = await createModule(mocks);

    await service.processApprovalClarification(
      {
        pageId: 'p1',
        spaceId: 's1',
        workspaceId: 'w1',
        actorId: 'reviewer-1',
        requestedById: 'contributor-1',
      },
      'https://app.example.com',
    );

    expect(mocks.notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'contributor-1',
        pageId: 'p1',
        spaceId: 's1',
        workspaceId: 'w1',
        actorId: 'reviewer-1',
      }),
    );
    expect(mocks.notificationService.queueEmail).toHaveBeenCalledTimes(1);
  });

  it('processReverificationRequired notifies every accessible verifier', async () => {
    const mocks = buildService();
    const service = await createModule(mocks);

    await service.processReverificationRequired(
      {
        pageId: 'p1',
        spaceId: 's1',
        workspaceId: 'w1',
        verifierIds: ['verifier-1', 'verifier-2'],
      },
      'https://app.example.com',
    );

    expect(mocks.notificationService.create).toHaveBeenCalledTimes(2);
    expect(mocks.notificationService.queueEmail).toHaveBeenCalledTimes(2);
  });

  it('processReverificationRequired does nothing when there are no verifiers', async () => {
    const mocks = buildService();
    const service = await createModule(mocks);

    await service.processReverificationRequired(
      {
        pageId: 'p1',
        spaceId: 's1',
        workspaceId: 'w1',
        verifierIds: [],
      },
      'https://app.example.com',
    );

    expect(mocks.notificationService.create).not.toHaveBeenCalled();
  });
});
