import { BadRequestException } from '@nestjs/common';
import {
  CamelCasePlugin,
  CompiledQuery,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { PageService } from './page.service';
import { buildApprovalState } from '../approval/page-approval.utils';
import { ApprovalState } from '../approval/page-approval.types';

const PAGE_ID = '01a14cce-0000-7000-8000-0000000000a1';
const USER = { id: 'user-1', workspaceId: 'ws-1' } as any;
const PAGE = {
  id: PAGE_ID,
  slugId: 'slug1',
  spaceId: 'space-1',
  workspaceId: 'ws-1',
  isBase: false,
  title: 'Approved title',
  icon: 'A',
  contributorIds: ['user-0'],
  content: null,
} as any;

const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

const SPACE_ON = { approval: { enabled: true, approverIds: [] } };
const UNCONTROLLED = buildApprovalState({ isBase: false });
const PUBLISHED = buildApprovalState({
  isBase: false,
  spaceSettings: SPACE_ON,
  readerVersionId: 'history-1',
});
const UNPUBLISHED = buildApprovalState({
  isBase: false,
  spaceSettings: SPACE_ON,
});
const IN_REVIEW = buildApprovalState({
  isBase: false,
  verificationId: 'verification-1',
  verificationType: 'qms',
  verificationStatus: 'in_approval',
  readerVersionId: 'history-1',
});

const NEEDS_DRAFT =
  'This page requires approval. Send draft: true to edit its draft.';
const LOCKED = 'This page is in review and cannot be edited.';

// Kysely over a fake driver, so the SQL compiles for real and the rows are canned.
function makeDb(rows: Record<string, unknown>[] = []) {
  const connection = {
    executeQuery: async (_compiled: CompiledQuery) => ({ rows: rows as any[] }),
    streamQuery: async function* () {},
  };
  return new Kysely<any>({
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
}

function makeService(
  state: ApprovalState,
  opts: { draftRow?: object | null; dbRows?: Record<string, unknown>[] } = {},
) {
  const pageRepo = {
    updatePage: jest.fn(async () => undefined),
    findById: jest.fn(async () => ({ ...PAGE })),
  };
  const pagePermissionRepo = {
    filterAccessiblePageIds: jest.fn(async () => [] as string[]),
  };
  const generalQueue = { add: jest.fn(async () => undefined) };
  const collaborationGateway = {
    handleYjsEvent: jest.fn(async () => undefined),
  };
  const pageApprovalService = {
    getState: jest.fn(async () => state),
    readContentFor: jest.fn(async () => ({
      content: doc('draft body'),
      title: 'Draft title',
      icon: 'D',
      isDraft: true,
    })),
  };
  const pageDraftRepo = {
    findByPageId: jest.fn(async () =>
      'draftRow' in opts ? opts.draftRow : { id: 'draft-1', pageId: PAGE_ID },
    ),
    createFromPage: jest.fn(async () => ({ id: 'draft-1', pageId: PAGE_ID })),
    updateTitleIcon: jest.fn(async () => undefined),
  };

  const service = new PageService(
    pageRepo as any,
    pagePermissionRepo as any,
    {} as any,
    makeDb(opts.dbRows) as any,
    {} as any,
    {} as any,
    {} as any,
    generalQueue as any,
    { emit: jest.fn() } as any,
    collaborationGateway as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    pageApprovalService as any,
    pageDraftRepo as any,
  );

  return {
    service,
    pageRepo,
    pagePermissionRepo,
    generalQueue,
    collaborationGateway,
    pageApprovalService,
    pageDraftRepo,
  };
}

function expectNoWrites(deps: ReturnType<typeof makeService>) {
  expect(deps.pageRepo.updatePage).not.toHaveBeenCalled();
  expect(deps.pageDraftRepo.updateTitleIcon).not.toHaveBeenCalled();
  expect(deps.pageDraftRepo.createFromPage).not.toHaveBeenCalled();
  expect(deps.collaborationGateway.handleYjsEvent).not.toHaveBeenCalled();
  expect(deps.generalQueue.add).not.toHaveBeenCalled();
}

describe('PageService.update', () => {
  it('throws without draft: true on a controlled page', async () => {
    const deps = makeService(PUBLISHED);

    const result = deps.service.update(
      PAGE,
      { pageId: PAGE_ID, title: 'New title' },
      USER,
    );

    await expect(result).rejects.toThrow(BadRequestException);
    await expect(result).rejects.toThrow(NEEDS_DRAFT);
    expectNoWrites(deps);
  });

  it('throws when locked', async () => {
    const deps = makeService(IN_REVIEW);

    const result = deps.service.update(
      PAGE,
      {
        pageId: PAGE_ID,
        title: 'New title',
        content: doc('more'),
        operation: 'append',
        format: 'json',
        draft: true,
      },
      USER,
    );

    await expect(result).rejects.toThrow(BadRequestException);
    await expect(result).rejects.toThrow(LOCKED);
    expectNoWrites(deps);
  });

  it('writes title to the draft repo when published', async () => {
    const deps = makeService(PUBLISHED);

    await deps.service.update(
      PAGE,
      { pageId: PAGE_ID, title: 'New title', draft: true },
      USER,
    );

    expect(deps.pageDraftRepo.updateTitleIcon).toHaveBeenCalledWith(PAGE_ID, {
      title: 'New title',
      icon: undefined,
    });
    expect(deps.pageDraftRepo.createFromPage).not.toHaveBeenCalled();
    expect(deps.pageRepo.updatePage).not.toHaveBeenCalled();
  });

  it('update on a published controlled page does not call pageRepo.updatePage', async () => {
    const deps = makeService(PUBLISHED);

    await deps.service.update(
      PAGE,
      {
        pageId: PAGE_ID,
        title: 'New title',
        icon: 'N',
        content: doc('more'),
        operation: 'append',
        format: 'json',
        draft: true,
      },
      USER,
    );

    expect(deps.pageRepo.updatePage).not.toHaveBeenCalled();
    expect(deps.pageDraftRepo.updateTitleIcon).toHaveBeenCalledWith(PAGE_ID, {
      title: 'New title',
      icon: 'N',
    });
    expect(deps.collaborationGateway.handleYjsEvent).toHaveBeenCalledWith(
      'updatePageContent',
      `page.${PAGE_ID}`,
      { operation: 'append', prosemirrorJson: doc('more'), user: USER },
    );
  });

  it('stores a removed icon on the draft as an empty string', async () => {
    const deps = makeService(PUBLISHED);

    await deps.service.update(
      PAGE,
      { pageId: PAGE_ID, icon: null, draft: true },
      USER,
    );

    expect(deps.pageDraftRepo.updateTitleIcon).toHaveBeenCalledWith(PAGE_ID, {
      title: undefined,
      icon: '',
    });
  });

  it('creates the draft row before writing a title when a published page has none', async () => {
    const deps = makeService(PUBLISHED, { draftRow: undefined });

    await deps.service.update(
      PAGE,
      { pageId: PAGE_ID, title: 'New title', draft: true },
      USER,
    );

    expect(deps.pageDraftRepo.createFromPage).toHaveBeenCalledWith(PAGE_ID);
    expect(
      deps.pageDraftRepo.createFromPage.mock.invocationCallOrder[0],
    ).toBeLessThan(
      deps.pageDraftRepo.updateTitleIcon.mock.invocationCallOrder[0],
    );
  });

  it('leaves the draft row alone for a content-only update', async () => {
    const deps = makeService(PUBLISHED);

    await deps.service.update(
      PAGE,
      {
        pageId: PAGE_ID,
        content: doc('more'),
        operation: 'append',
        format: 'json',
        draft: true,
      },
      USER,
    );

    expect(deps.pageDraftRepo.findByPageId).not.toHaveBeenCalled();
    expect(deps.pageDraftRepo.updateTitleIcon).not.toHaveBeenCalled();
    expect(deps.pageRepo.updatePage).not.toHaveBeenCalled();
    expect(deps.collaborationGateway.handleYjsEvent).toHaveBeenCalledTimes(1);
  });

  it('writes title to pageRepo.updatePage when unpublished', async () => {
    const deps = makeService(UNPUBLISHED);

    await deps.service.update(
      PAGE,
      { pageId: PAGE_ID, title: 'New title', draft: true },
      USER,
    );

    expect(deps.pageRepo.updatePage).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New title',
        lastUpdatedById: USER.id,
        contributorIds: ['user-0', USER.id],
      }),
      PAGE_ID,
    );
    expect(deps.pageDraftRepo.updateTitleIcon).not.toHaveBeenCalled();
  });

  it('returns the draft content, title and icon for a controlled page', async () => {
    const deps = makeService(PUBLISHED);

    const result = await deps.service.update(
      PAGE,
      { pageId: PAGE_ID, title: 'Draft title', draft: true },
      USER,
    );

    expect(deps.pageApprovalService.readContentFor).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({ id: PAGE_ID }),
    );
    expect(result).toMatchObject({
      id: PAGE_ID,
      title: 'Draft title',
      icon: 'D',
      content: doc('draft body'),
    });
  });

  it('uncontrolled page behaves as before', async () => {
    const deps = makeService(UNCONTROLLED);

    const result = await deps.service.update(
      PAGE,
      {
        pageId: PAGE_ID,
        title: 'New title',
        icon: 'N',
        content: doc('more'),
        operation: 'replace',
        format: 'json',
      },
      USER,
    );

    expect(deps.pageRepo.updatePage).toHaveBeenCalledWith(
      {
        title: 'New title',
        icon: 'N',
        lastUpdatedById: USER.id,
        updatedAt: expect.any(Date),
        contributorIds: ['user-0', USER.id],
      },
      PAGE_ID,
    );
    expect(deps.generalQueue.add).toHaveBeenCalled();
    expect(deps.collaborationGateway.handleYjsEvent).toHaveBeenCalledWith(
      'updatePageContent',
      `page.${PAGE_ID}`,
      { operation: 'replace', prosemirrorJson: doc('more'), user: USER },
    );
    expect(deps.pageDraftRepo.updateTitleIcon).not.toHaveBeenCalled();
    expect(deps.pageApprovalService.readContentFor).not.toHaveBeenCalled();
    expect(result).toEqual(PAGE);
  });
});

describe('PageService.updatePageContent', () => {
  it('updatePageContent throws for a locked page without calling the collab event', async () => {
    const deps = makeService(IN_REVIEW);

    const result = deps.service.updatePageContent(
      PAGE_ID,
      doc('appended'),
      'append',
      'json',
      USER,
    );

    await expect(result).rejects.toThrow(BadRequestException);
    await expect(result).rejects.toThrow(LOCKED);
    expect(deps.collaborationGateway.handleYjsEvent).not.toHaveBeenCalled();
  });

  it('sends content for an unlocked page to the collab event', async () => {
    const deps = makeService(PUBLISHED);

    await deps.service.updatePageContent(
      PAGE_ID,
      doc('appended'),
      'append',
      'json',
      USER,
    );

    expect(deps.pageApprovalService.getState).toHaveBeenCalledWith(
      expect.objectContaining({ id: PAGE_ID }),
    );
    expect(deps.collaborationGateway.handleYjsEvent).toHaveBeenCalledWith(
      'updatePageContent',
      `page.${PAGE_ID}`,
      { operation: 'append', prosemirrorJson: doc('appended'), user: USER },
    );
  });
});

describe('PageService.getPageBreadCrumbs', () => {
  const crumb = (id: string, parentPageId: string | null) => ({
    id,
    slug_id: `slug-${id}`,
    title: id,
    icon: null,
    is_base: false,
    position: 'a0',
    parent_page_id: parentPageId,
    space_id: 'space-1',
    deleted_at: null,
    has_children: true,
  });

  it('drops ancestors the user cannot see and keeps the order', async () => {
    // The ancestor query returns the page first and the root last.
    const deps = makeService(UNCONTROLLED, {
      dbRows: [
        crumb(PAGE_ID, 'parent'),
        crumb('parent', 'root'),
        crumb('root', null),
      ],
    });
    deps.pagePermissionRepo.filterAccessiblePageIds.mockResolvedValue(['root']);

    const result = await deps.service.getPageBreadCrumbs(PAGE_ID, USER.id);

    expect(deps.pagePermissionRepo.filterAccessiblePageIds).toHaveBeenCalledWith(
      { pageIds: ['root', 'parent'], userId: USER.id },
    );
    expect(result.map((p) => p.id)).toEqual(['root', PAGE_ID]);
  });

  it('skips the access filter for a root page', async () => {
    const deps = makeService(UNCONTROLLED, { dbRows: [crumb(PAGE_ID, null)] });

    const result = await deps.service.getPageBreadCrumbs(PAGE_ID, USER.id);

    expect(deps.pagePermissionRepo.filterAccessiblePageIds).not.toHaveBeenCalled();
    expect(result.map((p) => p.id)).toEqual([PAGE_ID]);
  });
});
