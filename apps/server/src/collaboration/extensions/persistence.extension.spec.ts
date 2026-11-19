import { TiptapTransformer } from '@hocuspocus/transformer';
import { PersistenceExtension } from './persistence.extension';
import { tiptapExtensions } from '../collaboration.util';
import { QueueJob } from '../../integrations/queue/constants';

const textDoc = (text: string, marks?: object[]) => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text, ...(marks && { marks }) }],
    },
  ],
});

describe('PersistenceExtension.onStoreDocument', () => {
  const updatedAt = new Date('2026-01-01T00:00:00.000Z');
  let pageRepo: any;
  let historyQueue: any;
  let collabHistory: any;
  let extension: PersistenceExtension;

  beforeEach(() => {
    pageRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'page-1',
        slugId: 'slug-1',
        spaceId: 'space-1',
        workspaceId: 'ws-1',
        creatorId: 'creator-1',
        contributorIds: [],
        content: textDoc('hello'),
        createdAt: new Date(0),
        updatedAt,
      }),
      updatePage: jest.fn().mockResolvedValue(undefined),
    };
    const db: any = {
      transaction: () => ({ execute: (callback: any) => callback({}) }),
    };
    const queue = () => ({ add: jest.fn().mockResolvedValue(undefined) });
    historyQueue = queue();
    collabHistory = { addContributors: jest.fn().mockResolvedValue(undefined) };
    extension = new PersistenceExtension(
      pageRepo,
      db,
      queue() as any,
      historyQueue,
      queue() as any,
      collabHistory,
      {
        syncPageTransclusions: jest.fn().mockResolvedValue(undefined),
        syncPageReferences: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        invalidateForEdit: jest.fn().mockResolvedValue(null),
        notifyInvalidated: jest.fn().mockResolvedValue(undefined),
      } as any,
    );
  });

  async function store(content: object) {
    const document: any = TiptapTransformer.toYdoc(
      content,
      'default',
      tiptapExtensions,
    );
    document.broadcastStateless = jest.fn();
    const context = { user: { id: 'user-1', name: 'User' } };
    await extension.onChange({
      documentName: 'page.page-1',
      context,
    } as any);
    await extension.onStoreDocument({
      documentName: 'page.page-1',
      document,
      lastContext: context,
    } as any);
    return document;
  }

  it('saves a comment without counting it as an edit', async () => {
    const document = await store(
      textDoc('hello', [
        { type: 'comment', attrs: { commentId: 'comment-1', resolved: false } },
      ]),
    );

    const update = pageRepo.updatePage.mock.calls[0][0];
    expect(update.content).toEqual(
      TiptapTransformer.fromYdoc(document, 'default'),
    );
    expect(update.updatedAt).toBe(updatedAt);
    expect(update).not.toHaveProperty('lastUpdatedById');
    expect(update).not.toHaveProperty('contributorIds');
    expect(collabHistory.addContributors).not.toHaveBeenCalled();
    expect(document.broadcastStateless).not.toHaveBeenCalled();
    expect(historyQueue.add).not.toHaveBeenCalled();
  });

  it('credits a visible change to the editor', async () => {
    const document = await store(textDoc('hello world'));

    const update = pageRepo.updatePage.mock.calls[0][0];
    expect(update).not.toHaveProperty('updatedAt');
    expect(update.lastUpdatedById).toBe('user-1');
    expect(update.contributorIds).toEqual(['user-1', 'creator-1']);
    expect(collabHistory.addContributors).toHaveBeenCalledWith('page-1', [
      'user-1',
    ]);
    expect(document.broadcastStateless).toHaveBeenCalledTimes(1);
    expect(historyQueue.add).toHaveBeenCalledWith(
      QueueJob.PAGE_HISTORY,
      { pageId: 'page-1' },
      expect.objectContaining({ jobId: 'page-1' }),
    );
  });
});
