import { NotificationService } from './notification.service';

const USER_ID = '019a6c00-0000-7000-8000-000000000001';
const OPEN_PAGE_ID = '019a6c00-0000-7000-8000-000000000002';
const RESTRICTED_PAGE_ID = '019a6c00-0000-7000-8000-000000000003';

describe('NotificationService.getUnreadCount', () => {
  it('leaves out unread notifications on pages the user can no longer open', async () => {
    const unreadCountsByPageId = [
      { pageId: null, count: 2 },
      { pageId: OPEN_PAGE_ID, count: 3 },
      { pageId: RESTRICTED_PAGE_ID, count: 4 },
    ];
    const notificationRepo = {
      getUnreadCountsByPageId: async (userId: string) =>
        userId === USER_ID ? unreadCountsByPageId : [],
    };
    const pagePermissionRepo = {
      filterAccessiblePageIds: async (opts: {
        pageIds: string[];
        userId: string;
      }) =>
        opts.userId === USER_ID
          ? opts.pageIds.filter((id) => id === OPEN_PAGE_ID)
          : [],
    };
    const service = new NotificationService(
      notificationRepo as any,
      pagePermissionRepo as any,
      undefined,
      undefined,
      undefined,
      undefined,
    );

    await expect(service.getUnreadCount(USER_ID)).resolves.toBe(5);
  });
});
