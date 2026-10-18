import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommentService } from './comment.service';

const USER = { id: 'user-1' } as any;
const PAGE = {
  id: 'page-1',
  spaceId: 'space-1',
  workspaceId: 'ws-1',
  isBase: false,
} as any;
const CONTENT = JSON.stringify({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }],
});
const YJS_SELECTION = {
  anchor: { type: { client: 1, clock: 1 }, tname: null, item: null, assoc: 0 },
  head: { type: { client: 1, clock: 2 }, tname: null, item: null, assoc: 0 },
};

const row = (overrides: Record<string, unknown>): any => ({
  pageId: PAGE.id,
  spaceId: PAGE.spaceId,
  workspaceId: PAGE.workspaceId,
  creatorId: USER.id,
  content: { type: 'doc', content: [] },
  type: 'page',
  isInternal: false,
  selection: null,
  parentCommentId: null,
  resolvedAt: null,
  ...overrides,
});

const PAGE_ROOT = row({ id: 'page-root' });
const INLINE_ROOT = row({
  id: 'inline-root',
  type: 'inline',
  selection: 'draft words',
});
const INLINE_REPLY = row({ id: 'inline-reply', parentCommentId: 'inline-root' });
const PAGE_REPLY = row({
  id: 'page-reply',
  parentCommentId: 'page-root',
  selection: 'reply quote',
});

function setup(opts: { controlled: boolean; canAccessDraft: boolean }) {
  const stored = new Map<string, any>(
    [PAGE_ROOT, INLINE_ROOT, INLINE_REPLY, PAGE_REPLY].map((c) => [c.id, c]),
  );
  const commentRepo = {
    findById: jest.fn(async (id: string) => stored.get(id)),
    insertComment: jest.fn(async (values: any) => {
      const inserted = { ...row({}), ...values, id: 'new-comment' };
      stored.set(inserted.id, inserted);
      return inserted;
    }),
    findPageComments: jest.fn(async () => ({
      items: [PAGE_ROOT, PAGE_REPLY],
      meta: { hasNextPage: false },
    })),
    updateComment: jest.fn(async () => undefined),
  };
  const wsService = { emitCommentEvent: jest.fn(async () => undefined) };
  const collaborationGateway = { handleYjsEvent: jest.fn(async () => undefined) };
  const pageApprovalService = {
    getState: jest.fn(async () => ({ controlled: opts.controlled })),
    canAccessDraft: jest.fn(async () => opts.canAccessDraft),
  };
  const generalQueue = { add: jest.fn(async () => undefined) };
  const notificationQueue = { add: jest.fn(async () => undefined) };

  const service = new CommentService(
    commentRepo as any,
    wsService as any,
    collaborationGateway as any,
    pageApprovalService as any,
    generalQueue as any,
    notificationQueue as any,
  );

  const last = (calls: any[][]) => calls[calls.length - 1];
  const lastEvent = () => last(wsService.emitCommentEvent.mock.calls) as any[];
  const lastJob = () => last(notificationQueue.add.mock.calls)?.[1] as any;

  return {
    service,
    commentRepo,
    wsService,
    collaborationGateway,
    pageApprovalService,
    notificationQueue,
    lastEvent,
    lastJob,
  };
}

const READER = { controlled: true, canAccessDraft: false };
const DRAFT_USER = { controlled: true, canAccessDraft: true };
const UNCONTROLLED = { controlled: false, canAccessDraft: false };

describe('CommentService.create', () => {
  const create = (
    service: CommentService,
    dto: Record<string, unknown>,
    source?: 'mcp' | 'ai-chat',
  ) =>
    service.create(
      { page: PAGE, workspaceId: PAGE.workspaceId, user: USER, source },
      { pageId: PAGE.id, content: CONTENT, ...dto } as any,
    );

  it('rejects an inline comment from a reader without writing anything', async () => {
    const { service, commentRepo, collaborationGateway } = setup(READER);

    await expect(
      create(service, {
        type: 'inline',
        selection: 'approved words',
        yjsSelection: YJS_SELECTION,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(commentRepo.insertComment).not.toHaveBeenCalled();
    expect(collaborationGateway.handleYjsEvent).not.toHaveBeenCalled();
  });

  it('rejects a reader reply to an inline thread as a missing parent', async () => {
    const { service, commentRepo } = setup(READER);

    await expect(
      create(service, { parentCommentId: INLINE_ROOT.id }),
    ).rejects.toThrow('Parent comment not found');
    await expect(
      create(service, { parentCommentId: INLINE_REPLY.id }),
    ).rejects.toThrow('Parent comment not found');
    expect(commentRepo.insertComment).not.toHaveBeenCalled();
  });

  it('keeps the reply depth error for draft users', async () => {
    const { service } = setup(DRAFT_USER);

    await expect(
      create(service, { parentCommentId: INLINE_REPLY.id }),
    ).rejects.toThrow('You cannot reply to a reply');
  });

  it('lets a reader add a public page-level comment', async () => {
    const { service, commentRepo, lastEvent, lastJob } = setup(READER);

    const comment = await create(service, {});

    expect(commentRepo.insertComment).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'page', isInternal: false, selection: null }),
    );
    expect(lastJob().draftOnly).toBeUndefined();
    expect(lastEvent()[3]).toEqual({ draftOnly: false });
    expect(comment.selection).toBeNull();
  });

  it('lets a reader reply to a page-level thread', async () => {
    const { service, commentRepo, lastEvent } = setup(READER);

    await create(service, { parentCommentId: PAGE_ROOT.id });

    expect(commentRepo.insertComment).toHaveBeenCalledWith(
      expect.objectContaining({ parentCommentId: PAGE_ROOT.id, isInternal: false }),
    );
    expect(lastEvent()[3]).toEqual({ draftOnly: false });
  });

  it('marks agent comments of draft users internal and keeps them among draft users', async () => {
    const { service, commentRepo, lastEvent, lastJob } = setup(DRAFT_USER);

    const comment = await create(service, { type: 'page', selection: 'draft words' }, 'mcp');

    expect(commentRepo.insertComment).toHaveBeenCalledWith(
      expect.objectContaining({ isInternal: true, selection: 'draft words' }),
    );
    expect(lastJob().draftOnly).toBe(true);
    expect(lastEvent()[3]).toEqual({ draftOnly: true });
    expect(lastEvent()[2].comment.selection).toBe('draft words');
    expect(comment.selection).toBe('draft words');
  });

  it('marks an agent reply in a public thread internal', async () => {
    const { service, commentRepo, lastEvent } = setup(DRAFT_USER);

    await create(service, { parentCommentId: PAGE_ROOT.id }, 'ai-chat');

    expect(commentRepo.insertComment).toHaveBeenCalledWith(
      expect.objectContaining({ isInternal: true }),
    );
    expect(lastEvent()[3]).toEqual({ draftOnly: true });
  });

  it('keeps a draft user inline comment and its mark among draft users', async () => {
    const { service, commentRepo, collaborationGateway, lastEvent, lastJob } =
      setup(DRAFT_USER);

    await create(service, {
      type: 'inline',
      selection: 'draft words',
      yjsSelection: YJS_SELECTION,
    });

    expect(commentRepo.insertComment).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'inline', isInternal: false }),
    );
    expect(collaborationGateway.handleYjsEvent).toHaveBeenCalledWith(
      'setCommentMark',
      `page.${PAGE.id}`,
      expect.objectContaining({ commentId: 'new-comment' }),
    );
    expect(lastJob().draftOnly).toBe(true);
    expect(lastEvent()[3]).toEqual({ draftOnly: true });
  });

  it('strips the excerpt from public comment events on controlled pages', async () => {
    const { service, lastEvent } = setup(DRAFT_USER);

    await create(service, { parentCommentId: PAGE_ROOT.id, selection: 'quote' });

    expect(lastEvent()[3]).toEqual({ draftOnly: false });
    expect(lastEvent()[2].comment.selection).toBeNull();
  });

  it('leaves uncontrolled pages as before, even for agent comments', async () => {
    const { service, commentRepo, pageApprovalService, lastEvent, lastJob } =
      setup(UNCONTROLLED);

    const comment = await create(service, { selection: 'quote' }, 'mcp');

    expect(pageApprovalService.canAccessDraft).not.toHaveBeenCalled();
    expect(commentRepo.insertComment).toHaveBeenCalledWith(
      expect.objectContaining({ isInternal: false, selection: 'quote' }),
    );
    expect(lastJob().draftOnly).toBeUndefined();
    expect(lastEvent()[3]).toEqual({ draftOnly: false });
    expect(lastEvent()[2].comment.selection).toBe('quote');
    expect(comment.selection).toBe('quote');
  });
});

describe('CommentService.findByPageId', () => {
  const pagination = { limit: 20 } as any;

  it('lists only public threads for readers and removes excerpts', async () => {
    const { service, commentRepo } = setup(READER);

    const result = await service.findByPageId(PAGE, pagination, USER);

    expect(commentRepo.findPageComments).toHaveBeenCalledWith(PAGE.id, pagination, {
      publicThreadsOnly: true,
    });
    expect(result.items.map((c) => c.selection)).toEqual([null, null]);
  });

  it('lists every thread with excerpts for draft users', async () => {
    const { service, commentRepo } = setup(DRAFT_USER);

    const result = await service.findByPageId(PAGE, pagination, USER);

    expect(commentRepo.findPageComments).toHaveBeenCalledWith(PAGE.id, pagination, {
      publicThreadsOnly: false,
    });
    expect(result.items[1].selection).toBe('reply quote');
  });

  it('lists every thread on uncontrolled pages without a draft check', async () => {
    const { service, commentRepo, pageApprovalService } = setup(UNCONTROLLED);

    await service.findByPageId(PAGE, pagination, USER);

    expect(pageApprovalService.canAccessDraft).not.toHaveBeenCalled();
    expect(commentRepo.findPageComments).toHaveBeenCalledWith(PAGE.id, pagination, {
      publicThreadsOnly: false,
    });
  });
});

describe('CommentService.findVisibleComment', () => {
  it('answers 404 to a reader for an internal thread and its replies', async () => {
    const { service } = setup(READER);

    await expect(
      service.findVisibleComment(INLINE_ROOT as any, PAGE, USER),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.findVisibleComment(INLINE_REPLY as any, PAGE, USER),
    ).rejects.toThrow(NotFoundException);
  });

  it('gives a reader a public comment without its excerpt', async () => {
    const { service } = setup(READER);

    const comment = await service.findVisibleComment(PAGE_REPLY as any, PAGE, USER);

    expect(comment.id).toBe(PAGE_REPLY.id);
    expect(comment.selection).toBeNull();
  });

  it('gives a draft user internal comments as stored', async () => {
    const { service } = setup(DRAFT_USER);

    expect(
      await service.findVisibleComment(INLINE_ROOT as any, PAGE, USER),
    ).toBe(INLINE_ROOT);
  });
});

describe('CommentService.update', () => {
  const dto = { commentId: 'x', content: CONTENT };

  it('answers 404 to a reader before checking ownership', async () => {
    const { service, commentRepo } = setup(READER);

    await expect(
      service.update(INLINE_ROOT as any, dto, USER, PAGE),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.update({ ...INLINE_REPLY, creatorId: 'someone' } as any, dto, USER, PAGE),
    ).rejects.toThrow(NotFoundException);
    expect(commentRepo.updateComment).not.toHaveBeenCalled();
  });

  it('keeps edits of internal comments among draft users', async () => {
    const { service, lastEvent } = setup(DRAFT_USER);

    await service.update({ ...INLINE_REPLY } as any, dto, USER, PAGE);

    expect(lastEvent()[2].operation).toBe('commentUpdated');
    expect(lastEvent()[3]).toEqual({ draftOnly: true });
  });

  it('sends a reader edit of a public comment to page viewers without excerpts', async () => {
    const { service, lastEvent } = setup(READER);

    const updated = await service.update({ ...PAGE_REPLY } as any, dto, USER, PAGE);

    expect(lastEvent()[3]).toEqual({ draftOnly: false });
    expect(lastEvent()[2].comment.selection).toBeNull();
    expect(updated.selection).toBeNull();
  });
});
