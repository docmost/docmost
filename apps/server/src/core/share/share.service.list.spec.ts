import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { ShareService } from './share.service';

const WORKSPACE_ID = '019a1f00-0000-7000-8000-000000000040';
const USER_ID = '019a1f00-0000-7000-8000-000000000041';
const CREATOR_ID = '019a1f00-0000-7000-8000-000000000042';
const SPACE_ID = '019a1f00-0000-7000-8000-000000000043';
const OPEN_PAGE_ID = '019a1f00-0000-7000-8000-000000000044';
const RESTRICTED_PAGE_ID = '019a1f00-0000-7000-8000-000000000045';
const OPEN_SHARE_ID = '019a1f00-0000-7000-8000-000000000046';
const RESTRICTED_SHARE_ID = '019a1f00-0000-7000-8000-000000000047';

const META = {
  limit: 20,
  hasNextPage: true,
  hasPrevPage: false,
  nextCursor: 'next-cursor',
  prevCursor: null,
};

function shareRow(id: string, key: string, pageId: string, title: string) {
  return {
    id,
    key,
    pageId,
    includeSubPages: false,
    searchIndexing: false,
    creatorId: CREATOR_ID,
    spaceId: SPACE_ID,
    workspaceId: WORKSPACE_ID,
    createdAt: new Date('2026-11-01T09:00:00Z'),
    updatedAt: new Date('2026-11-01T09:00:00Z'),
    deletedAt: null,
    page: { id: pageId, title, slugId: `${key}slug`, icon: null },
    space: { id: SPACE_ID, name: 'Handbook', slug: 'handbook', userRole: 'writer' },
    creator: { id: CREATOR_ID, name: 'Sam Lee', avatarUrl: null },
  };
}

// The user can open every page except RESTRICTED_PAGE_ID; any other user can open none.
function makeService() {
  const shareRepo = {
    getShares: async () => ({
      items: [
        shareRow(OPEN_SHARE_ID, 'k1a2b3', OPEN_PAGE_ID, 'Onboarding'),
        shareRow(RESTRICTED_SHARE_ID, 'k4d5e6', RESTRICTED_PAGE_ID, 'Salaries'),
      ],
      meta: { ...META },
    }),
  };
  const pagePermissionRepo = {
    filterAccessiblePageIds: async (opts: { pageIds: string[]; userId: string }) =>
      opts.userId === USER_ID
        ? opts.pageIds.filter((id) => id !== RESTRICTED_PAGE_ID)
        : [],
  };
  return new ShareService(
    shareRepo as any,
    {} as any,
    pagePermissionRepo as any,
    {} as any,
    {} as any,
    {} as any,
  );
}

const pagination = { limit: 20 } as PaginationOptions;

describe('ShareService.getShares', () => {
  it('lists only shares whose pages the user can open', async () => {
    const result = await makeService().getShares(USER_ID, pagination);

    expect(result.items.map((share) => share.id)).toEqual([OPEN_SHARE_ID]);
  });

  it('keeps the page cursor when it drops a share', async () => {
    const result = await makeService().getShares(USER_ID, pagination);

    expect(result.meta).toEqual(META);
  });
});
