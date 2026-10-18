import { PageNotificationService } from './page.notification';

const PAGE_ID = '01a14cce-0000-7000-8000-0000000000d1';

function makeDb() {
  const rows: Record<string, any> = {
    users: { id: 'user_1', name: 'User 1' },
    pages: { id: PAGE_ID, title: 'Page', slugId: 'slug_1', spaceId: 'space_1', isBase: false },
    spaces: { id: 'space_1', slug: 'space', name: 'Space' },
  };
  return {
    selectFrom: jest.fn((table: string) => {
      const query: any = {};
      query.select = jest.fn(() => query);
      query.where = jest.fn(() => query);
      query.executeTakeFirst = jest.fn(async () => rows[table]);
      return query;
    }),
  };
}

function makeService(draftUserIds: string[]) {
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
    getState: jest.fn(async () => ({ controlled: true })),
    canAccessDraft: jest.fn(async (user: { id: string }) =>
      draftUserIds.includes(user.id),
    ),
  };
  const service = new PageNotificationService(
    makeDb() as any,
    notificationService as any,
    {} as any,
    spaceMemberRepo as any,
    pagePermissionRepo as any,
    {} as any,
    {} as any,
    {} as any,
    pageApprovalService as any,
    {} as any,
  );
  return { service, notificationService, pageApprovalService };
}

function mentionJob(draftOnly?: boolean) {
  return {
    userMentions: [
      { userId: 'user_draft', mentionId: 'mention_1', creatorId: 'user_1' },
      { userId: 'user_reader', mentionId: 'mention_2', creatorId: 'user_1' },
    ],
    oldMentionedUserIds: [],
    pageId: PAGE_ID,
    spaceId: 'space_1',
    workspaceId: 'ws_1',
    ...(draftOnly === undefined ? {} : { draftOnly }),
  };
}

function notifiedUserIds(notificationService: { create: jest.Mock }) {
  return notificationService.create.mock.calls.map(([data]) => data.userId);
}

describe('PageNotificationService.processPageMention', () => {
  it('notifies only users with draft access for draft mentions', async () => {
    const { service, notificationService, pageApprovalService } = makeService([
      'user_draft',
    ]);

    await service.processPageMention(mentionJob(true), 'https://docs.test');

    expect(notifiedUserIds(notificationService)).toEqual(['user_draft']);
    expect(pageApprovalService.canAccessDraft).toHaveBeenCalledWith(
      { id: 'user_reader' },
      expect.objectContaining({ id: PAGE_ID, spaceId: 'space_1', isBase: false }),
      { controlled: true },
    );
  });

  it('keeps every accessible user for page mentions', async () => {
    const { service, notificationService, pageApprovalService } = makeService([
      'user_draft',
    ]);

    await service.processPageMention(mentionJob(), 'https://docs.test');

    expect(notifiedUserIds(notificationService)).toEqual([
      'user_draft',
      'user_reader',
    ]);
    expect(pageApprovalService.canAccessDraft).not.toHaveBeenCalled();
  });
});
