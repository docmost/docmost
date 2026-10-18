import { ConflictException, Logger } from '@nestjs/common';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { Page, User } from '@docmost/db/types/entity.types';
import { PageApprovalPublishService } from './page-approval-publish.service';
import { buildApprovalState } from './page-approval.utils';
import { ApprovalState } from './page-approval.types';
import { QueueJob } from '../../../integrations/queue/constants';
import { tiptapExtensions } from '../../../collaboration/collaboration.util';
import { getProsemirrorContent } from '../../../common/helpers/prosemirror/utils';

const PAGE_ID = '01a14cce-0000-7000-8000-0000000000a1';
const HISTORY_ID = '01a14cce-0000-7000-8000-0000000000b1';
const ATTACHMENT_ID = '01a14cce-0000-7000-8000-0000000000c1';
const LINKED_PAGE_ID = '01a14cce-0000-7000-8000-0000000000d1';
const TRX = { name: 'caller-trx' } as any;
const ACTOR = { id: 'user_approver', name: 'Approver' } as User;

const CONTROLLED = buildApprovalState({
  isBase: false,
  verificationId: 'verification_1',
  verificationType: 'qms',
  verificationStatus: 'approved',
  readerVersionId: HISTORY_ID,
});
const UNCONTROLLED = buildApprovalState({ isBase: false });
const UNPUBLISHED = buildApprovalState({
  isBase: false,
  spaceSettings: { approval: { enabled: true } },
});

function makePage(overrides: Partial<Page> = {}): Page {
  return {
    id: PAGE_ID,
    slugId: 'slug_1',
    title: 'Old title',
    icon: null,
    spaceId: 'space_1',
    workspaceId: 'ws_1',
    parentPageId: 'parent_1',
    position: 'a0',
    creatorId: 'user_creator',
    isBase: false,
    deletedAt: null,
    ...overrides,
  } as Page;
}

function textDoc(text: string, extra: any[] = []) {
  return {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text }] },
      ...extra,
    ],
  };
}

const imageNode = (attachmentId: string) => ({
  type: 'image',
  attrs: { src: `/api/files/${attachmentId}/a.png`, attachmentId },
});

const pageMentionParagraph = (pageId: string) => ({
  type: 'paragraph',
  content: [
    { type: 'text', text: 'See ' },
    {
      type: 'mention',
      attrs: {
        id: 'mention_1',
        label: 'Linked page',
        entityType: 'page',
        entityId: pageId,
        creatorId: 'user_creator',
      },
    },
  ],
});

// What the collab store writes after a replace with this JSON.
function asStoredByYjs(json: any) {
  return TiptapTransformer.fromYdoc(
    TiptapTransformer.toYdoc(json, 'default', tiptapExtensions),
    'default',
  );
}

function snapshotRow(overrides: Record<string, unknown> = {}) {
  return {
    id: HISTORY_ID,
    pageId: PAGE_ID,
    kind: 'draft',
    title: 'New title',
    icon: 'icon-new',
    content: textDoc('Approved body'),
    ...overrides,
  };
}

function makeService(
  opts: {
    snapshot?: any;
    draft?: any;
    readerVersion?: any;
    state?: ApprovalState;
    page?: Page | undefined;
    memberIds?: string[];
    accessibleIds?: string[];
    draftUserIds?: string[];
  } = {},
) {
  const pageRepo = {
    findById: jest.fn(async () => ('page' in opts ? opts.page : makePage())),
    updatePage: jest.fn(async () => undefined),
  };
  const pageDraftRepo = {
    findByPageId: jest.fn(async () => opts.draft),
    copyBackToPage: jest.fn(async () => undefined),
    clearTitleIcon: jest.fn(async () => undefined),
  };
  const pageHistoryRepo = {
    findById: jest.fn(async () => opts.snapshot),
    nextApprovedVersion: jest.fn(async () => 1),
    markApproved: jest.fn(async () => undefined),
    findLatestReaderVersion: jest.fn(async () => opts.readerVersion),
  };
  const attachmentRepo = {
    markPublished: jest.fn(async () => undefined),
    markAllPublishedForPage: jest.fn(async () => undefined),
    softDeleteUnpublished: jest.fn(async () => undefined),
  };
  const spaceMemberRepo = {
    getSpaceMemberUserIds: jest.fn(async () => opts.memberIds ?? []),
  };
  const pagePermissionRepo = {
    getUserIdsWithPageAccess: jest.fn(async () => opts.accessibleIds ?? []),
  };
  const pageApprovalService = {
    getState: jest.fn(async () => opts.state ?? CONTROLLED),
    getUserIdsWithDraftAccess: jest.fn(async () => opts.draftUserIds ?? []),
  };
  const transclusionService = {
    syncPageTransclusions: jest.fn(async () => undefined),
    syncPageReferences: jest.fn(async () => undefined),
  };
  const wsService = { emitToUsers: jest.fn(async () => undefined) };
  const wsTreeService = {
    notifyPermissionGranted: jest.fn(async () => undefined),
  };
  const collaborationGateway = {
    handleYjsEvent: jest.fn(async () => undefined),
  };
  const aiQueue = { add: jest.fn(async () => undefined) };
  const generalQueue = { add: jest.fn(async () => undefined) };
  const notificationQueue = { add: jest.fn(async () => undefined) };

  const service = new PageApprovalPublishService(
    pageRepo as any,
    pageDraftRepo as any,
    pageHistoryRepo as any,
    attachmentRepo as any,
    spaceMemberRepo as any,
    pagePermissionRepo as any,
    pageApprovalService as any,
    transclusionService as any,
    wsService as any,
    wsTreeService as any,
    collaborationGateway as any,
    aiQueue as any,
    generalQueue as any,
    notificationQueue as any,
  );

  return {
    service,
    pageRepo,
    pageDraftRepo,
    pageHistoryRepo,
    attachmentRepo,
    spaceMemberRepo,
    pagePermissionRepo,
    pageApprovalService,
    transclusionService,
    wsService,
    wsTreeService,
    collaborationGateway,
    aiQueue,
    generalQueue,
    notificationQueue,
  };
}

describe('PageApprovalPublishService', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('publishSnapshot', () => {
    const publish = (ctx: ReturnType<typeof makeService>) =>
      ctx.service.publishSnapshot(
        { page: makePage(), historyId: HISTORY_ID, approverId: ACTOR.id },
        TRX,
      );

    it('publishSnapshot writes history content to the page and marks the row approved with version 1', async () => {
      const snapshot = snapshotRow();
      const ctx = makeService({ snapshot });

      const result = await publish(ctx);

      expect(result).toEqual({ version: 1, content: snapshot.content });
      expect(ctx.pageHistoryRepo.findById).toHaveBeenCalledWith(HISTORY_ID, {
        includeContent: true,
        trx: TRX,
      });
      expect(ctx.pageHistoryRepo.nextApprovedVersion).toHaveBeenCalledWith(
        PAGE_ID,
        TRX,
      );
      expect(ctx.pageHistoryRepo.markApproved).toHaveBeenCalledWith(
        HISTORY_ID,
        { version: 1, approvedById: ACTOR.id, approvedAt: expect.any(Date) },
        TRX,
      );
      expect(ctx.pageRepo.updatePage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: snapshot.content,
          textContent: 'Approved body',
          title: 'New title',
          icon: 'icon-new',
        }),
        PAGE_ID,
        TRX,
      );
    });

    it('publishSnapshot sets reader_version_id', async () => {
      const ctx = makeService({ snapshot: snapshotRow() });

      await publish(ctx);

      expect(ctx.pageRepo.updatePage).toHaveBeenCalledWith(
        expect.objectContaining({ readerVersionId: HISTORY_ID }),
        PAGE_ID,
        TRX,
      );
    });

    it('publishSnapshot marks referenced attachments published', async () => {
      const content = textDoc('With a file', [imageNode(ATTACHMENT_ID)]);
      const ctx = makeService({ snapshot: snapshotRow({ content }) });

      await publish(ctx);

      expect(ctx.attachmentRepo.markPublished).toHaveBeenCalledWith(
        'ws_1',
        [ATTACHMENT_ID],
        TRX,
      );
    });

    it.each([
      ['a missing row', undefined],
      ['an approved row', snapshotRow({ kind: 'approved' })],
      ['a baseline row', snapshotRow({ kind: 'baseline' })],
      ['a row of another page', snapshotRow({ pageId: LINKED_PAGE_ID })],
    ])(
      'publishSnapshot refuses %s with 409 before writing',
      async (_label, snapshot) => {
        const ctx = makeService({ snapshot });

        await expect(publish(ctx)).rejects.toBeInstanceOf(ConflictException);
        expect(ctx.pageHistoryRepo.markApproved).not.toHaveBeenCalled();
        expect(ctx.pageRepo.updatePage).not.toHaveBeenCalled();
        expect(ctx.attachmentRepo.markPublished).not.toHaveBeenCalled();
      },
    );

    it('publishSnapshot clears draft title and icon overrides equal to the published ones', async () => {
      const ctx = makeService({
        snapshot: snapshotRow(),
        draft: { title: 'New title', icon: null },
      });

      await publish(ctx);

      expect(ctx.pageDraftRepo.findByPageId).toHaveBeenCalledWith(PAGE_ID, {
        trx: TRX,
      });
      expect(ctx.pageDraftRepo.clearTitleIcon).toHaveBeenCalledWith(
        PAGE_ID,
        TRX,
      );
    });

    it('publishSnapshot treats a cleared draft icon and a null published icon as equal', async () => {
      const ctx = makeService({
        snapshot: snapshotRow({ icon: null }),
        draft: { title: null, icon: '' },
      });

      await publish(ctx);

      expect(ctx.pageDraftRepo.clearTitleIcon).toHaveBeenCalled();
    });

    it.each([
      ['a newer draft title', { title: 'Newer title', icon: null }],
      ['no overrides', { title: null, icon: null }],
    ])(
      'publishSnapshot keeps the draft title and icon with %s',
      async (_label, draft) => {
        const ctx = makeService({ snapshot: snapshotRow(), draft });

        await publish(ctx);

        expect(ctx.pageDraftRepo.clearTitleIcon).not.toHaveBeenCalled();
      },
    );
  });

  describe('publishDraftToPage', () => {
    it('publishDraftToPage copies ydoc back and deletes the draft', async () => {
      const content = textDoc('Draft body');
      const ctx = makeService({ page: makePage({ content } as any) });

      const result = await ctx.service.publishDraftToPage(PAGE_ID, TRX);

      expect(result).toEqual({ content });
      expect(ctx.pageRepo.findById).toHaveBeenCalledWith(PAGE_ID, {
        withLock: true,
        trx: TRX,
      });
      expect(ctx.pageDraftRepo.copyBackToPage).toHaveBeenCalledWith(
        PAGE_ID,
        TRX,
      );
      expect(ctx.pageRepo.findById.mock.invocationCallOrder[0]).toBeLessThan(
        ctx.pageDraftRepo.copyBackToPage.mock.invocationCallOrder[0],
      );
      expect(ctx.attachmentRepo.markAllPublishedForPage).toHaveBeenCalledWith(
        PAGE_ID,
        TRX,
      );
      expect(ctx.pageRepo.updatePage).toHaveBeenCalledWith(
        { readerVersionId: null },
        PAGE_ID,
        TRX,
      );
      expect(ctx.pageRepo.findById).toHaveBeenLastCalledWith(PAGE_ID, {
        includeContent: true,
        trx: TRX,
      });
    });

    it('publishDraftToPage keeps reader_version_id when asked', async () => {
      const ctx = makeService({ page: makePage({ content: null } as any) });

      await ctx.service.publishDraftToPage(PAGE_ID, TRX, {
        keepReaderVersion: true,
      });

      expect(ctx.pageDraftRepo.copyBackToPage).toHaveBeenCalledWith(
        PAGE_ID,
        TRX,
      );
      expect(ctx.pageRepo.updatePage).toHaveBeenCalledWith({}, PAGE_ID, TRX);
    });
  });

  describe('discardDraftToReaderVersion', () => {
    it('discard resets the draft to the reader version and removes unpublished attachments', async () => {
      const readerContent = textDoc('Approved body');
      const ctx = makeService({
        readerVersion: { id: HISTORY_ID, content: readerContent },
        draft: { content: asStoredByYjs(readerContent) },
      });

      await ctx.service.discardDraftToReaderVersion(makePage(), ACTOR);

      expect(ctx.pageHistoryRepo.findLatestReaderVersion).toHaveBeenCalledWith(
        PAGE_ID,
        { includeContent: true },
      );
      expect(ctx.collaborationGateway.handleYjsEvent).toHaveBeenCalledWith(
        'updatePageContent',
        `page.${PAGE_ID}`,
        {
          operation: 'replace',
          prosemirrorJson: readerContent,
          user: ACTOR,
          force: true,
        },
      );
      expect(ctx.pageDraftRepo.findByPageId).toHaveBeenCalledWith(PAGE_ID, {
        includeContent: true,
      });
      expect(ctx.pageDraftRepo.clearTitleIcon).toHaveBeenCalledWith(PAGE_ID);
      expect(ctx.attachmentRepo.softDeleteUnpublished).toHaveBeenCalledWith(
        PAGE_ID,
      );
      const [replaced] =
        ctx.collaborationGateway.handleYjsEvent.mock.invocationCallOrder;
      const [draftRead] =
        ctx.pageDraftRepo.findByPageId.mock.invocationCallOrder;
      expect(replaced).toBeLessThan(draftRead);
    });

    it('discard accepts a draft stored exactly as the reader version', async () => {
      const readerContent = asStoredByYjs(textDoc('Approved body'));
      const ctx = makeService({
        readerVersion: { id: HISTORY_ID, content: readerContent },
        draft: { content: readerContent },
      });

      await ctx.service.discardDraftToReaderVersion(makePage(), ACTOR);

      expect(ctx.attachmentRepo.softDeleteUnpublished).toHaveBeenCalled();
    });

    it('discard resets to an empty document when the page has no reader version', async () => {
      const empty = getProsemirrorContent(null);
      const ctx = makeService({
        state: UNPUBLISHED,
        readerVersion: undefined,
        draft: { content: asStoredByYjs(empty) },
      });

      await ctx.service.discardDraftToReaderVersion(makePage(), ACTOR);

      expect(ctx.collaborationGateway.handleYjsEvent).toHaveBeenCalledWith(
        'updatePageContent',
        `page.${PAGE_ID}`,
        expect.objectContaining({ prosemirrorJson: empty, force: true }),
      );
      expect(ctx.attachmentRepo.softDeleteUnpublished).toHaveBeenCalled();
    });

    it('discard throws when the stored draft was not reset', async () => {
      const ctx = makeService({
        readerVersion: { id: HISTORY_ID, content: textDoc('Approved body') },
        draft: { content: asStoredByYjs(textDoc('Unapproved edits')) },
      });

      const result = ctx.service.discardDraftToReaderVersion(makePage(), ACTOR);

      await expect(result).rejects.toBeInstanceOf(ConflictException);
      await expect(result).rejects.toThrow(
        'The draft could not be reset. Nothing was changed.',
      );
      expect(ctx.pageDraftRepo.clearTitleIcon).not.toHaveBeenCalled();
      expect(ctx.attachmentRepo.softDeleteUnpublished).not.toHaveBeenCalled();
    });

    it('discard throws when the draft row is gone after the reset', async () => {
      const ctx = makeService({
        readerVersion: { id: HISTORY_ID, content: textDoc('Approved body') },
        draft: undefined,
      });

      await expect(
        ctx.service.discardDraftToReaderVersion(makePage(), ACTOR),
      ).rejects.toThrow('The draft could not be reset. Nothing was changed.');
      expect(ctx.attachmentRepo.softDeleteUnpublished).not.toHaveBeenCalled();
    });

    it('discard throws a conflict when the collaboration event fails', async () => {
      const logError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      const ctx = makeService({
        readerVersion: { id: HISTORY_ID, content: textDoc('Approved body') },
      });
      ctx.collaborationGateway.handleYjsEvent.mockRejectedValueOnce(
        new Error('TIMEOUT'),
      );

      await expect(
        ctx.service.discardDraftToReaderVersion(makePage(), ACTOR),
      ).rejects.toThrow('The draft could not be reset. Nothing was changed.');
      expect(logError).toHaveBeenCalledTimes(1);
      expect(ctx.pageDraftRepo.findByPageId).not.toHaveBeenCalled();
      expect(ctx.attachmentRepo.softDeleteUnpublished).not.toHaveBeenCalled();
    });

    it('discard refuses a page that no longer requires approval', async () => {
      const ctx = makeService({ state: UNCONTROLLED });

      await expect(
        ctx.service.discardDraftToReaderVersion(makePage(), ACTOR),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(ctx.collaborationGateway.handleYjsEvent).not.toHaveBeenCalled();
      expect(ctx.attachmentRepo.softDeleteUnpublished).not.toHaveBeenCalled();
    });
  });

  describe('runPostPublish', () => {
    const READER = 'user_reader';
    const EDITOR = 'user_editor';
    const HIDDEN = 'user_hidden';

    it('runPostPublish queues AI and backlinks jobs and resets connections', async () => {
      const content = textDoc('Body', [pageMentionParagraph(LINKED_PAGE_ID)]);
      const ctx = makeService();

      await ctx.service.runPostPublish({
        page: makePage(),
        content,
        actorId: ACTOR.id,
        notifyWatchers: false,
      });

      expect(ctx.aiQueue.add).toHaveBeenCalledWith(
        QueueJob.PAGE_CONTENT_UPDATED,
        { pageIds: [PAGE_ID], workspaceId: 'ws_1' },
      );
      expect(ctx.generalQueue.add).toHaveBeenCalledWith(
        QueueJob.PAGE_BACKLINKS,
        {
          pageId: PAGE_ID,
          workspaceId: 'ws_1',
          mentions: [expect.objectContaining({ entityId: LINKED_PAGE_ID })],
          internalLinkSlugIds: [],
        },
      );
      expect(
        ctx.transclusionService.syncPageTransclusions,
      ).toHaveBeenCalledWith(PAGE_ID, 'ws_1', content);
      expect(ctx.transclusionService.syncPageReferences).toHaveBeenCalledWith(
        PAGE_ID,
        'ws_1',
        content,
      );
      expect(ctx.collaborationGateway.handleYjsEvent).toHaveBeenCalledWith(
        'resetConnections',
        `page.${PAGE_ID}`,
        undefined,
        true,
      );
      expect(ctx.notificationQueue.add).not.toHaveBeenCalled();
    });

    it('runPostPublish queues the watcher notification when asked', async () => {
      const ctx = makeService();

      await ctx.service.runPostPublish({
        page: makePage(),
        content: textDoc('Body'),
        actorId: ACTOR.id,
        notifyWatchers: true,
      });

      expect(ctx.notificationQueue.add).toHaveBeenCalledWith(
        QueueJob.PAGE_UPDATED,
        {
          pageId: PAGE_ID,
          spaceId: 'space_1',
          workspaceId: 'ws_1',
          actorIds: [ACTOR.id],
        },
      );
    });

    it('runPostPublish sends the published title only to users who can access the page', async () => {
      const published = makePage({ title: 'Approved title', icon: 'icon-a' });
      const ctx = makeService({
        page: published,
        memberIds: [READER, EDITOR, HIDDEN],
        accessibleIds: [READER, EDITOR],
      });

      await ctx.service.runPostPublish({
        page: makePage(),
        content: textDoc('Body'),
        actorId: ACTOR.id,
        notifyWatchers: false,
      });

      expect(ctx.spaceMemberRepo.getSpaceMemberUserIds).toHaveBeenCalledWith(
        'space_1',
      );
      expect(
        ctx.pagePermissionRepo.getUserIdsWithPageAccess,
      ).toHaveBeenCalledWith(PAGE_ID, [READER, EDITOR, HIDDEN]);
      expect(ctx.wsService.emitToUsers).toHaveBeenCalledWith([READER, EDITOR], {
        operation: 'updateOne',
        spaceId: 'space_1',
        entity: ['pages'],
        id: PAGE_ID,
        payload: {
          title: 'Approved title',
          slugId: 'slug_1',
          parentPageId: 'parent_1',
          icon: 'icon-a',
        },
      });
      expect(ctx.wsService.emitToUsers).toHaveBeenCalledWith([READER, EDITOR], {
        operation: 'pageApprovalPublished',
        pageId: PAGE_ID,
        spaceId: 'space_1',
        slugId: 'slug_1',
      });
      expect(ctx.wsTreeService.notifyPermissionGranted).not.toHaveBeenCalled();
      expect(
        ctx.pageApprovalService.getUserIdsWithDraftAccess,
      ).not.toHaveBeenCalled();
    });

    it('runPostPublish adds the tree node on first publish for users who could not see the page', async () => {
      const published = makePage({ title: 'Approved title' });
      const ctx = makeService({
        page: published,
        memberIds: [READER, EDITOR, HIDDEN],
        accessibleIds: [READER, EDITOR],
        draftUserIds: [EDITOR],
      });

      await ctx.service.runPostPublish({
        page: makePage(),
        content: textDoc('Body'),
        actorId: ACTOR.id,
        notifyWatchers: false,
        firstPublish: true,
      });

      expect(
        ctx.pageApprovalService.getUserIdsWithDraftAccess,
      ).toHaveBeenCalledWith(published, [READER, EDITOR]);
      expect(ctx.wsTreeService.notifyPermissionGranted).toHaveBeenCalledWith(
        published,
        [READER],
      );
      expect(ctx.wsService.emitToUsers).toHaveBeenCalledWith(
        [READER, EDITOR],
        expect.objectContaining({ operation: 'pageApprovalPublished' }),
      );
    });

    it('runPostPublish sends no page events for a trashed page', async () => {
      const ctx = makeService({
        page: makePage({ deletedAt: new Date() }),
        memberIds: [READER],
        accessibleIds: [READER],
      });

      await ctx.service.runPostPublish({
        page: makePage(),
        content: textDoc('Body'),
        actorId: ACTOR.id,
        notifyWatchers: false,
        firstPublish: true,
      });

      expect(ctx.wsService.emitToUsers).not.toHaveBeenCalled();
      expect(ctx.wsTreeService.notifyPermissionGranted).not.toHaveBeenCalled();
      expect(ctx.collaborationGateway.handleYjsEvent).toHaveBeenCalled();
    });

    it('runPostPublish keeps going when one side effect fails', async () => {
      const logError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      const ctx = makeService({ memberIds: [READER], accessibleIds: [READER] });
      ctx.aiQueue.add.mockRejectedValueOnce(new Error('redis down'));
      ctx.transclusionService.syncPageTransclusions.mockRejectedValueOnce(
        new Error('db down'),
      );

      await expect(
        ctx.service.runPostPublish({
          page: makePage(),
          content: textDoc('Body'),
          actorId: ACTOR.id,
          notifyWatchers: true,
        }),
      ).resolves.toBeUndefined();

      expect(logError).toHaveBeenCalledTimes(2);
      expect(ctx.transclusionService.syncPageReferences).toHaveBeenCalled();
      expect(ctx.generalQueue.add).toHaveBeenCalled();
      expect(ctx.notificationQueue.add).toHaveBeenCalled();
      expect(ctx.wsService.emitToUsers).toHaveBeenCalled();
      expect(ctx.collaborationGateway.handleYjsEvent).toHaveBeenCalled();
    });

    it('runPostPublish clears backlinks of an empty published page', async () => {
      const ctx = makeService();

      await ctx.service.runPostPublish({
        page: makePage(),
        content: null,
        actorId: ACTOR.id,
        notifyWatchers: false,
      });

      expect(ctx.generalQueue.add).toHaveBeenCalledWith(
        QueueJob.PAGE_BACKLINKS,
        {
          pageId: PAGE_ID,
          workspaceId: 'ws_1',
          mentions: [],
          internalLinkSlugIds: [],
        },
      );
    });
  });
});
