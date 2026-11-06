import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';
import { CollaborationHandler } from './collaboration.handler';
import { jsonToNode, tiptapExtensions } from './collaboration.util';
import { computeBlockRefs } from './block-edit/block-refs';

const paragraph = (text: string) => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});

describe('CollaborationHandler applyBlockEdits', () => {
  it('points to adding content when the live document cannot be edited safely', async () => {
    const ydoc = TiptapTransformer.toYdoc(
      { type: 'doc', content: [paragraph('one'), paragraph('two')] },
      'default',
      tiptapExtensions,
    );
    // the planner strips the unknown node, so its view no longer matches the live document
    const unknown = new Y.XmlElement('unknownNode');
    unknown.insert(0, [
      new Y.XmlElement('paragraph'),
      new Y.XmlElement('paragraph'),
    ]);
    ydoc.getXmlFragment('default').insert(0, [unknown]);
    const view = jsonToNode(TiptapTransformer.fromYdoc(ydoc, 'default'));
    const lastRef = [...computeBlockRefs(view).byRef.values()].pop().ref;
    const hocuspocus = {
      openDirectConnection: async () => ({
        transact: async (fn: (doc: Y.Doc) => void) => fn(ydoc),
        disconnect: async () => undefined,
      }),
    };

    const result = await new CollaborationHandler()
      .getHandlers(hocuspocus as any)
      .applyBlockEdits('page.one', {
        edits: [{ type: 'delete', ref: lastRef }],
        user: {} as any,
      });

    expect(result).toEqual({
      ok: false,
      error:
        'This part of the page contains content that cannot be edited safely. Read the page again, or add content with update_page append or prepend.',
    });
  });
});
