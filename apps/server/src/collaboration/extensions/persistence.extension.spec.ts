import * as Y from 'yjs';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { Forbidden } from '@hocuspocus/common';
import { PersistenceExtension } from './persistence.extension';
import { tiptapExtensions } from '../collaboration.util';
import { QueueJob } from '../../integrations/queue/constants';
import { buildApprovalState } from '../../core/page/approval/page-approval.utils';
import { ApprovalState } from '../../core/page/approval/page-approval.types';

const PAGE_ID = '01a14cce-0000-7000-8000-0000000000a1';
const DOC_NAME = `page.${PAGE_ID}`;

const UNCONTROLLED = buildApprovalState({ isBase: false });
const CONTROLLED = buildApprovalState({
  isBase: false,
  verificationId: 'verification_1',
  verificationType: 'qms',
  verificationStatus: 'approved',
  readerVersionId: 'history_1',
});

function paragraphDoc(text: string, mentionUserId?: string) {
  const content: any[] = [{ type: 'text', text }];
  if (mentionUserId) {
    content.push({
      type: 'mention',
      attrs: {
        id: `mention_${mentionUserId}`,
        label: mentionUserId,
        entityType: 'user',
        entityId: mentionUserId,
        creatorId: 'user_1',
      },
    });
  }
  return { type: 'doc', content: [{ type: 'paragraph', content }] };
}

function toYdoc(json: any): Y.Doc {
  return TiptapTransformer.toYdoc(json, 'default', tiptapExtensions);
}

function jsonOf(doc: Y.Doc) {
  return TiptapTransformer.fromYdoc(doc, 'default');
}

function ydocBuffer(json: any): Buffer {
  return Buffer.from(Y.encodeStateAsUpdate(toYdoc(json)));
}

function makeConnection(userId: string) {
  return {
    context: { user: { id: userId } },
    readOnly: false,
    close: jest.fn(),
    sendStateless: jest.fn(),
  };
}

function makePage(content: any, ydoc: Buffer | null = null) {
  return {
    id: PAGE_ID,
    slugId: 'slug_1',
    spaceId: 'space_1',
    workspaceId: 'ws_1',
    isBase: false,
    creatorId: 'user_creator',
    contributorIds: ['user_creator'],
    createdAt: new Date('2020-01-01'),
    content,
    ydoc,
  };
}

function makeDraft(content: any, ydoc: Buffer | null = null) {
  return {
    id: 'draft_1',
    pageId: PAGE_ID,
    workspaceId: 'ws_1',
    title: null,
    icon: null,
    content,
    ydoc,
    lastUpdatedById: 'user_previous',
    contributorIds: ['user_creator'],
  };
}

function makeExtension(opts: {
  page: ReturnType<typeof makePage>;
  state?: ApprovalState;
  lockedState?: ApprovalState;
  draft?: ReturnType<typeof makeDraft>;
  createdDraft?: ReturnType<typeof makeDraft>;
  draftUserIds?: string[];
}) {
  const trx = { name: 'page-lock-trx' };
  const db = {
    transaction: () => ({
      execute: (callback: (t: unknown) => Promise<unknown>) => callback(trx),
    }),
  };
  const pageRepo = {
    findById: jest.fn(async () => opts.page),
    updatePage: jest.fn(async () => undefined),
  };
  const pageDraftRepo = {
    findByPageId: jest.fn(async () => opts.draft),
    createFromPage: jest.fn(async () => opts.createdDraft),
    updateContent: jest.fn(async () => 1),
    copyBackToPage: jest.fn(async () => undefined),
  };
  const pageApprovalService = {
    getState: jest.fn(async (_page: unknown, t?: unknown) =>
      t && opts.lockedState
        ? opts.lockedState
        : (opts.state ?? UNCONTROLLED),
    ),
    canAccessDraft: jest.fn(async (user: { id: string }) =>
      (opts.draftUserIds ?? ['user_1']).includes(user.id),
    ),
  };
  const aiQueue = { add: jest.fn(async () => undefined) };
  const historyQueue = { add: jest.fn(async () => undefined) };
  const notificationQueue = { add: jest.fn(async () => undefined) };
  const collabHistory = { addContributors: jest.fn(async () => undefined) };
  const transclusionService = {
    syncPageTransclusions: jest.fn(async () => undefined),
    syncPageReferences: jest.fn(async () => undefined),
  };

  const extension = new PersistenceExtension(
    pageRepo as any,
    db as any,
    aiQueue as any,
    historyQueue as any,
    notificationQueue as any,
    collabHistory as any,
    transclusionService as any,
    pageDraftRepo as any,
    pageApprovalService as any,
  );

  return {
    extension,
    trx,
    pageRepo,
    pageDraftRepo,
    pageApprovalService,
    aiQueue,
    historyQueue,
    notificationQueue,
    collabHistory,
    transclusionService,
  };
}

function loadPayload() {
  return {
    documentName: DOC_NAME,
    document: { isEmpty: () => true },
  } as any;
}

function storePayload(json: any, connections: any[] = []) {
  const document = toYdoc(json) as any;
  document.broadcastStateless = jest.fn();
  document.getConnections = () => connections;
  return {
    documentName: DOC_NAME,
    document,
    lastContext: { user: { id: 'user_1', name: 'User 1', avatarUrl: null } },
  } as any;
}

describe('PersistenceExtension.onLoadDocument', () => {
  it('onLoadDocument loads the draft ydoc when a draft row exists', async () => {
    const pageJson = paragraphDoc('approved content');
    const draftJson = paragraphDoc('draft content');
    const { extension, pageDraftRepo } = makeExtension({
      page: makePage(pageJson, ydocBuffer(pageJson)),
      state: CONTROLLED,
      draft: makeDraft(draftJson, ydocBuffer(draftJson)),
    });

    const doc = await extension.onLoadDocument(loadPayload());

    expect(jsonOf(doc)).toEqual(jsonOf(toYdoc(draftJson)));
    expect(pageDraftRepo.createFromPage).not.toHaveBeenCalled();
    expect(pageDraftRepo.copyBackToPage).not.toHaveBeenCalled();
  });

  it('onLoadDocument creates the draft from the page when the page is controlled and has no draft row', async () => {
    const pageJson = paragraphDoc('approved content');
    const { extension, trx, pageRepo, pageDraftRepo } = makeExtension({
      page: makePage(pageJson, ydocBuffer(pageJson)),
      state: CONTROLLED,
      draft: undefined,
      createdDraft: makeDraft(pageJson, ydocBuffer(pageJson)),
    });

    const doc = await extension.onLoadDocument(loadPayload());

    expect(pageDraftRepo.createFromPage).toHaveBeenCalledTimes(1);
    expect(pageDraftRepo.createFromPage).toHaveBeenCalledWith(PAGE_ID, trx);
    expect(pageRepo.findById).toHaveBeenCalledWith(
      PAGE_ID,
      expect.objectContaining({ withLock: true, trx }),
    );
    expect(jsonOf(doc)).toEqual(jsonOf(toYdoc(pageJson)));
  });

  it('loads the page without creating a draft when control ended before the page lock', async () => {
    const pageJson = paragraphDoc('page content');
    const { extension, pageDraftRepo } = makeExtension({
      page: makePage(pageJson, ydocBuffer(pageJson)),
      state: CONTROLLED,
      lockedState: UNCONTROLLED,
      draft: undefined,
    });

    const doc = await extension.onLoadDocument(loadPayload());

    expect(pageDraftRepo.createFromPage).not.toHaveBeenCalled();
    expect(jsonOf(doc)).toEqual(jsonOf(toYdoc(pageJson)));
  });

  it('onLoadDocument copies a draft on an uncontrolled page back under the page lock, then loads it', async () => {
    const pageJson = paragraphDoc('approved content');
    const draftJson = paragraphDoc('draft content');
    const { extension, trx, pageRepo, pageDraftRepo } = makeExtension({
      page: makePage(pageJson, null),
      state: UNCONTROLLED,
      draft: makeDraft(draftJson, ydocBuffer(draftJson)),
    });

    const doc = await extension.onLoadDocument(loadPayload());

    expect(pageRepo.findById).toHaveBeenCalledWith(
      PAGE_ID,
      expect.objectContaining({ withLock: true, trx }),
    );
    expect(pageDraftRepo.copyBackToPage).toHaveBeenCalledWith(PAGE_ID, trx);
    expect(pageDraftRepo.createFromPage).not.toHaveBeenCalled();
    expect(jsonOf(doc)).toEqual(jsonOf(toYdoc(draftJson)));
  });

  it('keeps the draft when the page is controlled again once locked', async () => {
    const pageJson = paragraphDoc('approved content');
    const draftJson = paragraphDoc('draft content');
    const { extension, pageDraftRepo } = makeExtension({
      page: makePage(pageJson, null),
      state: UNCONTROLLED,
      lockedState: CONTROLLED,
      draft: makeDraft(draftJson, ydocBuffer(draftJson)),
    });

    const doc = await extension.onLoadDocument(loadPayload());

    expect(pageDraftRepo.copyBackToPage).not.toHaveBeenCalled();
    expect(jsonOf(doc)).toEqual(jsonOf(toYdoc(draftJson)));
  });

  it('loads the page for an uncontrolled page without a draft row', async () => {
    const pageJson = paragraphDoc('page content');
    const { extension, pageDraftRepo } = makeExtension({
      page: makePage(pageJson, ydocBuffer(pageJson)),
      state: UNCONTROLLED,
    });

    const doc = await extension.onLoadDocument(loadPayload());

    expect(jsonOf(doc)).toEqual(jsonOf(toYdoc(pageJson)));
    expect(pageDraftRepo.createFromPage).not.toHaveBeenCalled();
    expect(pageDraftRepo.copyBackToPage).not.toHaveBeenCalled();
  });
});

describe('PersistenceExtension.onStoreDocument', () => {
  it('onStoreDocument writes the draft, not the page, for a controlled page', async () => {
    const pageJson = paragraphDoc('approved content');
    const draftJson = paragraphDoc('old draft');
    const liveJson = paragraphDoc('new draft', 'user_2');
    const mocks = makeExtension({
      page: makePage(pageJson),
      state: CONTROLLED,
      draft: makeDraft(draftJson),
    });
    const payload = storePayload(liveJson);

    await mocks.extension.onStoreDocument(payload);

    expect(mocks.pageDraftRepo.updateContent).toHaveBeenCalledWith(
      PAGE_ID,
      expect.objectContaining({
        content: jsonOf(payload.document),
        ydoc: expect.any(Buffer),
        lastUpdatedById: 'user_1',
      }),
      mocks.trx,
    );
    expect(mocks.pageRepo.updatePage).not.toHaveBeenCalled();
    expect(
      mocks.transclusionService.syncPageTransclusions,
    ).not.toHaveBeenCalled();
    expect(mocks.transclusionService.syncPageReferences).not.toHaveBeenCalled();
    expect(mocks.aiQueue.add).not.toHaveBeenCalled();
    expect(mocks.historyQueue.add).toHaveBeenCalledWith(
      QueueJob.PAGE_HISTORY,
      { pageId: PAGE_ID },
      expect.objectContaining({ jobId: PAGE_ID }),
    );
    expect(mocks.notificationQueue.add).toHaveBeenCalledWith(
      QueueJob.PAGE_MENTION_NOTIFICATION,
      expect.objectContaining({
        pageId: PAGE_ID,
        draftOnly: true,
        oldMentionedUserIds: [],
        userMentions: [
          { userId: 'user_2', mentionId: 'mention_user_2', creatorId: 'user_1' },
        ],
      }),
    );
    expect(payload.document.broadcastStateless).toHaveBeenCalledWith(
      expect.stringContaining('"type":"page.updated"'),
    );
  });

  it('onStoreDocument keeps the current behavior for an uncontrolled page without a draft row', async () => {
    const pageJson = paragraphDoc('old content');
    const liveJson = paragraphDoc('new content', 'user_2');
    const mocks = makeExtension({
      page: makePage(pageJson),
      state: UNCONTROLLED,
    });
    const payload = storePayload(liveJson);

    await mocks.extension.onStoreDocument(payload);

    expect(mocks.pageRepo.updatePage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: jsonOf(payload.document),
        textContent: expect.stringContaining('new content'),
        ydoc: expect.any(Buffer),
        lastUpdatedById: 'user_1',
      }),
      PAGE_ID,
      mocks.trx,
    );
    expect(mocks.pageDraftRepo.updateContent).not.toHaveBeenCalled();
    expect(mocks.pageDraftRepo.createFromPage).not.toHaveBeenCalled();
    expect(mocks.pageDraftRepo.copyBackToPage).not.toHaveBeenCalled();
    expect(mocks.transclusionService.syncPageTransclusions).toHaveBeenCalled();
    expect(mocks.aiQueue.add).toHaveBeenCalledWith(
      QueueJob.PAGE_CONTENT_UPDATED,
      { pageIds: [PAGE_ID], workspaceId: 'ws_1' },
    );
    expect(mocks.historyQueue.add).toHaveBeenCalled();
    const [, mentionJob] = mocks.notificationQueue.add.mock.calls[0] as any[];
    expect(mentionJob.draftOnly).toBeUndefined();
    expect(mocks.pageApprovalService.canAccessDraft).not.toHaveBeenCalled();
  });

  it('onStoreDocument self-heals a draft on an uncontrolled page', async () => {
    const pageJson = paragraphDoc('approved content');
    const draftJson = paragraphDoc('draft content');
    const liveJson = paragraphDoc('draft content plus more');
    const mocks = makeExtension({
      page: makePage(pageJson),
      state: UNCONTROLLED,
      draft: makeDraft(draftJson),
    });
    const payload = storePayload(liveJson);

    await mocks.extension.onStoreDocument(payload);

    expect(mocks.pageDraftRepo.copyBackToPage).toHaveBeenCalledWith(
      PAGE_ID,
      mocks.trx,
    );
    expect(mocks.pageRepo.updatePage).toHaveBeenCalledWith(
      expect.objectContaining({ content: jsonOf(payload.document) }),
      PAGE_ID,
      mocks.trx,
    );
    const copyOrder =
      mocks.pageDraftRepo.copyBackToPage.mock.invocationCallOrder[0];
    const updateOrder = mocks.pageRepo.updatePage.mock.invocationCallOrder[0];
    expect(copyOrder).toBeLessThan(updateOrder);
    expect(mocks.pageDraftRepo.updateContent).not.toHaveBeenCalled();
    expect(mocks.transclusionService.syncPageTransclusions).toHaveBeenCalled();
    expect(mocks.aiQueue.add).toHaveBeenCalled();
  });

  it('writes the live document to the page after a self-heal even when it equals the old page content', async () => {
    const payload = storePayload(paragraphDoc('approved content'));
    const mocks = makeExtension({
      page: makePage(jsonOf(payload.document)),
      state: UNCONTROLLED,
      draft: makeDraft(paragraphDoc('abandoned draft edit')),
    });

    await mocks.extension.onStoreDocument(payload);

    expect(mocks.pageDraftRepo.copyBackToPage).toHaveBeenCalledWith(
      PAGE_ID,
      mocks.trx,
    );
    expect(mocks.pageRepo.updatePage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: jsonOf(payload.document),
        ydoc: Buffer.from(Y.encodeStateAsUpdate(payload.document)),
      }),
      PAGE_ID,
      mocks.trx,
    );
  });

  it('creates the missing draft inside the page lock transaction and stores the live ydoc', async () => {
    const payload = storePayload(paragraphDoc('approved content'));
    const mocks = makeExtension({
      page: makePage(jsonOf(payload.document)),
      state: CONTROLLED,
      draft: undefined,
      createdDraft: makeDraft(jsonOf(payload.document)),
    });

    await mocks.extension.onStoreDocument(payload);

    expect(mocks.pageDraftRepo.createFromPage).toHaveBeenCalledWith(
      PAGE_ID,
      mocks.trx,
    );
    expect(mocks.pageDraftRepo.updateContent).toHaveBeenCalledWith(
      PAGE_ID,
      expect.objectContaining({
        ydoc: Buffer.from(Y.encodeStateAsUpdate(payload.document)),
      }),
      mocks.trx,
    );
    expect(mocks.pageRepo.updatePage).not.toHaveBeenCalled();
    expect(mocks.historyQueue.add).not.toHaveBeenCalled();
  });

  it('attributes a store without a user to the draft last updater', async () => {
    const mocks = makeExtension({
      page: makePage(paragraphDoc('approved content')),
      state: CONTROLLED,
      draft: makeDraft(paragraphDoc('old draft')),
    });
    const payload = storePayload(paragraphDoc('frozen draft'));
    payload.lastContext = {};

    await mocks.extension.onStoreDocument(payload);

    expect(mocks.pageDraftRepo.updateContent).toHaveBeenCalledWith(
      PAGE_ID,
      expect.objectContaining({ lastUpdatedById: 'user_previous' }),
      mocks.trx,
    );
  });

  it('skips the write and its side effects when the draft content is unchanged', async () => {
    const liveJson = paragraphDoc('same draft');
    const payload = storePayload(liveJson);
    const mocks = makeExtension({
      page: makePage(paragraphDoc('approved content')),
      state: CONTROLLED,
      draft: makeDraft(jsonOf(payload.document)),
    });

    await mocks.extension.onStoreDocument(payload);

    expect(mocks.pageDraftRepo.updateContent).not.toHaveBeenCalled();
    expect(mocks.pageRepo.updatePage).not.toHaveBeenCalled();
    expect(mocks.historyQueue.add).not.toHaveBeenCalled();
    expect(mocks.notificationQueue.add).not.toHaveBeenCalled();
    expect(payload.document.broadcastStateless).not.toHaveBeenCalled();
  });

  it('closes connections whose users lost draft access after a draft store', async () => {
    const editor = makeConnection('user_1');
    const formerApprover = makeConnection('user_2');
    const mocks = makeExtension({
      page: makePage(paragraphDoc('approved content')),
      state: CONTROLLED,
      draft: makeDraft(paragraphDoc('old draft')),
      draftUserIds: ['user_1'],
    });

    await mocks.extension.onStoreDocument(
      storePayload(paragraphDoc('new draft'), [editor, formerApprover]),
    );

    expect(formerApprover.close).toHaveBeenCalledWith(Forbidden);
    expect(formerApprover.readOnly).toBe(true);
    expect(formerApprover.sendStateless).toHaveBeenCalledWith(
      JSON.stringify({ type: 'page.permissions', access: 'none' }),
    );
    expect(editor.close).not.toHaveBeenCalled();
    expect(editor.readOnly).toBe(false);
    expect(mocks.pageApprovalService.canAccessDraft).toHaveBeenCalledWith(
      { id: 'user_2' },
      expect.objectContaining({ id: PAGE_ID }),
      CONTROLLED,
    );
  });

  it('fails the store and keeps contributors when the draft row is gone', async () => {
    const mocks = makeExtension({
      page: makePage(paragraphDoc('approved content')),
      state: CONTROLLED,
      draft: makeDraft(paragraphDoc('old draft')),
    });
    mocks.pageDraftRepo.updateContent.mockResolvedValueOnce(0);
    await mocks.extension.onChange({
      documentName: DOC_NAME,
      context: { user: { id: 'user_1' } },
    } as any);

    await mocks.extension.onStoreDocument(
      storePayload(paragraphDoc('new draft')),
    );

    expect(mocks.historyQueue.add).not.toHaveBeenCalled();
    expect(mocks.pageRepo.updatePage).not.toHaveBeenCalled();
    expect([...(mocks.extension as any).contributors.get(DOC_NAME)]).toEqual([
      'user_1',
    ]);
  });
});
