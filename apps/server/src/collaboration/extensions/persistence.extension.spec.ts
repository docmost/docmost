import {
  Document,
  Hocuspocus,
  type onChangePayload,
  type onLoadDocumentPayload,
  type onStoreDocumentPayload,
} from '@hocuspocus/server';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { Logger } from '@nestjs/common';
import * as Y from 'yjs';
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
      { getPageHistoryInterval: () => 5 * 60_000 } as any,
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

const documentName = 'page.test-page';
const previousContent = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Published' }] }],
};

function setup() {
  const page = {
    id: 'test-page',
    spaceId: 'space',
    workspaceId: 'workspace',
    creatorId: 'creator',
    createdAt: new Date(),
    content: previousContent,
    textContent: 'Published',
    ydoc: null as Buffer | null,
  };
  const repo = {
    findById: jest.fn(async () => ({ ...page })),
    saveYdocState: jest.fn(async (_id: string, state: Buffer) => {
      page.ydoc = state;
    }),
    updatePage: jest.fn(async (values) => {
      Object.assign(page, values);
    }),
  };
  const db = { transaction: () => ({ execute: (fn) => fn({}) }) };
  const queue = { add: jest.fn() };
  const history = { addContributors: jest.fn() };
  const transclusion = {
    syncPageTransclusions: jest.fn(),
    syncPageReferences: jest.fn(),
  };
  const extension = new PersistenceExtension(
    repo as any,
    db as any,
    queue as any,
    queue as any,
    queue as any,
    history as any,
    transclusion as any,
    {
      invalidateForEdit: jest.fn(async () => null),
      notifyInvalidated: jest.fn(),
    } as any,
    { getPageHistoryInterval: () => 300_000 } as any,
  );
  return { extension, page, repo, queue, history, transclusion };
}

function failConversion() {
  return jest.spyOn(TiptapTransformer, 'fromYdoc').mockImplementation(() => {
    throw new Error('Editor conversion failed');
  });
}

describe('PersistenceExtension document storage', () => {
  let doc: Document;
  let text: Y.XmlText;
  let payload: onStoreDocumentPayload;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    doc = new Document(documentName);
    const paragraph = new Y.XmlElement('paragraph');
    text = new Y.XmlText();
    doc.getXmlFragment('default').insert(0, [paragraph]);
    paragraph.insert(0, [text]);
    text.insert(0, 'Latest edit');
    payload = {
      document: doc,
      documentName,
      instance: new Hocuspocus(),
      lastContext: { user: { id: 'editor' } },
    } as onStoreDocumentPayload;
  });

  afterEach(() => {
    doc.destroy();
    jest.restoreAllMocks();
  });

  it('restores the latest Yjs edit while keeping the last good editor content', async () => {
    const { extension, page, queue, history, transclusion } = setup();
    const broadcast = jest.spyOn(doc, 'broadcastStateless');
    const converter = failConversion();
    await extension.onChange({
      documentName,
      context: { user: { id: 'editor' } },
    } as onChangePayload);
    await extension.onStoreDocument(payload);
    expect(page.content).toEqual(previousContent);
    expect(page.textContent).toBe('Published');
    expect(queue.add).not.toHaveBeenCalled();
    expect(history.addContributors).not.toHaveBeenCalled();
    expect(transclusion.syncPageTransclusions).not.toHaveBeenCalled();
    expect(broadcast).not.toHaveBeenCalled();

    const empty = new Document(documentName);
    try {
      const restored = await extension.onLoadDocument({
        document: empty,
        documentName,
      } as onLoadDocumentPayload);
      expect(restored.getXmlFragment('default').toString()).toBe(
        '<paragraph>Latest edit</paragraph>',
      );
      restored.destroy();
    } finally {
      empty.destroy();
    }

    converter.mockRestore();
    await extension.onStoreDocument(payload);
    expect(page.textContent).toBe('Latest edit');
    expect(history.addContributors).toHaveBeenCalledWith(page.id, ['editor']);
    expect(broadcast).toHaveBeenCalledTimes(1);
  });

  it('saves a repair that converts back to the previously published JSON', async () => {
    const { extension, page, queue } = setup();
    const converter = failConversion();
    await extension.onStoreDocument(payload);
    converter.mockRestore();
    text.delete(0, text.length);
    text.insert(0, 'Published');
    await extension.onStoreDocument(payload);

    expect(page.ydoc).toEqual(Buffer.from(Y.encodeStateAsUpdate(doc)));
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('surfaces a failed snapshot write and can retry it', async () => {
    const { extension, repo, page } = setup();
    const error = new Error('Database unavailable');
    repo.saveYdocState.mockRejectedValueOnce(error);
    failConversion();
    await expect(extension.onStoreDocument(payload)).rejects.toBe(error);
    expect(page.ydoc).toBeNull();
    await extension.onStoreDocument(payload);
    expect(page.ydoc).toEqual(Buffer.from(Y.encodeStateAsUpdate(doc)));
  });

  it.each([
    { kind: 'page', unloadImmediately: true },
    { kind: 'snapshot', unloadImmediately: false },
  ])(
    'keeps the last edit and retries a failed $kind write after the last connection closes',
    async ({ kind, unloadImmediately }) => {
      jest.useFakeTimers();
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const { extension, repo, page } = setup();
      const server = new Hocuspocus({ debounce: 1000, extensions: [extension] });
      try {
        const connection = await server.openDirectConnection(documentName, {
          user: { id: 'editor' },
        });
        await connection.transact((document) => {
          const paragraph = document.getXmlFragment('default').get(0) as Y.XmlElement;
          (paragraph.get(0) as Y.XmlText).insert(0, 'Last edit: ');
        });
        const expected = Buffer.from(Y.encodeStateAsUpdate(connection.document!));
        const error = new Error('Temporary database outage');
        if (kind === 'snapshot') {
          failConversion();
          repo.saveYdocState.mockRejectedValueOnce(error);
        } else {
          repo.updatePage.mockRejectedValueOnce(error);
        }

        await connection.disconnect({ unloadImmediately });
        if (!unloadImmediately) await jest.advanceTimersByTimeAsync(1000);
        expect(page.ydoc).toBeNull();
        expect(server.getDocumentsCount()).toBe(1);

        if (unloadImmediately) {
          await jest.advanceTimersByTimeAsync(1001);
        } else {
          server.flushPendingStores();
          await jest.advanceTimersByTimeAsync(1);
        }
        expect(page.ydoc).toEqual(expected);
        expect(server.getDocumentsCount()).toBe(0);
      } finally {
        for (const document of server.documents.values()) document.destroy();
        jest.useRealTimers();
      }
    },
  );

  it('credits the latest editor when a newer save waits behind a failed write', async () => {
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { extension, repo } = setup();
    const server = new Hocuspocus({ debounce: 1000, extensions: [extension] });
    const outage = new Error('Temporary database outage');
    let failFirstWrite: (error: Error) => void;
    repo.updatePage
      .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => {
        failFirstWrite = reject;
      }))
      .mockRejectedValueOnce(outage);
    try {
      for (const id of ['alice', 'bob']) {
        const connection = await server.openDirectConnection(documentName, { user: { id } });
        await connection.transact((document) => {
          const paragraph = document.getXmlFragment('default').get(0) as Y.XmlElement;
          const text = paragraph.get(0) as Y.XmlText;
          text.insert(text.length, ' ' + id);
        });
        await jest.advanceTimersByTimeAsync(1000);
      }
      expect(repo.updatePage).toHaveBeenCalledTimes(1);

      failFirstWrite(outage);
      await jest.advanceTimersByTimeAsync(1001);

      expect(repo.updatePage).toHaveBeenCalledTimes(3);
      expect(repo.updatePage.mock.lastCall[0]).toMatchObject({
        textContent: 'Published alice bob',
        lastUpdatedById: 'bob',
        contributorIds: expect.arrayContaining(['alice', 'bob']),
      });
    } finally {
      for (const document of server.documents.values()) document.destroy();
      jest.useRealTimers();
    }
  });

  it('reports a database failure when saving a repaired document', async () => {
    const { extension, repo } = setup();
    const converter = failConversion();
    await extension.onStoreDocument(payload);
    converter.mockRestore();
    text.delete(0, text.length);
    text.insert(0, 'Published');
    const error = new Error('Database unavailable');
    repo.saveYdocState.mockRejectedValueOnce(error);
    await expect(extension.onStoreDocument(payload)).rejects.toBe(error);
  });
});
