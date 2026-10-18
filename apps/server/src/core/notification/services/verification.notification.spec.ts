import { VerificationNotificationService } from './verification.notification';
import { buildApprovalState } from '../../page/approval/page-approval.utils';
import { NotificationType } from '../notification.constants';

const PAGE_ID = '01a14cce-0000-7000-8000-0000000000e1';
const SPACE_ID = 'space_1';
const CONTROLLED = buildApprovalState({
  isBase: false,
  verificationId: 'verification_1',
  verificationType: 'qms',
  verificationStatus: 'in_approval',
  readerVersionId: 'history_1',
});
const UNCONTROLLED = buildApprovalState({ isBase: false });

function makeDb() {
  const rows: Record<string, any> = {
    users: { id: 'actor', name: 'Actor' },
    pages: { id: PAGE_ID, title: 'Page', slugId: 'slug_1' },
    spaces: { id: SPACE_ID, slug: 'space', name: 'Space' },
  };
  return {
    selectFrom: jest.fn((table: string) => {
      const query: any = {};
      query.select = jest.fn(() => query);
      query.where = jest.fn(() => query);
      query.executeTakeFirst = jest.fn(async () => rows[table]);
      query.execute = jest.fn(async () => []);
      return query;
    }),
  };
}

function makeService(state: any, draftUserIds: string[]) {
  const notificationService = {
    create: jest.fn(async (data: { userId: string }) => ({
      id: `notification_${data.userId}`,
    })),
    queueEmail: jest.fn(async () => undefined),
  };
  const spaceMemberRepo = {
    getUserIdsWithSpaceAccess: jest.fn(
      async (userIds: string[]) => new Set(userIds),
    ),
  };
  const pagePermissionRepo = {
    getUserIdsWithPageAccess: jest.fn(
      async (_pageId: string, userIds: string[]) => userIds,
    ),
  };
  const pageApprovalService = {
    getState: jest.fn(async () => state),
    getUserIdsWithDraftAccess: jest.fn(async (_page: unknown, ids: string[]) =>
      ids.filter((id) => draftUserIds.includes(id)),
    ),
  };
  const service = new VerificationNotificationService(
    makeDb() as any,
    notificationService as any,
    spaceMemberRepo as any,
    pagePermissionRepo as any,
    pageApprovalService as any,
  );
  return { service, notificationService, pageApprovalService };
}

const job = {
  pageId: PAGE_ID,
  spaceId: SPACE_ID,
  workspaceId: 'ws_1',
  actorId: 'actor',
};

describe('VerificationNotificationService on approval pages', () => {
  it('approval requests reach only recipients with draft access', async () => {
    const { service, notificationService, pageApprovalService } = makeService(
      CONTROLLED,
      ['user_approver'],
    );

    await service.processApprovalRequested(
      { ...job, verifierIds: ['user_approver', 'user_former_approver'] },
      'https://docmost.test',
    );

    expect(pageApprovalService.getUserIdsWithDraftAccess).toHaveBeenCalledWith(
      { id: PAGE_ID, spaceId: SPACE_ID, isBase: false },
      ['user_approver', 'user_former_approver'],
      CONTROLLED,
    );
    expect(notificationService.create).toHaveBeenCalledTimes(1);
    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_approver',
        type: NotificationType.PAGE_APPROVAL_REQUESTED,
      }),
    );
  });

  it('a returned submission is not sent to a requester who lost draft access', async () => {
    const { service, notificationService } = makeService(CONTROLLED, []);

    await service.processApprovalRejected(
      { ...job, requestedById: 'user_requester', comment: 'Internal notes' },
      'https://docmost.test',
    );

    expect(notificationService.create).not.toHaveBeenCalled();
    expect(notificationService.queueEmail).not.toHaveBeenCalled();
  });

  it('pages without approval keep the page access filter only', async () => {
    const { service, notificationService, pageApprovalService } = makeService(
      UNCONTROLLED,
      [],
    );

    await service.processApprovalRejected(
      { ...job, requestedById: 'user_requester', comment: null },
      'https://docmost.test',
    );

    expect(pageApprovalService.getUserIdsWithDraftAccess).not.toHaveBeenCalled();
    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_requester' }),
    );
  });
});
