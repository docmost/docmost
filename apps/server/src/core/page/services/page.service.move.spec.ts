import { PageService } from './page.service';

const SPACE_ID = '019a1f00-0000-7000-8000-000000000001';
const MOVED_ID = '019a1f00-0000-7000-8000-000000000002';
const OLD_PARENT_ID = '019a1f00-0000-7000-8000-000000000003';
const NEW_PARENT_ID = '019a1f00-0000-7000-8000-000000000004';
const MOVED_SLUG = 'movedSlug1';
const NEW_PARENT_SLUG = 'parentSlug';
const POSITION = 'a0abc';

const movedPage = {
  id: MOVED_ID,
  slugId: MOVED_SLUG,
  spaceId: SPACE_ID,
  parentPageId: OLD_PARENT_ID,
  deletedAt: null,
};

const newParent = {
  id: NEW_PARENT_ID,
  slugId: NEW_PARENT_SLUG,
  spaceId: SPACE_ID,
  parentPageId: null,
  deletedAt: null,
};

describe('PageService movePage', () => {
  const trx = {};

  function makeService() {
    const pageRepo = {
      lockPageHierarchySpaces: jest.fn(async () => undefined),
      findById: jest.fn(async (pageId: string) =>
        [movedPage, newParent].find(
          (page) => page.id === pageId || page.slugId === pageId,
        ),
      ),
      isPageDescendant: jest.fn(async () => false),
      updatePage: jest.fn(async () => undefined),
    };
    const pagePermissionRepo = {
      hasRestrictedPagesInSpace: jest.fn(async () => true),
    };
    const db = {
      transaction: () => ({
        execute: (callback: (t: unknown) => Promise<unknown>) => callback(trx),
      }),
    };
    const wsService = {
      removeBaseSubscribersWithoutAccess: jest.fn(async () => undefined),
    };
    const collabAccessService = {
      recheckAccess: jest.fn(async () => undefined),
    };

    const service = new PageService(
      pageRepo as any,
      pagePermissionRepo as any,
      {} as any,
      db as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      wsService as any,
      collabAccessService as any,
    );

    return { service, pageRepo, wsService, collabAccessService };
  }

  it('resolves slugs when moving under a new parent', async () => {
    const { service, pageRepo } = makeService();

    await service.movePage(
      {
        pageId: MOVED_SLUG,
        parentPageId: NEW_PARENT_SLUG,
        position: POSITION,
      },
      movedPage as any,
    );

    expect(pageRepo.isPageDescendant).toHaveBeenCalledWith(
      MOVED_ID,
      NEW_PARENT_ID,
      trx,
    );
    expect(pageRepo.updatePage).toHaveBeenCalledWith(
      { position: POSITION, parentPageId: NEW_PARENT_ID },
      MOVED_ID,
      trx,
    );
  });

  it('rechecks access by page id after a slug page moves to the root', async () => {
    const { service, wsService, collabAccessService } = makeService();

    await service.movePage(
      { pageId: MOVED_SLUG, parentPageId: null, position: POSITION },
      movedPage as any,
    );

    expect(collabAccessService.recheckAccess).toHaveBeenCalledWith({
      pageIds: [MOVED_ID],
    });
    expect(wsService.removeBaseSubscribersWithoutAccess).toHaveBeenCalledWith([
      MOVED_ID,
    ]);
  });
});
