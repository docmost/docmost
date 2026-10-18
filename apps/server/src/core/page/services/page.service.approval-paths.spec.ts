import { ForbiddenException } from '@nestjs/common';
import {
  CamelCasePlugin,
  CompiledQuery,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { PageService } from './page.service';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';

type Query = { sql: string; parameters: readonly unknown[] };

const USER = { id: 'user-1', workspaceId: 'ws-1' } as any;
const SOURCE = 'space-source';
const TARGET = 'space-target';
const ROOT_ID = '01a14cce-0000-7000-8000-0000000000d1';
const CHILD_ID = '01a14cce-0000-7000-8000-0000000000d2';

const ROOT = {
  id: ROOT_ID,
  slugId: 'root1',
  spaceId: SOURCE,
  workspaceId: 'ws-1',
  parentPageId: null,
  isBase: false,
  deletedAt: null,
  title: 'Root',
} as any;
const CHILD = { ...ROOT, id: CHILD_ID, slugId: 'child1', parentPageId: ROOT_ID };

const APPROVAL_ON = { approval: { enabled: true, approverIds: [] } };

// Kysely over a fake driver, so the SQL compiles for real and the rows are canned.
function makeDb(respond: (query: Query) => Record<string, unknown>[] = () => []) {
  const queries: Query[] = [];
  const connection = {
    executeQuery: async (compiled: CompiledQuery) => {
      const query = { sql: compiled.sql, parameters: compiled.parameters };
      queries.push(query);
      return { rows: respond(query) as any[] };
    },
    streamQuery: async function* () {},
  };
  const db = new Kysely<any>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => ({
        init: async () => {},
        acquireConnection: async () => connection,
        beginTransaction: async () => {},
        commitTransaction: async () => {},
        rollbackTransaction: async () => {},
        releaseConnection: async () => {},
        destroy: async () => {},
      }),
      createIntrospector: (kysely) => new PostgresIntrospector(kysely),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [new CamelCasePlugin()],
  });
  return { db, queries };
}

function makeService(
  opts: {
    spaceSettings?: Record<string, unknown>;
    canManageSource?: boolean;
    publishedSubtree?: { id: string; spaceId: string; isBase: boolean }[];
    workflowManagerOf?: string[];
    spaceControlledIds?: string[];
  } = {},
) {
  const { db, queries } = makeDb((query) => {
    if (query.sql.includes('from "spaces"')) {
      return [SOURCE, TARGET].map((id) => ({
        id,
        settings: opts.spaceSettings?.[id] ?? null,
      }));
    }
    return [];
  });

  const pageRepo = {
    findById: jest.fn(async (id: string) =>
      id === CHILD_ID ? { ...CHILD } : { ...ROOT },
    ),
    insertPage: jest.fn(async (page: any, _trx?: unknown) => ({
      ...page,
      id: 'new-page',
    })),
    lockPageHierarchySpaces: jest.fn(async () => undefined),
    getPageAndDescendants: jest.fn(async () => [{ ...ROOT }, { ...CHILD }]),
    updatePage: jest.fn(async () => undefined),
    updatePages: jest.fn(async () => undefined),
    removePage: jest.fn(async () => undefined),
    findPublishedControlledInSubtree: jest.fn(
      async () => opts.publishedSubtree ?? [],
    ),
  };
  const pagePermissionRepo = {
    filterAccessiblePageIds: jest.fn(async ({ pageIds }) => pageIds),
    hasRestrictedPagesInSpace: jest.fn(async () => false),
    hasControlledPagesInSpace: jest.fn(async () => false),
  };
  const attachmentRepo = {
    updateAttachmentsByPageId: jest.fn(async () => undefined),
  };
  const aiQueue = { add: jest.fn(async () => undefined) };
  const generalQueue = { add: jest.fn(async () => undefined) };
  const watcherService = {
    addPageWatchers: jest.fn(async () => undefined),
    movePageWatchersToSpace: jest.fn(async () => undefined),
  };
  const wsService = {
    invalidateSpaceRestrictionCache: jest.fn(async () => undefined),
    removeBaseSubscribersWithoutAccess: jest.fn(async () => undefined),
  };
  const collabAccessService = { recheckAccess: jest.fn(async () => undefined) };
  const pageApprovalService = {
    divertNewPages: jest.fn(async (ids: string[], _trx?: unknown) => ids),
    convertExpiringToSpaceControl: jest.fn(
      async (_ids: string[], _trx?: unknown) => [],
    ),
    findSpaceControlledPageIds: jest.fn(
      async (_ids: string[], _trx?: unknown) => opts.spaceControlledIds ?? [],
    ),
    isWorkflowManager: jest.fn(async (_user: unknown, page: { id: string }) =>
      (opts.workflowManagerOf ?? []).includes(page.id),
    ),
  };
  const spaceAbility = {
    createForUser: jest.fn(async () => ({
      can: (action: string, subject: string) =>
        action === SpaceCaslAction.Manage && subject === SpaceCaslSubject.Settings
          ? opts.canManageSource === true
          : true,
      cannot: (action: string, subject: string) =>
        action === SpaceCaslAction.Manage && subject === SpaceCaslSubject.Settings
          ? opts.canManageSource !== true
          : false,
    })),
  };
  const pageApprovalPublishService = {
    publishDraftToPage: jest.fn(async (pageId: string, _trx?: unknown) => ({
      content: { type: 'doc', content: [], pageId },
    })),
    runPostPublish: jest.fn(async () => undefined),
  };

  const service = new PageService(
    pageRepo as any,
    pagePermissionRepo as any,
    attachmentRepo as any,
    db as any,
    {} as any,
    {} as any,
    aiQueue as any,
    generalQueue as any,
    { emit: jest.fn() } as any,
    {} as any,
    watcherService as any,
    {} as any,
    {} as any,
    wsService as any,
    collabAccessService as any,
    pageApprovalService as any,
    {} as any,
    spaceAbility as any,
    pageApprovalPublishService as any,
  );

  return {
    service,
    queries,
    pageRepo,
    pagePermissionRepo,
    generalQueue,
    watcherService,
    collabAccessService,
    pageApprovalService,
    spaceAbility,
    pageApprovalPublishService,
  };
}

describe('PageService.create', () => {
  it('inserts and diverts the new page in one transaction, then queues the watcher', async () => {
    const { service, pageRepo, pageApprovalService, generalQueue } =
      makeService();

    const page = await service.create('user-1', 'ws-1', {
      spaceId: TARGET,
      title: 'New',
    } as any);

    expect(page.id).toBe('new-page');
    const trx = pageRepo.insertPage.mock.calls[0][1];
    expect(trx).toBeDefined();
    expect(pageApprovalService.divertNewPages).toHaveBeenCalledWith(
      ['new-page'],
      trx,
    );
    expect(generalQueue.add).toHaveBeenCalledTimes(1);
    expect(generalQueue.add.mock.invocationCallOrder[0]).toBeGreaterThan(
      pageApprovalService.divertNewPages.mock.invocationCallOrder[0],
    );
  });

  it('diverts inside the caller transaction', async () => {
    const { service, pageRepo, pageApprovalService, watcherService } =
      makeService();
    const callerTrx = { caller: true } as any;

    await service.create(
      'user-1',
      'ws-1',
      { spaceId: TARGET, title: 'New' } as any,
      callerTrx,
    );

    expect(pageRepo.insertPage.mock.calls[0][1]).toBe(callerTrx);
    expect(pageApprovalService.divertNewPages).toHaveBeenCalledWith(
      ['new-page'],
      callerTrx,
    );
    expect(watcherService.addPageWatchers).toHaveBeenCalledWith(
      ['user-1'],
      'new-page',
      TARGET,
      'ws-1',
      callerTrx,
    );
  });
});

describe('PageService.removePage', () => {
  it('lets an editor trash a page without published controlled pages in its subtree', async () => {
    const { service, pageRepo, pageApprovalService } = makeService();

    await service.removePage(ROOT, USER, 'ws-1');

    expect(pageRepo.findPublishedControlledInSubtree).toHaveBeenCalledWith(
      ROOT_ID,
    );
    expect(pageApprovalService.isWorkflowManager).not.toHaveBeenCalled();
    expect(pageRepo.removePage).toHaveBeenCalledWith(ROOT_ID, 'user-1', 'ws-1');
  });

  it('refuses to trash a published controlled page for a user who is not a workflow manager', async () => {
    const published = { id: ROOT_ID, spaceId: SOURCE, isBase: false };
    const { service, pageRepo, pageApprovalService } = makeService({
      publishedSubtree: [published],
    });

    await expect(service.removePage(ROOT, USER, 'ws-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(pageApprovalService.isWorkflowManager).toHaveBeenCalledWith(
      USER,
      published,
    );
    expect(pageRepo.removePage).not.toHaveBeenCalled();
  });

  it('refuses when a published controlled descendant would be trashed with the page', async () => {
    const { service, pageRepo } = makeService({
      publishedSubtree: [{ id: CHILD_ID, spaceId: SOURCE, isBase: false }],
      workflowManagerOf: [ROOT_ID],
    });

    await expect(service.removePage(ROOT, USER, 'ws-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(pageRepo.removePage).not.toHaveBeenCalled();
  });

  it('lets a workflow manager trash published controlled pages', async () => {
    const { service, pageRepo } = makeService({
      publishedSubtree: [
        { id: ROOT_ID, spaceId: SOURCE, isBase: false },
        { id: CHILD_ID, spaceId: SOURCE, isBase: false },
      ],
      workflowManagerOf: [ROOT_ID, CHILD_ID],
    });

    await service.removePage(ROOT, USER, 'ws-1');

    expect(pageRepo.removePage).toHaveBeenCalledWith(ROOT_ID, 'user-1', 'ws-1');
  });
});

describe('PageService.movePageToSpace approval transitions', () => {
  const writesMovedRows = (queries: Query[]) =>
    queries.some((q) => q.sql.startsWith('update "page_access"'));

  it('refuses a move out of an approval space without Manage Settings in the source space', async () => {
    const deps = makeService({
      spaceSettings: { [SOURCE]: APPROVAL_ON },
      canManageSource: false,
    });

    await expect(
      deps.service.movePageToSpace(ROOT, TARGET, 'user-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(deps.spaceAbility.createForUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      SOURCE,
    );
    expect(deps.pageRepo.updatePage).not.toHaveBeenCalled();
    expect(writesMovedRows(deps.queries)).toBe(false);
    expect(
      deps.pageApprovalPublishService.publishDraftToPage,
    ).not.toHaveBeenCalled();
    expect(deps.collabAccessService.recheckAccess).not.toHaveBeenCalled();
  });

  it('publishes space-controlled drafts and drops their space rows when a source admin moves pages out', async () => {
    const deps = makeService({
      spaceSettings: { [SOURCE]: APPROVAL_ON },
      canManageSource: true,
      spaceControlledIds: [ROOT_ID, CHILD_ID],
    });

    await deps.service.movePageToSpace(ROOT, TARGET, 'user-1');

    const trx = deps.pageApprovalService.findSpaceControlledPageIds.mock.calls[0][1];
    expect(trx).toBeDefined();
    expect(
      deps.pageApprovalService.findSpaceControlledPageIds,
    ).toHaveBeenCalledWith([ROOT_ID, CHILD_ID], trx);
    expect(
      deps.pageApprovalPublishService.publishDraftToPage.mock.calls,
    ).toEqual([
      [ROOT_ID, trx],
      [CHILD_ID, trx],
    ]);
    const lastMove = Math.max(...deps.pageRepo.updatePages.mock.invocationCallOrder);
    expect(
      deps.pageApprovalPublishService.publishDraftToPage.mock
        .invocationCallOrder[0],
    ).toBeGreaterThan(lastMove);

    const removal = deps.queries.find((q) =>
      q.sql.startsWith('delete from "page_verifications"'),
    );
    expect(removal?.sql).toContain('"source" =');
    expect(removal?.parameters).toEqual(
      expect.arrayContaining([ROOT_ID, CHILD_ID, 'space']),
    );

    expect(deps.pageApprovalPublishService.runPostPublish).toHaveBeenCalledTimes(2);
    expect(deps.pageApprovalPublishService.runPostPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        page: expect.objectContaining({ id: ROOT_ID, spaceId: TARGET }),
        content: expect.objectContaining({ pageId: ROOT_ID }),
        actorId: 'user-1',
        notifyWatchers: false,
      }),
    );
    expect(deps.pageApprovalService.divertNewPages).not.toHaveBeenCalled();
  });

  it('diverts moved pages and converts expiring rows after the move into an approval space', async () => {
    const deps = makeService({ spaceSettings: { [TARGET]: APPROVAL_ON } });

    await deps.service.movePageToSpace(ROOT, TARGET, 'user-1');

    const trx = deps.pageApprovalService.divertNewPages.mock.calls[0][1];
    expect(trx).toBeDefined();
    expect(deps.pageApprovalService.divertNewPages).toHaveBeenCalledWith(
      [ROOT_ID, CHILD_ID],
      trx,
    );
    expect(
      deps.pageApprovalService.convertExpiringToSpaceControl,
    ).toHaveBeenCalledWith([ROOT_ID, CHILD_ID], trx);
    const lastMove = Math.max(...deps.pageRepo.updatePages.mock.invocationCallOrder);
    expect(
      deps.pageApprovalService.divertNewPages.mock.invocationCallOrder[0],
    ).toBeGreaterThan(lastMove);
    expect(
      deps.pageApprovalService.convertExpiringToSpaceControl.mock
        .invocationCallOrder[0],
    ).toBeGreaterThan(
      deps.pageApprovalService.divertNewPages.mock.invocationCallOrder[0],
    );
    expect(deps.spaceAbility.createForUser).not.toHaveBeenCalled();
    expect(
      deps.pageApprovalPublishService.publishDraftToPage,
    ).not.toHaveBeenCalled();
    expect(deps.pageApprovalPublishService.runPostPublish).not.toHaveBeenCalled();
  });

  it('leaves approval state alone between spaces without approval', async () => {
    const deps = makeService();

    await deps.service.movePageToSpace(ROOT, TARGET, 'user-1');

    expect(writesMovedRows(deps.queries)).toBe(true);
    expect(deps.spaceAbility.createForUser).not.toHaveBeenCalled();
    expect(deps.pageApprovalService.divertNewPages).not.toHaveBeenCalled();
    expect(
      deps.pageApprovalService.findSpaceControlledPageIds,
    ).not.toHaveBeenCalled();
    expect(
      deps.queries.some((q) => q.sql.startsWith('delete from "page_verifications"')),
    ).toBe(false);
  });
});

describe('PageService.movePage collab recheck', () => {
  it('rechecks collab access after a reparent in a space with controlled pages', async () => {
    const deps = makeService();
    deps.pagePermissionRepo.hasControlledPagesInSpace.mockResolvedValue(true);
    deps.pageRepo.findById.mockImplementation(async (id: string) =>
      id === CHILD_ID ? { ...CHILD, parentPageId: null } : { ...ROOT },
    );
    (deps.pageRepo as any).isPageDescendant = jest.fn(async () => false);

    await deps.service.movePage(
      { pageId: CHILD_ID, parentPageId: ROOT_ID, position: 'a1' } as any,
      { ...CHILD, parentPageId: null },
    );

    expect(deps.collabAccessService.recheckAccess).toHaveBeenCalledWith({
      pageIds: [CHILD_ID],
    });
  });

  it('skips the recheck in a space without restrictions or controlled pages', async () => {
    const deps = makeService();
    deps.pageRepo.findById.mockImplementation(async (id: string) =>
      id === CHILD_ID ? { ...CHILD, parentPageId: null } : { ...ROOT },
    );
    (deps.pageRepo as any).isPageDescendant = jest.fn(async () => false);

    await deps.service.movePage(
      { pageId: CHILD_ID, parentPageId: ROOT_ID, position: 'a1' } as any,
      { ...CHILD, parentPageId: null },
    );

    expect(deps.collabAccessService.recheckAccess).not.toHaveBeenCalled();
  });
});
