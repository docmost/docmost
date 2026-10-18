import { CommentNotificationService } from './comment.notification';

const PAGE_ID = '01a14cce-0000-7000-8000-0000000000e1';
const PAGE_ROW = {
  id: PAGE_ID,
  title: 'Page',
  slugId: 'slug_1',
  spaceId: 'space_1',
  isBase: false,
};

function makeDb() {
  const rows: Record<string, any> = {
    users: { id: 'actor', name: 'Actor' },
    pages: PAGE_ROW,
    spaces: { id: 'space_1', slug: 'space' },
  };
  return {
    selectFrom: jest.fn((table: string) => {
      const query: any = {};
      query.select = jest.fn(() => query);
      query.where = jest.fn(() => query);
      query.executeTakeFirst = jest.fn(async () => rows[table]);
      query.execute = jest.fn(async () =>
        table === 'comments'
          ? [{ creatorId: 'user_draft' }, { creatorId: 'user_reader' }]
          : [],
      );
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
    getUserSpaceRoles: jest.fn(async (userId: string) => [
      { userId, role: 'reader' },
    ]),
  };
  const pagePermissionRepo = {
    getUserIdsWithPageAccess: jest.fn(
      async (_pageId: string, userIds: string[]) => userIds,
    ),
  };
  const watcherRepo = {
    getPageWatcherIds: jest.fn(async () => ['user_draft', 'user_reader']),
  };
  const pageApprovalService = {
    getUserIdsWithDraftAccess: jest.fn(async (_page: unknown, ids: string[]) =>
      ids.filter((id) => draftUserIds.includes(id)),
    ),
  };
  const service = new CommentNotificationService(
    makeDb() as any,
    notificationService as any,
    spaceMemberRepo as any,
    pagePermissionRepo as any,
    watcherRepo as any,
    pageApprovalService as any,
  );
  return { service, notificationService, pageApprovalService };
}

const commentJob = (overrides: Record<string, unknown> = {}) => ({
  commentId: 'comment_1',
  pageId: PAGE_ID,
  spaceId: 'space_1',
  workspaceId: 'ws_1',
  actorId: 'actor',
  mentionedUserIds: [],
  notifyWatchers: true,
  ...overrides,
});

const notified = (notificationService: { create: jest.Mock }) =>
  notificationService.create.mock.calls.map(([data]) => data.userId);

describe('CommentNotificationService.processComment', () => {
  it('notifies only draft users about internal threads', async () => {
    const { service, notificationService, pageApprovalService } = makeService([
      'user_draft',
    ]);

    await service.processComment(
      commentJob({ draftOnly: true }),
      'https://docs.test',
    );

    expect(notified(notificationService)).toEqual(['user_draft']);
    expect(pageApprovalService.getUserIdsWithDraftAccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: PAGE_ID, spaceId: 'space_1', isBase: false }),
      ['user_draft', 'user_reader'],
    );
  });

  it('keeps thread replies and mentions of internal threads among draft users', async () => {
    const { service, notificationService } = makeService(['user_draft']);

    await service.processComment(
      commentJob({
        draftOnly: true,
        notifyWatchers: false,
        parentCommentId: 'root_1',
        mentionedUserIds: ['user_reader'],
      }),
      'https://docs.test',
    );

    expect(notified(notificationService)).toEqual(['user_draft']);
  });

  it('notifies every user with page access about public comments', async () => {
    const { service, notificationService, pageApprovalService } = makeService([
      'user_draft',
    ]);

    await service.processComment(commentJob(), 'https://docs.test');

    expect(notified(notificationService)).toEqual(['user_draft', 'user_reader']);
    expect(pageApprovalService.getUserIdsWithDraftAccess).not.toHaveBeenCalled();
  });
});

describe('CommentNotificationService.processResolved', () => {
  const resolvedJob = (creatorId: string, draftOnly?: boolean) => ({
    commentId: 'comment_1',
    commentCreatorId: creatorId,
    pageId: PAGE_ID,
    spaceId: 'space_1',
    workspaceId: 'ws_1',
    actorId: 'actor',
    ...(draftOnly === undefined ? {} : { draftOnly }),
  });

  it('skips a creator without draft access for an internal thread', async () => {
    const { service, notificationService } = makeService(['user_draft']);

    await service.processResolved(
      resolvedJob('user_reader', true),
      'https://docs.test',
    );

    expect(notificationService.create).not.toHaveBeenCalled();
  });

  it('notifies a draft user creator of an internal thread', async () => {
    const { service, notificationService } = makeService(['user_draft']);

    await service.processResolved(
      resolvedJob('user_draft', true),
      'https://docs.test',
    );

    expect(notified(notificationService)).toEqual(['user_draft']);
  });

  it('notifies a reader creator of a public thread without a draft check', async () => {
    const { service, notificationService, pageApprovalService } = makeService(
      [],
    );

    await service.processResolved(resolvedJob('user_reader'), 'https://docs.test');

    expect(notified(notificationService)).toEqual(['user_reader']);
    expect(pageApprovalService.getUserIdsWithDraftAccess).not.toHaveBeenCalled();
  });
});
