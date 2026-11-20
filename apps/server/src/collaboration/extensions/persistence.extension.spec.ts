import {
  Document,
  type onChangePayload,
  type onLoadDocumentPayload,
  type onStoreDocumentPayload,
} from '@hocuspocus/server';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { Logger } from '@nestjs/common';
import * as Y from 'yjs';
import { PersistenceExtension } from './persistence.extension';

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
