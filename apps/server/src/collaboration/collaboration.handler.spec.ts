import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';
import { CollaborationHandler } from './collaboration.handler';
import { tiptapExtensions } from './collaboration.util';
import { editableDocument, pageRevision } from './block-edit/block-refs';
import type { BlockEdit } from './block-edit/block-edits.types';

const paragraph = (text: string) => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});

function liveHandler() {
  const ydoc = TiptapTransformer.toYdoc(
    { type: 'doc', content: [paragraph('one'), paragraph('two')] },
    'default',
    tiptapExtensions,
  );
  const hocuspocus = {
    documents: new Map(),
    openDirectConnection: async () => ({
      transact: async (fn: (doc: Y.Doc) => void) =>
        ydoc.transact(() => fn(ydoc)),
      disconnect: async () => undefined,
    }),
  };
  const handlers = new CollaborationHandler().getHandlers(hocuspocus as any);
  const revision = () =>
    pageRevision(editableDocument(TiptapTransformer.fromYdoc(ydoc, 'default')));
  const edit = (edits: BlockEdit[], expectedRevision?: string) =>
    handlers.applyBlockEdits('page.one', {
      edits,
      user: {} as any,
      expectedRevision,
    });
  const state = () => Y.encodeStateAsUpdate(ydoc);
  return { fragment: ydoc.getXmlFragment('default'), revision, edit, state };
}

describe('CollaborationHandler applyBlockEdits', () => {
  it('refuses any write that lacks the read revision', async () => {
    const page = liveHandler();
    const before = page.state();
    expect(await page.edit([{ type: 'delete', ref: 'b1' }])).toMatchObject({
      ok: false,
      error: expect.stringMatching(/revision/),
    });
    expect(page.state()).toEqual(before);
  });

  it('refuses a write if an unsupported live node would disappear from the planning view', async () => {
    const page = liveHandler();
    const revision = page.revision();
    const unknown = new Y.XmlElement('unknownNode');
    unknown.insert(0, [new Y.XmlElement('paragraph')]);
    page.fragment.insert(0, [unknown]);
    const before = page.state();
    expect(
      await page.edit(
        [{ type: 'replace_document', ref: '', content: [paragraph('new')] }],
        revision,
      ),
    ).toMatchObject({
      ok: false,
      error: expect.stringMatching(/Unsupported node/),
    });
    expect(page.state()).toEqual(before);
  });

  it('refuses an unrecognized non-null live attribute before any mutation', async () => {
    const page = liveHandler();
    const revision = page.revision();
    (page.fragment.get(0) as Y.XmlElement).setAttribute('futureData', 'value');
    const before = page.state();
    expect(
      await page.edit(
        [
          {
            type: 'replace_text',
            ref: 'b2',
            oldText: 'two',
            newText: 'edited',
          },
        ],
        revision,
      ),
    ).toMatchObject({
      ok: false,
      error: expect.stringMatching(/Unsupported attribute/),
    });
    expect(page.state()).toEqual(before);
  });

  it.each<BlockEdit>([
    {
      type: 'replace_document',
      ref: '',
      content: [paragraph('one by another editor'), paragraph('replacement')],
    },
    { type: 'append_document', ref: '', content: [paragraph('extra')] },
    { type: 'prepend_document', ref: '', content: [paragraph('extra')] },
    { type: 'replace_text', ref: 'b2', oldText: 'two', newText: 'ours' },
    { type: 'delete', ref: 'b2' },
  ])(
    'checks the live revision before applying a prepared $type',
    async (edit) => {
      const page = liveHandler();
      const revision = page.revision();
      // Change an unrelated block after the tool has prepared its operation.
      const text = (page.fragment.get(0) as Y.XmlElement).get(0) as Y.XmlText;
      text.insert(3, ' by another editor');
      const before = page.state();
      expect(await page.edit([edit], revision)).toMatchObject({
        ok: false,
        error: expect.stringMatching(/page changed/i),
      });
      expect(page.state()).toEqual(before);
      expect(await page.edit([edit], page.revision())).toMatchObject({
        ok: true,
      });
    },
  );
});
