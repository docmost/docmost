import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
const STAMPED_ROOT = row({
  id: 'stamped-root',
  type: 'inline',
  selection: 'old draft words',
  isInternal: true,
});
const STAMPED_REPLY = row({
  id: 'stamped-reply',
  parentCommentId: 'stamped-root',
});

type Access = { controlled: boolean; canAccessDraft: boolean; canEdit: boolean };

const READER: Access = { controlled: true, canAccessDraft: false, canEdit: false };
const DRAFT_USER: Access = { controlled: true, canAccessDraft: true, canEdit: true };
const UNCONTROLLED_VIEWER: Access = {
  controlled: false,
  canAccessDraft: false,
  canEdit: false,
};
const UNCONTROLLED_EDITOR: Access = {
  controlled: false,
  canAccessDraft: true,
  canEdit: true,
};

function setup(access: Access, opts: { spaceAdmin?: boolean } = {}) {
  const stored = new Map<string, any>(
    [
      PAGE_ROOT,
      INLINE_ROOT,
      INLINE_REPLY,
      PAGE_REPLY,
      STAMPED_ROOT,
      STAMPED_REPLY,
    ].map((c) => [c.id, c]),
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
    deleteComment: jest.fn(async () => undefined),
  };
  const wsService = { emitCommentEvent: jest.fn(async () => undefined) };
  const collaborationGateway = { handleYjsEvent: jest.fn(async () => undefined) };
  const pageAccessService = {
    getDraftAccess: jest.fn(async () => ({
      canEdit: access.canEdit,
      hasRestriction: false,
      state: { controlled: access.controlled },
      canAccessDraft: access.canAccessDraft,
    })),
  };
  const spaceAbility = {
    createForUser: jest.fn(async () => ({ cannot: () => !opts.spaceAdmin })),
  };
  const generalQueue = { add: jest.fn(async () => undefined) };
  const notificationQueue = { add: jest.fn(async () => undefined) };

  const service = new CommentService(
    commentRepo as any,
    wsService as any,
    collaborationGateway as any,
    pageAccessService as any,
    spaceAbility as any,
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
    pageAccessService,
    notificationQueue,
    lastEvent,
    lastJob,
  };
}

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

  it('keeps the reply depth error for draft users and for visible replies', async () => {
    await expect(
      create(setup(DRAFT_USER).service, { parentCommentId: INLINE_REPLY.id }),
    ).rejects.toThrow('You cannot reply to a reply');
    await expect(
      create(setup(READER).service, { parentCommentId: PAGE_REPLY.id }),
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

  it('stamps inline and quoted thread roots of draft users internal', async () => {
    for (const dto of [
      { type: 'inline', selection: 'draft words', yjsSelection: YJS_SELECTION },
      { selection: 'draft words' },
    ]) {
      const { service, commentRepo, lastEvent, lastJob } = setup(DRAFT_USER);

      await create(service, dto);

      expect(commentRepo.insertComment).toHaveBeenCalledWith(
        expect.objectContaining({ isInternal: true, selection: 'draft words' }),
      );
      expect(lastJob().draftOnly).toBe(true);
      expect(lastEvent()[3]).toEqual({ draftOnly: true });
      expect(lastEvent()[2].comment.selection).toBe('draft words');
    }
  });

  it('keeps the inline mark of a draft user comment', async () => {
    const { service, collaborationGateway } = setup(DRAFT_USER);

    await create(service, {
      type: 'inline',
      selection: 'draft words',
      yjsSelection: YJS_SELECTION,
    });

    expect(collaborationGateway.handleYjsEvent).toHaveBeenCalledWith(
      'setCommentMark',
      `page.${PAGE.id}`,
      expect.objectContaining({ commentId: 'new-comment' }),
    );
  });

  it('leaves a plain page-level root of a draft user public', async () => {
    const { service, commentRepo, lastEvent } = setup(DRAFT_USER);

    await create(service, {});

    expect(commentRepo.insertComment).toHaveBeenCalledWith(
      expect.objectContaining({ isInternal: false }),
    );
    expect(lastEvent()[3]).toEqual({ draftOnly: false });
  });

  it('marks an agent reply in a public thread internal', async () => {
    const { service, commentRepo, lastEvent } = setup(DRAFT_USER);

    await create(service, { parentCommentId: PAGE_ROOT.id }, 'ai-chat');

    expect(commentRepo.insertComment).toHaveBeenCalledWith(
      expect.objectContaining({ isInternal: true }),
    );
    expect(lastEvent()[3]).toEqual({ draftOnly: true });
  });

  it('strips the excerpt from public comment events on controlled pages', async () => {
    const { service, commentRepo, lastEvent } = setup(DRAFT_USER);

    await create(service, { parentCommentId: PAGE_ROOT.id, selection: 'quote' });

    expect(commentRepo.insertComment).toHaveBeenCalledWith(
      expect.objectContaining({ isInternal: false }),
    );
    expect(lastEvent()[3]).toEqual({ draftOnly: false });
    expect(lastEvent()[2].comment.selection).toBeNull();
  });

  it('leaves new comments on uncontrolled pages unstamped, even agent ones', async () => {
    const { service, commentRepo, lastEvent, lastJob } = setup(UNCONTROLLED_EDITOR);

    const comment = await create(
      service,
      { type: 'inline', selection: 'quote' },
      'mcp',
    );

    expect(commentRepo.insertComment).toHaveBeenCalledWith(
      expect.objectContaining({ isInternal: false, selection: 'quote' }),
    );
    expect(lastJob().draftOnly).toBeUndefined();
    expect(lastEvent()[3]).toEqual({ draftOnly: false });
    expect(lastEvent()[2].comment.selection).toBe('quote');
    expect(comment.selection).toBe('quote');
  });

  it('lets a viewer of an uncontrolled page comment inline as before', async () => {
    const { service, commentRepo } = setup(UNCONTROLLED_VIEWER);

    await create(service, { type: 'inline', selection: 'words' });

    expect(commentRepo.insertComment).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'inline', isInternal: false }),
    );
  });

  it('hides a stamped thread from replies by a viewer of an uncontrolled page', async () => {
    const { service, commentRepo } = setup(UNCONTROLLED_VIEWER);

    await expect(
      create(service, { parentCommentId: STAMPED_ROOT.id }),
    ).rejects.toThrow('Parent comment not found');
    await expect(
      create(service, { parentCommentId: STAMPED_REPLY.id }),
    ).rejects.toThrow('Parent comment not found');
    expect(commentRepo.insertComment).not.toHaveBeenCalled();
  });

  it('keeps editor replies to a stamped thread among draft users after control ends', async () => {
    const { service, lastEvent, lastJob } = setup(UNCONTROLLED_EDITOR);

    await create(service, { parentCommentId: STAMPED_ROOT.id });

    expect(lastJob().draftOnly).toBe(true);
    expect(lastEvent()[3]).toEqual({ draftOnly: true });
  });
});

describe('CommentService.findByPageId', () => {
  const pagination = { limit: 20 } as any;

  it('lists only public threads for readers and removes excerpts', async () => {
    const { service, commentRepo } = setup(READER);

    const result = await service.findByPageId(PAGE, pagination, USER);

    expect(commentRepo.findPageComments).toHaveBeenCalledWith(PAGE.id, pagination, {
      publicThreadsOnly: true,
      controlled: true,
    });
    expect(result.items.map((c) => c.selection)).toEqual([null, null]);
  });

  it('lists every thread with excerpts for draft users', async () => {
    const { service, commentRepo } = setup(DRAFT_USER);

    const result = await service.findByPageId(PAGE, pagination, USER);

    expect(commentRepo.findPageComments).toHaveBeenCalledWith(PAGE.id, pagination, {
      publicThreadsOnly: false,
      controlled: true,
    });
    expect(result.items[1].selection).toBe('reply quote');
  });

  it('hides stamped threads from viewers of uncontrolled pages and keeps excerpts', async () => {
    const { service, commentRepo } = setup(UNCONTROLLED_VIEWER);

    const result = await service.findByPageId(PAGE, pagination, USER);

    expect(commentRepo.findPageComments).toHaveBeenCalledWith(PAGE.id, pagination, {
      publicThreadsOnly: true,
      controlled: false,
    });
    expect(result.items[1].selection).toBe('reply quote');
  });

  it('lists every thread for editors of uncontrolled pages', async () => {
    const { service, commentRepo } = setup(UNCONTROLLED_EDITOR);

    await service.findByPageId(PAGE, pagination, USER);

    expect(commentRepo.findPageComments).toHaveBeenCalledWith(PAGE.id, pagination, {
      publicThreadsOnly: false,
      controlled: false,
    });
  });
});

describe('CommentService.findVisibleComment', () => {
  it('answers 404 to a reader for an internal thread and its replies', async () => {
    const { service } = setup(READER);

    await expect(
      service.findVisibleComment(INLINE_ROOT, PAGE, USER),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.findVisibleComment(INLINE_REPLY, PAGE, USER),
    ).rejects.toThrow(NotFoundException);
  });

  it('gives a reader a public comment without its excerpt', async () => {
    const { service } = setup(READER);

    const comment = await service.findVisibleComment(PAGE_REPLY, PAGE, USER);

    expect(comment.id).toBe(PAGE_REPLY.id);
    expect(comment.selection).toBeNull();
  });

  it('gives a draft user internal comments as stored', async () => {
    const { service } = setup(DRAFT_USER);

    expect(await service.findVisibleComment(INLINE_ROOT, PAGE, USER)).toBe(
      INLINE_ROOT,
    );
  });

  it('keeps a stamped thread hidden from a reader after the page becomes uncontrolled', async () => {
    const { service } = setup(UNCONTROLLED_VIEWER);

    await expect(
      service.findVisibleComment(STAMPED_ROOT, PAGE, USER),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.findVisibleComment(STAMPED_REPLY, PAGE, USER),
    ).rejects.toThrow(NotFoundException);
    expect(await service.findVisibleComment(INLINE_ROOT, PAGE, USER)).toBe(
      INLINE_ROOT,
    );
  });

  it('shows a stamped thread to an editor after the page becomes uncontrolled', async () => {
    const { service } = setup(UNCONTROLLED_EDITOR);

    expect(await service.findVisibleComment(STAMPED_ROOT, PAGE, USER)).toBe(
      STAMPED_ROOT,
    );
    expect(await service.findVisibleComment(STAMPED_REPLY, PAGE, USER)).toBe(
      STAMPED_REPLY,
    );
  });
});

describe('CommentService.update', () => {
  const dto = { commentId: 'x', content: CONTENT };

  it('answers 404 to a reader before checking ownership', async () => {
    const { service, commentRepo } = setup(READER);

    await expect(service.update(INLINE_ROOT, dto, USER, PAGE)).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      service.update({ ...INLINE_REPLY, creatorId: 'someone' }, dto, USER, PAGE),
    ).rejects.toThrow(NotFoundException);
    expect(commentRepo.updateComment).not.toHaveBeenCalled();
  });

  it('answers 404 to a viewer for a stamped thread after control ends', async () => {
    const { service, commentRepo } = setup(UNCONTROLLED_VIEWER);

    await expect(
      service.update({ ...STAMPED_REPLY }, dto, USER, PAGE),
    ).rejects.toThrow(NotFoundException);
    expect(commentRepo.updateComment).not.toHaveBeenCalled();
  });

  it('keeps edits of internal comments among draft users', async () => {
    const { service, lastEvent } = setup(DRAFT_USER);

    await service.update({ ...INLINE_REPLY }, dto, USER, PAGE);

    expect(lastEvent()[2].operation).toBe('commentUpdated');
    expect(lastEvent()[3]).toEqual({ draftOnly: true });
  });

  it('sends a reader edit of a public comment to page viewers without excerpts', async () => {
    const { service, lastEvent } = setup(READER);

    const updated = await service.update({ ...PAGE_REPLY }, dto, USER, PAGE);

    expect(lastEvent()[3]).toEqual({ draftOnly: false });
    expect(lastEvent()[2].comment.selection).toBeNull();
    expect(updated.selection).toBeNull();
  });
});

describe('CommentService.delete', () => {
  it('rejects a reader for an internal thread before anything is deleted', async () => {
    const { service, commentRepo, wsService } = setup(READER);

    await expect(service.delete(INLINE_ROOT, PAGE, USER)).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      service.delete({ ...INLINE_REPLY, creatorId: 'someone' }, PAGE, USER),
    ).rejects.toThrow(NotFoundException);
    expect(commentRepo.deleteComment).not.toHaveBeenCalled();
    expect(wsService.emitCommentEvent).not.toHaveBeenCalled();
  });

  it('rejects a viewer for a stamped thread after control ends', async () => {
    const { service, commentRepo } = setup(UNCONTROLLED_VIEWER);

    await expect(service.delete(STAMPED_ROOT, PAGE, USER)).rejects.toThrow(
      NotFoundException,
    );
    expect(commentRepo.deleteComment).not.toHaveBeenCalled();
  });

  it('lets a reader delete an own public comment and tells page viewers', async () => {
    const { service, commentRepo, lastEvent } = setup(READER);

    await service.delete(PAGE_REPLY, PAGE, USER);

    expect(commentRepo.deleteComment).toHaveBeenCalledWith(PAGE_REPLY.id);
    expect(lastEvent()[2]).toEqual({
      operation: 'commentDeleted',
      pageId: PAGE.id,
      commentId: PAGE_REPLY.id,
    });
    expect(lastEvent()[3]).toEqual({ draftOnly: false });
  });

  it('keeps deleting comments of others to space admins', async () => {
    const someoneElse = { ...PAGE_ROOT, creatorId: 'someone' };

    const member = setup(DRAFT_USER);
    await expect(member.service.delete(someoneElse, PAGE, USER)).rejects.toThrow(
      ForbiddenException,
    );
    expect(member.commentRepo.deleteComment).not.toHaveBeenCalled();

    const admin = setup(DRAFT_USER, { spaceAdmin: true });
    await admin.service.delete({ ...INLINE_ROOT, creatorId: 'someone' }, PAGE, USER);
    expect(admin.commentRepo.deleteComment).toHaveBeenCalledWith(INLINE_ROOT.id);
    expect(admin.lastEvent()[3]).toEqual({ draftOnly: true });
  });
});
