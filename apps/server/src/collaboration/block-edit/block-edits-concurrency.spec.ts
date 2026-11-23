import { TiptapTransformer } from '@hocuspocus/transformer';
import type { JSONContent } from '@tiptap/core';
import * as Y from 'yjs';
import { tiptapExtensions } from '../collaboration.util';
import { applyBlockSplices, planBlockEdits } from './block-edits';
import type { BlockEdit } from './block-edits.types';
import { editableDocument, pageRevision } from './block-refs';

const text = (value: string, marks?: JSONContent['marks']) => ({
  type: 'text',
  text: value,
  ...(marks && { marks }),
});
const paragraph = (...content: JSONContent[]) => ({
  type: 'paragraph',
  content,
});
const marked = (word = 'old') =>
  paragraph(text('Left '), text(word, [{ type: 'bold' }]), text(' right'));
const read = (doc: Y.Doc) =>
  editableDocument(TiptapTransformer.fromYdoc(doc, 'default'));
function replica(base: Uint8Array) {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, base);
  return doc;
}

const cases: { name: string; edit: BlockEdit; accepted: boolean }[] = [
  {
    name: 'adjacent move',
    edit: { type: 'move_before', ref: 'b1', targetRef: 'b2' },
    accepted: true,
  },
  {
    name: 'nonadjacent move',
    edit: { type: 'move_after', ref: 'b1', targetRef: 'b3' },
    accepted: false,
  },
  {
    name: 'exact text',
    edit: { type: 'replace_text', ref: 'b1', oldText: 'old', newText: 'new' },
    accepted: true,
  },
  {
    name: 'HTML wording change',
    edit: { type: 'replace', ref: 'b1', content: [marked('new')] },
    accepted: true,
  },
  {
    name: 'HTML formatting change',
    edit: {
      type: 'replace',
      ref: 'b1',
      content: [paragraph(text('Left old right', [{ type: 'italic' }]))],
    },
    accepted: true,
  },
  {
    name: 'HTML alignment change',
    edit: {
      type: 'replace',
      ref: 'b1',
      content: [{ ...marked(), attrs: { textAlign: 'center' } }],
    },
    accepted: true,
  },
  {
    name: 'HTML retype',
    edit: {
      type: 'replace',
      ref: 'b1',
      content: [{ ...marked(), type: 'heading', attrs: { level: 2 } }],
    },
    accepted: false,
  },
  {
    name: 'unmapped rich overwrite',
    edit: {
      type: 'replace',
      ref: 'b1',
      content: [paragraph(text('Entirely different', [{ type: 'italic' }]))],
    },
    accepted: false,
  },
  {
    name: 'unanchored block reordering',
    edit: {
      type: 'replace_document',
      ref: '',
      content: [paragraph(text('two')), marked(), paragraph(text('three'))],
    },
    accepted: false,
  },
];

it.each(cases)(
  'preserves withheld peer typing for $name in both delivery orders',
  ({ edit, accepted }) => {
    const initial = TiptapTransformer.toYdoc(
      {
        type: 'doc',
        content: [marked(), paragraph(text('two')), paragraph(text('three'))],
      },
      'default',
      tiptapExtensions,
    );
    const base = Y.encodeStateAsUpdate(initial);
    const clock = Y.encodeStateVector(initial);
    const revision = pageRevision(read(initial));
    for (const delivered of [true, false]) {
      const server = replica(base),
        peer = replica(base);
      const first = peer.getXmlFragment('default').get(0) as Y.XmlElement;
      (first.get(0) as Y.XmlText).insert(6, '[peer]');
      const peerUpdate = Y.encodeStateAsUpdate(peer, clock);
      if (delivered) Y.applyUpdate(server, peerUpdate);
      const before = Y.encodeStateAsUpdate(server);
      server.transact(() => {
        const plan = planBlockEdits(read(server), [edit], revision);
        expect(plan.ok).toBe(!delivered && accepted);
        if (plan.ok) {
          expect(
            applyBlockSplices(server.getXmlFragment('default'), plan.splices),
          ).toBe(true);
          expect(read(server).toJSON()).toEqual(plan.doc.toJSON());
        } else {
          expect(plan).toMatchObject({
            error: expect.stringMatching(
              delivered ? /page changed/i : /detach/,
            ),
          });
          expect(Y.encodeStateAsUpdate(server)).toEqual(before);
        }
      });
      const serverUpdate = Y.encodeStateAsUpdate(server, clock);
      const a = replica(base),
        b = replica(base);
      Y.applyUpdate(a, serverUpdate);
      Y.applyUpdate(a, peerUpdate);
      Y.applyUpdate(b, peerUpdate);
      Y.applyUpdate(b, serverUpdate);
      expect(read(a).toJSON()).toEqual(read(b).toJSON());
      expect(read(a).child(0).textContent).toContain('[peer]');
      for (const doc of [server, peer, a, b]) doc.destroy();
    }
    initial.destroy();
  },
);
