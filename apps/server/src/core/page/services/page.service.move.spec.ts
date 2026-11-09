import {
  CamelCasePlugin,
  CompiledQuery,
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
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
      {} as any,
      {} as any,
      {} as any,
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

describe('PageService movePageToSpace', () => {
  const WORKSPACE_ID = '019a1f00-0000-7000-8000-000000000010';
  const USER_ID = '019a1f00-0000-7000-8000-000000000011';
  const SOURCE_SPACE_ID = '019a1f00-0000-7000-8000-000000000012';
  const OPEN_SPACE_ID = '019a1f00-0000-7000-8000-000000000013';
  const CLOSED_SPACE_ID = '019a1f00-0000-7000-8000-000000000014';
  const ROOT_ID = '019a1f00-0000-7000-8000-000000000015';
  const CHILD_ID = '019a1f00-0000-7000-8000-000000000016';
  const SHARE_ID = '019a1f00-0000-7000-8000-000000000017';

  const rootPage = {
    id: ROOT_ID,
    slugId: 'rootSlug01',
    title: 'Roadmap',
    spaceId: SOURCE_SPACE_ID,
    workspaceId: WORKSPACE_ID,
    parentPageId: null,
    deletedAt: null,
  };

  const childPage = {
    id: CHILD_ID,
    slugId: 'childSlug1',
    title: 'Milestones',
    spaceId: SOURCE_SPACE_ID,
    workspaceId: WORKSPACE_ID,
    parentPageId: ROOT_ID,
    deletedAt: null,
  };

  // answers the shares delete with the root page's share, everything else with no rows
  function makeService() {
    const queries: CompiledQuery[] = [];
    const driver = new DummyDriver();
    driver.acquireConnection = async () =>
      ({
        executeQuery: async (query: CompiledQuery) => ({
          rows: query.sql.startsWith('delete from "shares"')
            ? [{ id: SHARE_ID, page_id: ROOT_ID, space_id: SOURCE_SPACE_ID }]
            : [],
        }),
        streamQuery: async function* () {},
      }) as any;
    const db = new Kysely<any>({
      dialect: {
        createAdapter: () => new PostgresAdapter(),
        createDriver: () => driver,
        createIntrospector: (kysely) => new PostgresIntrospector(kysely),
        createQueryCompiler: () => new PostgresQueryCompiler(),
      },
      plugins: [new CamelCasePlugin()],
      log: (event) => {
        if (event.level === 'query') queries.push(event.query);
      },
    });

    const pageRepo = {
      lockPageHierarchySpaces: jest.fn(async () => undefined),
      findById: jest.fn(async () => rootPage),
      getPageAndDescendants: jest.fn(async () => [rootPage, childPage]),
      updatePage: jest.fn(async () => undefined),
      updatePages: jest.fn(async () => undefined),
    };
    const pagePermissionRepo = {
      filterAccessiblePageIds: jest.fn(async () => [ROOT_ID, CHILD_ID]),
    };
    const shareService = {
      isSharingAllowed: jest.fn(
        async (workspaceId: string, spaceId: string) =>
          workspaceId === WORKSPACE_ID &&
          [SOURCE_SPACE_ID, OPEN_SPACE_ID].includes(spaceId),
      ),
    };

    const service = new PageService(
      pageRepo as any,
      pagePermissionRepo as any,
      { updateAttachmentsByPageId: jest.fn(async () => undefined) } as any,
      db as any,
      {} as any,
      {} as any,
      { add: jest.fn(async () => undefined) } as any,
      {} as any,
      {} as any,
      {} as any,
      { movePageWatchersToSpace: jest.fn(async () => undefined) } as any,
      {} as any,
      {} as any,
      {
        invalidateSpaceRestrictionCache: jest.fn(async () => undefined),
        removeBaseSubscribersWithoutAccess: jest.fn(async () => undefined),
      } as any,
      { recheckAccess: jest.fn(async () => undefined) } as any,
      shareService as any,
      {} as any,
      {} as any,
    );

    const sharesQueries = () =>
      queries.filter((query) =>
        /^(update|delete from) "shares"/.test(query.sql),
      );

    const homeClearQueries = () =>
      queries.filter((query) =>
        /^update "spaces" set "home_page_id" = .+ where "home_page_id" in \(/.test(
          query.sql,
        ),
      );

    return { service, sharesQueries, homeClearQueries };
  }

  it('deletes the shares of moved pages when the target space has public sharing disabled', async () => {
    const { service, sharesQueries } = makeService();

    const result = await service.movePageToSpace(
      rootPage as any,
      CLOSED_SPACE_ID,
      USER_ID,
    );

    expect(sharesQueries()).toEqual([
      expect.objectContaining({
        sql: expect.stringMatching(
          /^delete from "shares" where "page_id" in \(\$1, \$2\)/,
        ),
        parameters: [ROOT_ID, CHILD_ID],
      }),
    ]);
    expect(result.deletedShares).toEqual([
      { id: SHARE_ID, pageId: ROOT_ID, spaceId: SOURCE_SPACE_ID },
    ]);
  });

  it('moves shares with their pages when the target space allows public sharing', async () => {
    const { service, sharesQueries } = makeService();

    const result = await service.movePageToSpace(
      rootPage as any,
      OPEN_SPACE_ID,
      USER_ID,
    );

    expect(sharesQueries()).toEqual([
      expect.objectContaining({
        sql: expect.stringMatching(
          /^update "shares" set "space_id" = \$1 where "page_id" in \(\$2, \$3\)/,
        ),
        parameters: [OPEN_SPACE_ID, ROOT_ID, CHILD_ID],
      }),
    ]);
    expect(result.deletedShares).toEqual([]);
  });

  it('clears the space home when its page moves to another space', async () => {
    const { service, homeClearQueries } = makeService();

    await service.movePageToSpace(rootPage as any, OPEN_SPACE_ID, USER_ID);

    expect(homeClearQueries()).toHaveLength(1);
    expect(homeClearQueries()[0].parameters[0]).toBeNull();
    expect(homeClearQueries()[0].parameters).toEqual(
      expect.arrayContaining([ROOT_ID, CHILD_ID]),
    );
  });
});
