import { NotFoundException } from '@nestjs/common';
import { PageController } from './page.controller';

const USER = { id: 'user-1', workspaceId: 'ws-1' } as any;
const PAGE_ID = '01a14cce-0000-7000-8000-0000000000b1';

const commented = (text: string) => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text,
          marks: [
            { type: 'comment', attrs: { commentId: 'comment-1', resolved: false } },
          ],
        },
      ],
    },
  ],
});

const PAGE = {
  id: PAGE_ID,
  slugId: 'slug1',
  spaceId: 'space-1',
  workspaceId: 'ws-1',
  isBase: false,
  title: 'Approved title',
  icon: 'A',
  content: commented('approved body'),
} as any;

type Approval = {
  controlled: boolean;
  canAccessDraft: boolean;
  locked: boolean;
  unpublished: boolean;
};

const READER: Approval = {
  controlled: true,
  canAccessDraft: false,
  locked: false,
  unpublished: false,
};
const DRAFT_USER: Approval = { ...READER, canAccessDraft: true };
const UNCONTROLLED_VIEWER: Approval = { ...READER, controlled: false };
const UNCONTROLLED_EDITOR: Approval = {
  ...UNCONTROLLED_VIEWER,
  canAccessDraft: true,
};

function makeController(
  approval: Approval,
  opts: { history?: Record<string, unknown> } = {},
) {
  const pageService = {
    getPageBreadCrumbs: jest.fn(async () => []),
  };
  const pageRepo = { findById: jest.fn(async () => ({ ...PAGE })) };
  const pageHistoryService = {
    findById: jest.fn(async () => opts.history),
    findHistoryByPageId: jest.fn(async () => ({ items: [], meta: {} })),
  };
  const pageAccessService = {
    validateCanView: jest.fn(async () => undefined),
    validateCanViewWithPermissions: jest.fn(async () => ({
      canEdit: approval.canAccessDraft,
      hasRestriction: false,
      approval,
    })),
  };
  const pageApprovalService = {
    readContentFor: jest.fn(async () => ({
      content: commented('draft body'),
      title: 'Draft title',
      icon: 'D',
      isDraft: true,
    })),
  };

  const controller = new PageController(
    pageService as any,
    pageRepo as any,
    pageHistoryService as any,
    {} as any,
    pageAccessService as any,
    {} as any,
    {} as any,
    {} as any,
    pageApprovalService as any,
  );

  return {
    controller,
    pageService,
    pageHistoryService,
    pageAccessService,
    pageApprovalService,
  };
}

const text = (value: unknown) => JSON.stringify(value);

describe('PageController /pages/info', () => {
  it('returns the approval state and untouched content for an uncontrolled page', async () => {
    const { controller, pageApprovalService } =
      makeController(UNCONTROLLED_VIEWER);

    const result: any = await controller.getPage(
      { pageId: PAGE_ID } as any,
      USER,
    );

    expect(result.approval).toEqual(UNCONTROLLED_VIEWER);
    expect(result.permissions).toEqual({ canEdit: false, hasRestriction: false });
    expect(result.content).toEqual(PAGE.content);
    expect(pageApprovalService.readContentFor).not.toHaveBeenCalled();
  });

  it('gives readers the reader version without comment marks', async () => {
    const { controller, pageApprovalService } = makeController(READER);

    const result: any = await controller.getPage(
      { pageId: PAGE_ID } as any,
      USER,
    );

    expect(text(result.content)).toContain('approved body');
    expect(text(result.content)).not.toContain('comment');
    expect(result.title).toBe('Approved title');
    expect(result.approval).toEqual(READER);
    expect(pageApprovalService.readContentFor).not.toHaveBeenCalled();
  });

  it('ignores draft: true from a reader', async () => {
    const { controller, pageApprovalService } = makeController(READER);

    const result: any = await controller.getPage(
      { pageId: PAGE_ID, draft: true } as any,
      USER,
    );

    expect(pageApprovalService.readContentFor).not.toHaveBeenCalled();
    expect(text(result.content)).not.toContain('draft body');
    expect(text(result.content)).not.toContain('comment');
    expect(result.title).toBe('Approved title');
    expect(result.icon).toBe('A');
  });

  it('gives a draft user the draft when asked with draft: true', async () => {
    const { controller, pageApprovalService } = makeController(DRAFT_USER);

    const result: any = await controller.getPage(
      { pageId: PAGE_ID, draft: true } as any,
      USER,
    );

    expect(pageApprovalService.readContentFor).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({ id: PAGE_ID }),
    );
    expect(result.content).toEqual(commented('draft body'));
    expect(result.title).toBe('Draft title');
    expect(result.icon).toBe('D');
  });

  it('gives a draft user the reader version without draft: true', async () => {
    const { controller, pageApprovalService } = makeController(DRAFT_USER);

    const result: any = await controller.getPage(
      { pageId: PAGE_ID } as any,
      USER,
    );

    expect(pageApprovalService.readContentFor).not.toHaveBeenCalled();
    expect(text(result.content)).toContain('approved body');
    expect(text(result.content)).not.toContain('comment');
    expect(result.title).toBe('Approved title');
  });

  it('falls back to the reader version when no draft exists', async () => {
    const { controller, pageApprovalService } = makeController(DRAFT_USER);
    pageApprovalService.readContentFor.mockResolvedValue({
      content: PAGE.content,
      title: PAGE.title,
      icon: PAGE.icon,
      isDraft: false,
    });

    const result: any = await controller.getPage(
      { pageId: PAGE_ID, draft: true } as any,
      USER,
    );

    expect(text(result.content)).toContain('approved body');
    expect(text(result.content)).not.toContain('comment');
  });

  it('converts the draft to the requested format', async () => {
    const { controller } = makeController(DRAFT_USER);

    const result: any = await controller.getPage(
      { pageId: PAGE_ID, draft: true, format: 'markdown' } as any,
      USER,
    );

    expect(typeof result.content).toBe('string');
    expect(result.content).toContain('draft body');
  });
});

describe('PageController /pages/history', () => {
  const pagination = { limit: 20 } as any;

  it('limits readers of a controlled page to reader versions', async () => {
    const { controller, pageHistoryService } = makeController(READER);

    await controller.getPageHistory({ pageId: PAGE_ID }, pagination, USER);

    expect(pageHistoryService.findHistoryByPageId).toHaveBeenCalledWith(
      PAGE_ID,
      pagination,
      { readerOnly: true, includeDraftKinds: false },
    );
  });

  it('hides draft rows from viewers of an uncontrolled page', async () => {
    const { controller, pageHistoryService } =
      makeController(UNCONTROLLED_VIEWER);

    await controller.getPageHistory({ pageId: PAGE_ID }, pagination, USER);

    expect(pageHistoryService.findHistoryByPageId).toHaveBeenCalledWith(
      PAGE_ID,
      pagination,
      { readerOnly: false, includeDraftKinds: false },
    );
  });

  it('lists every row for draft users', async () => {
    for (const approval of [DRAFT_USER, UNCONTROLLED_EDITOR]) {
      const { controller, pageHistoryService } = makeController(approval);

      await controller.getPageHistory({ pageId: PAGE_ID }, pagination, USER);

      expect(pageHistoryService.findHistoryByPageId).toHaveBeenCalledWith(
        PAGE_ID,
        pagination,
        { readerOnly: false, includeDraftKinds: true },
      );
    }
  });
});

describe('PageController /pages/history/info', () => {
  const row = (kind: string | null) => ({
    id: 'history-1',
    pageId: PAGE_ID,
    kind,
    title: 'Row title',
    content: commented('row body'),
  });

  it('answers 404 to a reader for a draft row', async () => {
    const { controller } = makeController(READER, { history: row('draft') });

    await expect(
      controller.getPageHistoryInfo({ historyId: 'history-1' }, USER),
    ).rejects.toThrow(new NotFoundException('Page history not found'));
  });

  it('answers 404 to a reader of a controlled page for a regular row', async () => {
    const { controller } = makeController(READER, { history: row(null) });

    await expect(
      controller.getPageHistoryInfo({ historyId: 'history-1' }, USER),
    ).rejects.toThrow(new NotFoundException('Page history not found'));
  });

  it('answers 404 to a viewer of an uncontrolled page for a draft row', async () => {
    const { controller } = makeController(UNCONTROLLED_VIEWER, {
      history: row('draft'),
    });

    await expect(
      controller.getPageHistoryInfo({ historyId: 'history-1' }, USER),
    ).rejects.toThrow(new NotFoundException('Page history not found'));
  });

  it('strips comment marks from a reader version for readers', async () => {
    const { controller } = makeController(READER, { history: row('approved') });

    const result: any = await controller.getPageHistoryInfo(
      { historyId: 'history-1' },
      USER,
    );

    expect(text(result.content)).toContain('row body');
    expect(text(result.content)).not.toContain('comment');
    expect(result.kind).toBe('approved');
  });

  it('returns draft rows to draft users unchanged', async () => {
    const history = row('draft');
    const { controller } = makeController(DRAFT_USER, { history });

    const result = await controller.getPageHistoryInfo(
      { historyId: 'history-1' },
      USER,
    );

    expect(result).toBe(history);
  });
});

describe('PageController /pages/breadcrumbs', () => {
  it('filters breadcrumbs for the requesting user', async () => {
    const { controller, pageService } = makeController(READER);

    await controller.getPageBreadcrumbs({ pageId: PAGE_ID }, USER);

    expect(pageService.getPageBreadCrumbs).toHaveBeenCalledWith(
      PAGE_ID,
      USER.id,
    );
  });
});
