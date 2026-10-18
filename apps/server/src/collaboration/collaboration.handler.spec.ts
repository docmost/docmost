import * as Y from 'yjs';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { ResetConnection } from '@hocuspocus/common';
import { CollaborationHandler } from './collaboration.handler';
import { tiptapExtensions } from './collaboration.util';
import { buildApprovalState } from '../core/page/approval/page-approval.utils';
import { ApprovalState } from '../core/page/approval/page-approval.types';

const PAGE_ID = '01a14cce-0000-7000-8000-0000000000c1';
const DOC_NAME = `page.${PAGE_ID}`;
const READ_ACCESS = JSON.stringify({ type: 'page.permissions', access: 'read' });

const IN_REVIEW = buildApprovalState({
  isBase: false,
  verificationId: 'verification_1',
  verificationType: 'qms',
  verificationStatus: 'in_approval',
  readerVersionId: 'history_1',
});

function paragraphDoc(text: string) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

function makeConnection() {
  return { readOnly: false, sendStateless: jest.fn(), close: jest.fn() };
}

function makeHocuspocus(doc: Y.Doc, connections: any[] = []) {
  const directConnection = {
    transact: jest.fn(async (fn: (d: Y.Doc) => void) => {
      doc.transact(() => fn(doc));
    }),
    disconnect: jest.fn(async () => undefined),
  };
  const hocuspocus = {
    openDirectConnection: jest.fn(async () => directConnection),
    documents: new Map([[DOC_NAME, { getConnections: () => connections }]]),
  };
  return { hocuspocus, directConnection };
}

function makeHandler(state: ApprovalState) {
  const pageRepo = {
    findById: jest.fn(async (id: string) => ({
      id,
      spaceId: 'space_1',
      isBase: false,
    })),
  };
  const pageApprovalService = { getState: jest.fn(async () => state) };
  const handler = new CollaborationHandler(
    pageRepo as any,
    pageApprovalService as any,
  );
  return { handler, pageRepo, pageApprovalService };
}

describe('CollaborationHandler', () => {
  const user = { id: 'user_1' } as any;

  it('updatePageContent throws when the page is locked', async () => {
    const { handler } = makeHandler(IN_REVIEW);
    const doc = TiptapTransformer.toYdoc(
      paragraphDoc('frozen'),
      'default',
      tiptapExtensions,
    );
    const { hocuspocus } = makeHocuspocus(doc);
    const handlers = handler.getHandlers(hocuspocus as any);

    await expect(
      handlers.updatePageContent(DOC_NAME, {
        prosemirrorJson: paragraphDoc('extra'),
        operation: 'append',
        user,
      }),
    ).rejects.toThrow('Page is locked for approval');
    expect(hocuspocus.openDirectConnection).not.toHaveBeenCalled();
  });

  it('updatePageContent with force ignores the lock', async () => {
    const { handler } = makeHandler(IN_REVIEW);
    const doc = TiptapTransformer.toYdoc(
      paragraphDoc('draft'),
      'default',
      tiptapExtensions,
    );
    const { hocuspocus, directConnection } = makeHocuspocus(doc);
    const handlers = handler.getHandlers(hocuspocus as any);

    await handlers.updatePageContent(DOC_NAME, {
      prosemirrorJson: paragraphDoc('approved'),
      operation: 'replace',
      user,
      force: true,
    });

    expect(hocuspocus.openDirectConnection).toHaveBeenCalledWith(DOC_NAME, {
      user,
    });
    expect(directConnection.disconnect).toHaveBeenCalled();
    const text = JSON.stringify(TiptapTransformer.fromYdoc(doc, 'default'));
    expect(text).toContain('approved');
    expect(text).not.toContain('"draft"');
  });

  it('updatePageContent writes to an unlocked page', async () => {
    const { handler, pageApprovalService } = makeHandler(
      buildApprovalState({ isBase: false }),
    );
    const doc = TiptapTransformer.toYdoc(
      paragraphDoc('first'),
      'default',
      tiptapExtensions,
    );
    const { hocuspocus } = makeHocuspocus(doc);

    await handler.getHandlers(hocuspocus as any).updatePageContent(DOC_NAME, {
      prosemirrorJson: paragraphDoc('second'),
      operation: 'append',
      user,
    });

    expect(pageApprovalService.getState).toHaveBeenCalledWith(
      expect.objectContaining({ id: PAGE_ID }),
    );
    expect(JSON.stringify(TiptapTransformer.fromYdoc(doc, 'default'))).toContain(
      'second',
    );
  });

  it('freezeDraft marks websocket connections read-only and returns the document JSON', async () => {
    const { handler } = makeHandler(IN_REVIEW);
    const doc = TiptapTransformer.toYdoc(
      paragraphDoc('submitted draft'),
      'default',
      tiptapExtensions,
    );
    const connections = [makeConnection(), makeConnection()];
    const { hocuspocus, directConnection } = makeHocuspocus(doc, connections);
    let readOnlyBeforeRead = false;
    directConnection.transact.mockImplementation(async (fn) => {
      readOnlyBeforeRead = connections.every((c) => c.readOnly);
      fn(doc);
    });

    const json = await handler.getHandlers(hocuspocus as any).freezeDraft(
      DOC_NAME,
    );

    expect(json).toEqual(TiptapTransformer.fromYdoc(doc, 'default'));
    expect(readOnlyBeforeRead).toBe(true);
    for (const connection of connections) {
      expect(connection.readOnly).toBe(true);
      expect(connection.sendStateless).toHaveBeenCalledWith(READ_ACCESS);
      expect(connection.close).not.toHaveBeenCalled();
    }
    expect(hocuspocus.openDirectConnection).toHaveBeenCalledWith(DOC_NAME, {});
    expect(directConnection.disconnect).toHaveBeenCalled();
  });

  it('resetConnections closes every connection of the open document', async () => {
    const { handler } = makeHandler(IN_REVIEW);
    const connections = [makeConnection(), makeConnection()];
    const { hocuspocus } = makeHocuspocus(new Y.Doc(), connections);

    await handler.getHandlers(hocuspocus as any).resetConnections(DOC_NAME);

    for (const connection of connections) {
      expect(connection.close).toHaveBeenCalledWith(ResetConnection);
    }
    expect(hocuspocus.openDirectConnection).not.toHaveBeenCalled();
  });

  it('resetConnections does nothing when the document is not open', async () => {
    const { handler } = makeHandler(IN_REVIEW);
    const { hocuspocus } = makeHocuspocus(new Y.Doc());

    await expect(
      handler
        .getHandlers(hocuspocus as any)
        .resetConnections('page.01a14cce-0000-7000-8000-0000000000c2'),
    ).resolves.toBeUndefined();
    expect(hocuspocus.openDirectConnection).not.toHaveBeenCalled();
  });
});
