import type { JSONContent } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';
import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';
import { jsonToNode, tiptapExtensions } from '../collaboration.util';
import { computeBlockRefs } from './block-refs';
import { applyBlockSplices, planBlockEdits } from './block-edits';
import type { BlockEdit, BlockEditPlan } from './block-edits.types';

const text = (value: string, marks?: JSONContent['marks']): JSONContent =>
  marks ? { type: 'text', text: value, marks } : { type: 'text', text: value };
const paragraph = (value: string): JSONContent => ({
  type: 'paragraph',
  content: [text(value)],
});
const listItem = (value: string): JSONContent => ({
  type: 'listItem',
  content: [paragraph(value)],
});
const bulletList = (...items: string[]): JSONContent => ({
  type: 'bulletList',
  content: items.map(listItem),
});
const doc = (...content: JSONContent[]): JSONContent => ({
  type: 'doc',
  content,
});

const yParagraph = (value: string) => {
  const element = new Y.XmlElement('paragraph');
  element.insert(0, [new Y.XmlText(value)]);
  return element;
};

const textsOf = (node: Node) => {
  const texts: string[] = [];
  node.forEach((child) => texts.push(child.textContent));
  return texts;
};

function livePage(json: JSONContent) {
  const ydoc = TiptapTransformer.toYdoc(json, 'default', tiptapExtensions);
  const fragment = ydoc.getXmlFragment('default');
  const read = () => jsonToNode(TiptapTransformer.fromYdoc(ydoc, 'default'));
  const refAt = (...path: number[]) =>
    [...computeBlockRefs(read()).byRef.values()].find(
      (entry) => entry.path.join() === path.join(),
    )?.ref;
  const state = () => Y.encodeStateAsUpdate(ydoc);

  const edit = (edits: BlockEdit[]) => {
    let plan: BlockEditPlan;
    let applied = false;
    ydoc.transact(() => {
      plan = planBlockEdits(read(), edits);
      if (plan.ok) applied = applyBlockSplices(fragment, plan.splices);
    });
    if (plan.ok) {
      expect(applied).toBe(true);
      expect(read().toJSON()).toEqual(plan.doc.toJSON());
    }
    return plan;
  };

  return { fragment, read, refAt, state, edit };
}

describe('block edits', () => {
  it('replaces one block and leaves the rest untouched', () => {
    const page = livePage(
      doc(paragraph('one'), paragraph('two'), paragraph('three')),
    );
    const before = page.read();

    const plan = page.edit([
      { type: 'replace', ref: page.refAt(1), content: [paragraph('TWO')] },
    ]);

    expect(plan.ok).toBe(true);
    const after = page.read();
    expect(textsOf(after)).toEqual(['one', 'TWO', 'three']);
    expect(after.child(0).toJSON()).toEqual(before.child(0).toJSON());
    expect(after.child(2).toJSON()).toEqual(before.child(2).toJSON());
  });

  it('replaces a range of sibling blocks', () => {
    const page = livePage(
      doc(paragraph('a'), paragraph('b'), paragraph('c'), paragraph('d')),
    );

    const plan = page.edit([
      {
        type: 'replace',
        ref: page.refAt(1),
        endRef: page.refAt(2),
        content: [paragraph('b and c')],
      },
    ]);

    expect(plan.ok).toBe(true);
    expect(textsOf(page.read())).toEqual(['a', 'b and c', 'd']);
  });

  it('inserts before and after a block', () => {
    const page = livePage(doc(paragraph('a'), paragraph('b')));

    const plan = page.edit([
      {
        type: 'insert_before',
        ref: page.refAt(0),
        content: [paragraph('start')],
      },
      {
        type: 'insert_after',
        ref: page.refAt(0),
        content: [paragraph('after a')],
      },
      {
        type: 'insert_before',
        ref: page.refAt(1),
        content: [paragraph('before b')],
      },
      {
        type: 'insert_after',
        ref: page.refAt(1),
        content: [paragraph('end 1'), paragraph('end 2')],
      },
    ]);

    expect(plan.ok).toBe(true);
    expect(textsOf(page.read())).toEqual([
      'start',
      'a',
      'after a',
      'before b',
      'b',
      'end 1',
      'end 2',
    ]);
  });

  it('deletes a range', () => {
    const page = livePage(
      doc(paragraph('a'), paragraph('b'), paragraph('c'), paragraph('d')),
    );

    const plan = page.edit([
      { type: 'delete', ref: page.refAt(1), endRef: page.refAt(2) },
    ]);

    expect(plan).toMatchObject({ ok: true, insertedRefs: [[]] });
    expect(textsOf(page.read())).toEqual(['a', 'd']);
  });

  it('moves a block after another and keeps its comment mark', () => {
    const comment = {
      type: 'comment',
      attrs: { commentId: 'comment-1', resolved: false },
    };
    const page = livePage(
      doc(
        {
          type: 'paragraph',
          content: [text('plain '), text('noted', [comment])],
        },
        paragraph('two'),
        paragraph('three'),
      ),
    );
    const moved = page.read().child(0).toJSON();

    const plan = page.edit([
      { type: 'move_after', ref: page.refAt(0), targetRef: page.refAt(2) },
    ]);

    expect(plan.ok).toBe(true);
    const after = page.read();
    expect(textsOf(after)).toEqual(['two', 'three', 'plain noted']);
    expect(after.child(2).toJSON()).toEqual(moved);
    expect(after.child(2).child(1).marks.map((mark) => mark.toJSON())).toEqual(
      [comment],
    );
  });

  it('moves blocks across parents', () => {
    const page = livePage(
      doc(
        { type: 'callout', content: [paragraph('c1'), paragraph('c2')] },
        paragraph('p1'),
        paragraph('p2'),
      ),
    );

    const plan = page.edit([
      { type: 'move_after', ref: page.refAt(0, 1), targetRef: page.refAt(1) },
      { type: 'move_after', ref: page.refAt(2), targetRef: page.refAt(0, 0) },
    ]);

    expect(plan.ok).toBe(true);
    const after = page.read();
    expect(after.child(0).type.name).toBe('callout');
    expect(textsOf(after.child(0))).toEqual(['c1', 'p2']);
    expect(textsOf(after)).toEqual(['c1p2', 'p1', 'c2']);
  });

  it('edits a list item inside a list', () => {
    const page = livePage(
      doc(paragraph('intro'), bulletList('one', 'two', 'three')),
    );

    const plan = page.edit([
      { type: 'replace', ref: page.refAt(1, 1), content: [listItem('TWO')] },
      {
        type: 'insert_after',
        ref: page.refAt(1, 2),
        content: [listItem('four')],
      },
    ]);

    expect(plan.ok).toBe(true);
    const list = page.read().child(1);
    expect(list.type.name).toBe('bulletList');
    expect(textsOf(list)).toEqual(['one', 'TWO', 'three', 'four']);
  });

  it('refuses an edit whose ref no longer resolves', () => {
    const page = livePage(doc(paragraph('one'), paragraph('two')));
    const readRef = page.refAt(1);
    const second = page.fragment.get(1) as Y.XmlElement;
    (second.get(0) as Y.XmlText).insert(3, ', edited by someone else');
    const before = page.state();

    const plan = page.edit([
      { type: 'replace', ref: readRef, content: [paragraph('mine')] },
    ]);

    expect(plan).toEqual({
      ok: false,
      error: `Edit 1: block ref "${readRef}" was not found. The page changed since you read it; read it again to get fresh refs.`,
    });
    expect(page.state()).toEqual(before);
  });

  it('refuses overlapping edits', () => {
    const page = livePage(doc(bulletList('one', 'two')));
    const before = page.state();

    const plan = page.edit([
      { type: 'replace', ref: page.refAt(0), content: [paragraph('flat')] },
      { type: 'replace', ref: page.refAt(0, 1), content: [listItem('TWO')] },
    ]);

    expect(plan).toEqual({
      ok: false,
      error: 'Edit 2: it overlaps edit 1; merge them into one edit.',
    });
    expect(page.state()).toEqual(before);
  });

  it('refuses a move into the moved blocks', () => {
    const page = livePage(
      doc({ type: 'callout', content: [paragraph('inside')] }, paragraph('b')),
    );
    const inside = page.refAt(0, 0);

    const plan = page.edit([
      { type: 'move_before', ref: page.refAt(0), targetRef: inside },
    ]);

    expect(plan).toEqual({
      ok: false,
      error: `Edit 1: targetRef "${inside}" is inside the blocks being moved.`,
    });
  });

  it('refuses an endRef before its ref', () => {
    const page = livePage(doc(paragraph('a'), paragraph('b')));
    const [first, second] = [page.refAt(0), page.refAt(1)];

    const plan = page.edit([{ type: 'delete', ref: second, endRef: first }]);

    expect(plan).toEqual({
      ok: false,
      error: `Edit 1: endRef "${first}" must be a later sibling of ref "${second}".`,
    });
  });

  it('ignores targetRef on edits that do not move blocks', () => {
    const page = livePage(doc(paragraph('one'), paragraph('two')));

    const plan = page.edit([
      {
        type: 'replace',
        ref: page.refAt(0),
        targetRef: 'gone00',
        content: [paragraph('ONE')],
      },
    ]);

    expect(plan.ok).toBe(true);
    expect(textsOf(page.read())).toEqual(['ONE', 'two']);
  });

  it('refuses edits when the live document holds a node the schema does not know', () => {
    const page = livePage(doc(paragraph('p1'), paragraph('p2')));
    const unknown = new Y.XmlElement('unknownNode');
    unknown.insert(0, [yParagraph('c1'), yParagraph('c2')]);
    page.fragment.insert(0, [unknown]);
    const before = page.state();
    const view = page.read();
    expect(textsOf(view)).toEqual(['c1', 'c2', 'p1', 'p2']);

    const plan = planBlockEdits(view, [{ type: 'delete', ref: page.refAt(2) }]);

    expect(plan.ok).toBe(true);
    const splices = plan.ok ? plan.splices : [];
    expect(applyBlockSplices(page.fragment, splices)).toBe(false);
    expect(page.state()).toEqual(before);
  });

  it('refuses content the parent cannot hold', () => {
    const page = livePage(doc(paragraph('one')));
    const before = page.state();

    const plan = page.edit([
      {
        type: 'insert_after',
        ref: page.refAt(0),
        content: [listItem('stray')],
      },
    ]);

    expect(plan).toMatchObject({
      ok: false,
      error: expect.stringMatching(
        /^Edit 1: doc cannot contain that content here \(Invalid content for node doc: .+\)\.$/,
      ),
    });
    expect(page.state()).toEqual(before);
  });

  it('applies every edit or none', () => {
    const page = livePage(doc(paragraph('one'), bulletList('a', 'b')));
    const before = page.state();

    const plan = page.edit([
      { type: 'replace', ref: page.refAt(0), content: [paragraph('ONE')] },
      {
        type: 'insert_after',
        ref: page.refAt(1, 0),
        content: [paragraph('not an item')],
      },
    ]);

    expect(plan).toMatchObject({
      ok: false,
      error: expect.stringMatching(
        /^Edit 2: bulletList cannot contain that content here \(.+\)\.$/,
      ),
    });
    expect(page.state()).toEqual(before);
  });

  it('ignores invalid content outside the edited blocks', () => {
    const page = livePage(
      doc(paragraph('one'), { type: 'bulletList', content: [] }),
    );

    const plan = page.edit([
      { type: 'replace', ref: page.refAt(0), content: [paragraph('ONE')] },
    ]);

    expect(plan.ok).toBe(true);
    expect(textsOf(page.read())).toEqual(['ONE', '']);
  });

  it('returns refs of inserted blocks', () => {
    const page = livePage(doc(paragraph('one'), bulletList('a', 'b')));

    const plan = page.edit([
      {
        type: 'insert_after',
        ref: page.refAt(0),
        content: [paragraph('new 1'), paragraph('new 2')],
      },
      {
        type: 'insert_after',
        ref: page.refAt(1, 0),
        content: [listItem('a2')],
      },
      { type: 'delete', ref: page.refAt(1, 1) },
    ]);

    expect(textsOf(page.read())).toEqual(['one', 'new 1', 'new 2', 'aa2']);
    expect(plan).toEqual(
      expect.objectContaining({
        ok: true,
        insertedRefs: [[page.refAt(1), page.refAt(2)], [page.refAt(3, 1)], []],
      }),
    );
  });

  it('keeps untouched Yjs elements', () => {
    const page = livePage(
      doc(paragraph('a'), paragraph('b'), paragraph('c'), paragraph('d')),
    );
    const [a, b, c] = page.fragment.toArray();

    page.edit([
      { type: 'replace', ref: page.refAt(1), content: [paragraph('B')] },
      { type: 'move_before', ref: page.refAt(3), targetRef: page.refAt(0) },
    ]);

    expect(textsOf(page.read())).toEqual(['d', 'a', 'B', 'c']);
    const after = page.fragment.toArray();
    expect(after[1]).toBe(a);
    expect(after[3]).toBe(c);
    expect(after).not.toContain(b);
  });
});
