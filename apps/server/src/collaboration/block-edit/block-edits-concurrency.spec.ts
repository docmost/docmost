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

function cellContent(doc: Y.Doc, column: number) {
  const table = doc.getXmlFragment('default').get(0) as Y.XmlElement;
  const row = table.get(0) as Y.XmlElement;
  const cell = row.get(column) as Y.XmlElement;
  return (cell.get(0) as Y.XmlElement).get(0);
}

it('merges an icon edit with offline typing and a callout style change in either delivery order', () => {
  const original = TiptapTransformer.toYdoc(
    {
      type: 'doc',
      content: [
        { type: 'callout', attrs: { type: 'note' }, content: [marked()] },
      ],
    },
    'default',
    tiptapExtensions,
  );
  const base = Y.encodeStateAsUpdate(original);
  const clock = Y.encodeStateVector(original);
  const server = replica(base);
  const peer = replica(base);
  const peerCallout = peer.getXmlFragment('default').get(0) as Y.XmlElement;
  const peerText = (peerCallout.get(0) as Y.XmlElement).get(0) as Y.XmlText;
  peer.transact(() => {
    peerCallout.setAttribute('type', 'warning');
    peerText.insert(0, 'Peer ');
  });
  const before = read(server);
  const fragment = server.getXmlFragment('default');
  const note = fragment.get(0) as Y.XmlElement;
  const child = note.get(0);
  const plan = planBlockEdits(
    before,
    [{ type: 'set_attrs', ref: 'b1', attrs: { icon: '👩🏽‍💻', type: 'note' } }],
    pageRevision(before),
  );
  if (plan.ok === false) throw new Error(plan.error);
  expect(plan.splices).toEqual([
    expect.objectContaining({ attributes: { icon: '👩🏽‍💻' } }),
  ]);
  server.transact(() =>
    expect(applyBlockSplices(fragment, plan.splices)).toBe(true),
  );
  expect(fragment.get(0)).toBe(note);
  expect(note.get(0)).toBe(child);
  const updates = [server, peer].map((doc) =>
    Y.encodeStateAsUpdate(doc, clock),
  );
  for (const order of [updates, [...updates].reverse()]) {
    const merged = replica(base);
    order.forEach((update) => Y.applyUpdate(merged, update));
    const final = read(merged).firstChild;
    expect(final.attrs).toMatchObject({ type: 'warning', icon: '👩🏽‍💻' });
    expect(final.content.toJSON()).toEqual(
      read(peer).firstChild.content.toJSON(),
    );
    expect(final.textContent).toBe('Peer Left old right');
    merged.destroy();
  }
  for (const doc of [original, server, peer]) doc.destroy();
});

const cases: { name: string; edit: BlockEdit; accepted: boolean }[] = [
  {
    name: 'adjacent move',
    edit: { type: 'move_before', ref: 'b1', targetRef: 'b2' },
    accepted: true,
  },
  {
    name: 'move of another block',
    edit: { type: 'move_after', ref: 'b2', targetRef: 'b3' },
    accepted: true,
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
    name: 'native alignment change',
    edit: { type: 'set_attrs', ref: 'b1', attrs: { textAlign: 'right' } },
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

it('merges withheld peer edits to the same badge color, cell formatting and neighboring text', () => {
  const cell = (content: JSONContent) => ({
    type: 'tableCell',
    content: [paragraph(content)],
  });
  const initial = TiptapTransformer.toYdoc(
    {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                cell(text('Desk 1')),
                cell({
                  type: 'status',
                  attrs: { text: 'Open', color: 'blue' },
                }),
                cell(text('Note')),
              ],
            },
          ],
        },
      ],
    },
    'default',
    tiptapExtensions,
  );
  const base = Y.encodeStateAsUpdate(initial);
  const clock = Y.encodeStateVector(initial);
  const server = replica(base),
    peer = replica(base);
  peer.transact(() => {
    (cellContent(peer, 0) as Y.XmlText).format(0, 4, { bold: {} });
    (cellContent(peer, 1) as Y.XmlElement).setAttribute('color', 'green');
    (cellContent(peer, 2) as Y.XmlText).insert(4, ' from peer');
  });
  const peerUpdate = Y.encodeStateAsUpdate(peer, clock);
  const edit: BlockEdit = {
    type: 'update_cells',
    ref: 'b2',
    changes: [
      { column: 1, oldValue: 'Desk 1', newValue: 'Desk 2' },
      { column: 2, oldValue: 'Open', newValue: 'Done' },
    ],
  };
  const revision = pageRevision(read(initial));
  expect(planBlockEdits(read(peer), [edit], revision)).toMatchObject({
    ok: false,
    error: expect.stringMatching(/changed/),
  });
  server.transact(() => {
    const plan = planBlockEdits(read(server), [edit], revision);
    if (plan.ok === false) throw new Error(plan.error);
    expect(
      applyBlockSplices(server.getXmlFragment('default'), plan.splices),
    ).toBe(true);
  });
  const serverUpdate = Y.encodeStateAsUpdate(server, clock);
  const a = replica(base),
    b = replica(base);
  Y.applyUpdate(a, serverUpdate);
  Y.applyUpdate(a, peerUpdate);
  Y.applyUpdate(b, peerUpdate);
  Y.applyUpdate(b, serverUpdate);
  expect(read(a).toJSON()).toEqual(read(b).toJSON());
  const row = read(a).firstChild.firstChild;
  expect(row.child(0).textContent).toBe('Desk 2');
  expect(row.child(0).firstChild.firstChild.toJSON()).toEqual(
    text('Desk', [{ type: 'bold' }]),
  );
  expect(row.child(1).firstChild.firstChild.attrs).toMatchObject({
    text: 'Done',
    color: 'green',
  });
  expect(row.child(2).textContent).toBe('Note from peer');
  for (const doc of [initial, server, peer, a, b]) doc.destroy();
});

it.each(['replace', 'update_cells'] as const)(
  '%s merges a badge recolor with a peer rename and comment-marked typing in both delivery orders',
  (type) => {
    const comment = {
      type: 'comment',
      attrs: { commentId: 'c1', resolved: false },
    };
    const row = (color: string) => ({
      type: 'tableRow',
      content: [
        {
          type: 'tableCell',
          content: [
            paragraph({ type: 'status', attrs: { text: 'Ready', color } }),
          ],
        },
        { type: 'tableCell', content: [paragraph(text('Note', [comment]))] },
      ],
    });
    const initial = TiptapTransformer.toYdoc(
      { type: 'doc', content: [{ type: 'table', content: [row('green')] }] },
      'default',
      tiptapExtensions,
    );
    const base = Y.encodeStateAsUpdate(initial);
    const clock = Y.encodeStateVector(initial);
    const server = replica(base),
      peer = replica(base);
    const badge = cellContent(server, 0) as Y.XmlElement;
    const note = cellContent(peer, 1) as Y.XmlText;
    const written: string[] = [];
    badge.observe((event) => written.push(...event.attributesChanged));
    peer.transact(() => {
      (cellContent(peer, 0) as Y.XmlElement).setAttribute('text', 'Finished');
      note.insert(4, ' added');
    });
    const change = {
      column: 1,
      oldValue: 'Ready',
      newValue: 'Ready',
      color: 'yellow' as const,
    };
    const edit: BlockEdit =
      type === 'replace'
        ? { type, ref: 'b2', content: [row('yellow')] }
        : { type, ref: 'b2', changes: [change] };
    const revision = pageRevision(read(initial));
    expect(planBlockEdits(read(peer), [edit], revision)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/changed/),
    });
    server.transact(() => {
      const plan = planBlockEdits(read(server), [edit], revision);
      if (plan.ok === false) throw new Error(plan.error);
      expect(
        applyBlockSplices(server.getXmlFragment('default'), plan.splices),
      ).toBe(true);
      expect(cellContent(server, 0)).toBe(badge);
      expect(badge.getAttribute('color')).toBe('yellow');
    });
    expect(written).toEqual(['color']);
    const serverUpdate = Y.encodeStateAsUpdate(server, clock);
    const peerUpdate = Y.encodeStateAsUpdate(peer, clock);
    for (const updates of [
      [serverUpdate, peerUpdate],
      [peerUpdate, serverUpdate],
    ]) {
      const merged = replica(base);
      const originalBadge = cellContent(merged, 0);
      const originalNote = cellContent(merged, 1);
      for (const update of updates) Y.applyUpdate(merged, update);
      expect(cellContent(merged, 0)).toBe(originalBadge);
      expect(cellContent(merged, 1)).toBe(originalNote);
      const result = read(merged).firstChild.firstChild;
      expect(result.child(0).firstChild.firstChild.attrs).toMatchObject({
        text: 'Finished',
        color: 'yellow',
      });
      expect(result.child(1).firstChild.firstChild.toJSON()).toEqual(
        text('Note added', [comment]),
      );
      merged.destroy();
    }
    for (const doc of [initial, server, peer]) doc.destroy();
  },
);
