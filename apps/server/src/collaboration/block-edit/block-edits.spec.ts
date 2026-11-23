import type { JSONContent } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';
import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';
import { jsonToNode, tiptapExtensions } from '../collaboration.util';
import { computeBlockRefs, pageRevision } from './block-refs';
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

  const edit = (
    edits: BlockEdit[],
    expectedRevision = pageRevision(read()),
  ) => {
    let plan: BlockEditPlan;
    let applied = false;
    ydoc.transact(() => {
      plan = planBlockEdits(read(), edits, expectedRevision);
      if (plan.ok) applied = applyBlockSplices(fragment, plan.splices);
    });
    if (plan.ok) {
      expect(applied).toBe(true);
      expect(read().toJSON()).toEqual(plan.doc.toJSON());
    }
    return plan;
  };

  return { ydoc, fragment, read, refAt, state, edit };
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

  it('refuses an implicit deletion in a range replacement', () => {
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

    expect(plan).toMatchObject({
      ok: false,
      error: expect.stringMatching(/detach/),
    });
    expect(textsOf(page.read())).toEqual(['a', 'b', 'c', 'd']);
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

  it('preserves the original block, comment and range when a nonadjacent move is refused', () => {
    const comment = {
      type: 'comment',
      attrs: { commentId: 'comment-1', resolved: false },
    };
    const page = livePage(
      doc(
        { type: 'paragraph', content: [text('noted', [comment])] },
        paragraph('two'),
        paragraph('three'),
      ),
    );
    const before = page.state();
    const plan = page.edit([
      { type: 'move_after', ref: 'b1', targetRef: 'b3' },
    ]);
    expect(plan).toMatchObject({
      ok: false,
      error: expect.stringMatching(/detach/),
    });
    expect(page.state()).toEqual(before);
    expect(page.read().child(0).child(0).marks[0].toJSON()).toEqual(comment);
  });

  it('refuses moves across parents before applying any other edit', () => {
    const page = livePage(
      doc(
        { type: 'callout', content: [paragraph('inside')] },
        paragraph('outside'),
      ),
    );
    const before = page.state();
    const plan = page.edit([
      { type: 'insert_after', ref: 'b3', content: [paragraph('unused')] },
      { type: 'move_after', ref: 'b2', targetRef: 'b3' },
    ]);
    expect(plan).toMatchObject({
      ok: false,
      error: expect.stringMatching(/move/),
    });
    expect(page.state()).toEqual(before);
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

  it('refuses a stale revision even when the positional ref still resolves', () => {
    const page = livePage(doc(paragraph('one'), paragraph('two')));
    const readRef = page.refAt(1);
    const revision = pageRevision(page.read());
    const second = page.fragment.get(1) as Y.XmlElement;
    (second.get(0) as Y.XmlText).insert(3, ', edited by someone else');
    const before = page.state();

    const plan = page.edit(
      [{ type: 'replace', ref: readRef, content: [paragraph('mine')] }],
      revision,
    );

    expect(plan).toEqual({
      ok: false,
      error: expect.stringMatching(/page changed.*read.*again/i),
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
      {
        type: 'insert_before',
        ref: page.refAt(0),
        content: [paragraph('start')],
      },
    ]);

    expect(textsOf(page.read())).toEqual(['start', 'a', 'B', 'c', 'd']);
    const after = page.fragment.toArray();
    expect(after[1]).toBe(a);
    expect(after[3]).toBe(c);
    expect(after[2]).toBe(b);
  });
});

describe('targeted table cell edits', () => {
  const cell = (...content: JSONContent[]): JSONContent => ({
    type: 'tableCell',
    content: [{ type: 'paragraph', content }],
  });
  const table = (...cells: JSONContent[]) => ({
    type: 'table',
    content: [{ type: 'tableRow', content: cells }],
  });
  const badge = { type: 'status', attrs: { text: 'Draft', color: 'blue' } };
  const update = (...changes: BlockEdit['changes']): BlockEdit => ({
    type: 'update_cells',
    ref: 'b2',
    changes,
  });
  const owner = { column: 2, oldValue: 'Sam', newValue: 'Lin' };
  const office = { column: 3, oldValue: 'Floor 2', newValue: 'Floor 4' };
  const status = { column: 4, oldValue: 'Draft', newValue: 'Approved' };

  it('recolors both submitted rows without detaching their native badges', () => {
    const row = (name: string, color: string) => ({
      type: 'tableRow',
      content: [
        cell(text(name, [{ type: 'bold' }])),
        cell({ type: 'status', attrs: { text: 'Draft', color } }),
      ],
    });
    const names = ['First', 'Second'];
    const page = livePage(
      doc({ type: 'table', content: names.map((name) => row(name, 'green')) }),
    );
    const element = page.fragment.get(0) as Y.XmlElement;
    const rows = element.toArray() as Y.XmlElement[];
    const cells = rows.map((row) => row.get(1) as Y.XmlElement);
    const paragraphs = cells.map((cell) => cell.get(0) as Y.XmlElement);
    const badges = paragraphs.map((p) => p.get(0) as Y.XmlElement);
    const originalAttrs = badges.map((badge) => badge.getAttributes());
    expect(
      page.edit(
        names.map((name, i) => ({
          type: 'replace',
          ref: page.refAt(0, i),
          content: [row(name, 'yellow')],
        })),
      ),
    ).toMatchObject({ ok: true, insertedRefs: [['b2'], ['b3']] });
    for (const [i, badge] of badges.entries()) {
      expect(element.get(i)).toBe(rows[i]);
      expect(rows[i].get(1)).toBe(cells[i]);
      expect(cells[i].get(0)).toBe(paragraphs[i]);
      expect(paragraphs[i].get(0)).toBe(badge);
      expect(badge.getAttributes()).toEqual({
        ...originalAttrs[i],
        color: 'yellow',
      });
    }
  });

  it('aligns a changed inline badge after marked text and an unchanged badge', () => {
    const comment = {
      type: 'comment',
      attrs: { commentId: 'a', resolved: false },
    };
    const block = (label: string, color: string) => ({
      type: 'paragraph',
      content: [
        text('Note ', [comment]),
        text('for ', [{ type: 'bold' }]),
        badge,
        text(' and '),
        { type: 'status', attrs: { text: label, color } },
        text(' here', [comment]),
      ],
    });
    const page = livePage(doc(block('Pending', 'green')));
    const paragraph = page.fragment.get(0) as Y.XmlElement;
    const inline = paragraph.toArray();
    expect(
      page.edit([
        { type: 'replace', ref: 'b1', content: [block('Done', 'yellow')] },
      ]),
    ).toMatchObject({ ok: true });
    inline.forEach((node, i) => expect(paragraph.get(i)).toBe(node));
    expect(page.read().firstChild.child(4).attrs).toMatchObject({
      text: 'Done',
      color: 'yellow',
    });
    expect(page.read().firstChild.firstChild.marks[0].toJSON()).toEqual(
      comment,
    );
  });

  it('refuses to infer a badge patch for an inline swap, removal or retype', () => {
    const other = { ...badge, attrs: { ...badge.attrs, color: 'green' } };
    const block = (...content: JSONContent[]) => ({
      type: 'paragraph',
      content,
    });
    const page = livePage(doc(block(badge, other)));
    const original = page.state();
    const changedDirection = {
      ...badge,
      attrs: { ...badge.attrs, dir: 'rtl' },
    };
    for (const content of [
      [other, badge],
      [other],
      [text('Draft'), other],
      [changedDirection, other],
    ]) {
      expect(
        page.edit([
          { type: 'replace', ref: 'b1', content: [block(...content)] },
        ]),
      ).toMatchObject({
        ok: false,
        error: expect.stringMatching(
          /detach.*No edits in this batch were applied/,
        ),
      });
      expect(page.state()).toEqual(original);
    }
  });

  it('returns the requested color for badge updates, including a repeated color', () => {
    const page = livePage(doc(table(cell(badge))));
    const row = (page.fragment.get(0) as Y.XmlElement).get(0) as Y.XmlElement;
    const paragraph = (row.get(0) as Y.XmlElement).get(0) as Y.XmlElement;
    const original = paragraph.get(0) as Y.XmlElement;
    const value = { column: 1, oldValue: 'Draft', newValue: 'Draft' };
    for (const color of [
      'gray',
      'blue',
      'green',
      'yellow',
      'red',
      'purple',
    ] as const) {
      const change = { ...value, color };
      const receipt = [{ rowRef: 'b2', column: 1, value: 'Draft', color }];
      expect(page.edit([update(change)])).toMatchObject({
        ok: true,
        updatedCells: receipt,
      });
      expect(paragraph.get(0)).toBe(original);
      expect(original.getAttributes()).toMatchObject({ text: 'Draft', color });
      const before = page.state();
      expect(page.edit([update(change)])).toMatchObject({
        ok: true,
        updatedCells: receipt,
      });
      expect(page.state()).toEqual(before);
    }
  });

  it('keeps a legacy color through label edits and accepts an explicit palette color', () => {
    const colored = (value: string, color: string) => ({
      type: 'status',
      attrs: { text: value, color },
    });
    const page = livePage(doc(table(cell(colored('Draft', 'orange')))));
    const change = { column: 1, oldValue: 'Draft', newValue: 'Ready' };
    const rename = page.edit([update(change)]);
    if (rename.ok === false) throw new Error(rename.error);
    expect(rename.updatedCells).toEqual([
      { rowRef: 'b2', column: 1, value: 'Ready' },
    ]);
    const row = () => page.read().firstChild.firstChild;
    expect(row().firstChild.firstChild.firstChild.attrs).toMatchObject({
      text: 'Ready',
      color: 'orange',
    });
    const replace = (label: string, color: string): BlockEdit => ({
      type: 'replace',
      ref: 'b2',
      content: [{ type: 'tableRow', content: [cell(colored(label, color))] }],
    });
    expect(page.edit([replace('Revised', 'orange')])).toMatchObject({
      ok: true,
    });
    const before = page.state();
    expect(page.edit([replace('Revised', 'chartreuse')])).toMatchObject({
      ok: false,
    });
    expect(page.state()).toEqual(before);
    const normalize = {
      column: 1,
      oldValue: 'Revised',
      newValue: 'Done',
      color: 'green' as const,
    };
    expect(page.edit([update(normalize)])).toMatchObject({
      ok: true,
      updatedCells: [
        { rowRef: 'b2', column: 1, value: 'Done', color: 'green' },
      ],
    });
    expect(row().firstChild.firstChild.firstChild.attrs).toMatchObject({
      text: 'Done',
      color: 'green',
    });
  });

  it('rejects a bad color, stale label or color on a text or mixed cell before any write', () => {
    const page = livePage(
      doc(table(cell(text('One')), cell(badge), cell(text('Prefix'), badge))),
    );
    const first = { column: 1, oldValue: 'One', newValue: 'Two' };
    const target = {
      column: 2,
      oldValue: 'Draft',
      newValue: 'Draft',
      color: 'yellow' as const,
    };
    const before = page.state();
    for (const change of [
      { ...target, color: 'orange' as never },
      { ...target, color: null },
      { ...target, oldValue: 'Old' },
      { ...target, column: 3 },
    ]) {
      expect(page.edit([update(first, change)])).toMatchObject({ ok: false });
      expect(page.state()).toEqual(before);
    }
    const textColor = { ...first, newValue: 'One', color: 'green' as const };
    expect(page.edit([update(target, textColor)])).toMatchObject({ ok: false });
    expect(page.state()).toEqual(before);
  });

  it.each(['yellow', 'blue'] as const)(
    'preflights the live badge before applying a batch requesting %s',
    (color) => {
      const page = livePage(doc(table(cell(text('One')), cell(badge))));
      const first = { column: 1, oldValue: 'One', newValue: 'Two' };
      const second = {
        column: 2,
        oldValue: 'Draft',
        newValue: 'Draft',
        color,
      };
      const plan = planBlockEdits(page.read(), [update(first, second)]);
      if (plan.ok === false) throw new Error(plan.error);
      const row = (page.fragment.get(0) as Y.XmlElement).get(0) as Y.XmlElement;
      const paragraph = (row.get(1) as Y.XmlElement).get(0) as Y.XmlElement;
      (paragraph.get(0) as Y.XmlElement).setAttribute('color', 'red');
      const before = page.state();
      expect(applyBlockSplices(page.fragment, plan.splices)).toBe(false);
      expect(page.state()).toEqual(before);
    },
  );

  it('edits duplicate text by physical column and changes only the native badge label', () => {
    const comment = {
      type: 'comment',
      attrs: { commentId: 'c1', resolved: false },
    };
    const page = livePage(
      doc(
        table(
          { ...cell(text('Sam')), type: 'tableHeader', attrs: { colspan: 2 } },
          cell(text('Sam', [comment])),
          cell(
            text('Floor ', [{ type: 'bold' }]),
            text('2', [{ type: 'italic' }]),
          ),
          { ...cell(badge), attrs: { backgroundColorName: 'blue' } },
          cell(text('Note '), badge, text(' stays', [{ type: 'bold' }])),
        ),
      ),
    );
    const row = (page.fragment.get(0) as Y.XmlElement).get(0) as Y.XmlElement;
    const cells = row.toArray() as Y.XmlElement[];
    const paragraphs = cells.map((cell) => cell.get(0) as Y.XmlElement);
    paragraphs.forEach((block, i) =>
      block.setAttribute('id', `row-a-field-${i}`),
    );
    const content = paragraphs.map((block) => block.toArray());
    const before = page.read().child(0).child(0);
    expect(page.edit([update(owner, office, status)])).toMatchObject({
      ok: true,
      updatedCells: [
        { rowRef: 'b2', column: 2, value: 'Lin' },
        { rowRef: 'b2', column: 3, value: 'Floor 4' },
        { rowRef: 'b2', column: 4, value: 'Approved' },
      ],
    });
    const after = page.read().child(0).child(0);
    expect(after.child(0).toJSON()).toEqual(before.child(0).toJSON());
    expect(after.child(4).toJSON()).toEqual(before.child(4).toJSON());
    expect(after.child(1).firstChild.firstChild.toJSON()).toEqual(
      text('Lin', [comment]),
    );
    expect(after.child(2).firstChild.children.map((n) => n.toJSON())).toEqual([
      text('Floor ', [{ type: 'bold' }]),
      text('4', [{ type: 'italic' }]),
    ]);
    expect(after.child(3).firstChild.firstChild.attrs).toEqual({
      ...before.child(3).firstChild.firstChild.attrs,
      text: 'Approved',
    });
    expect(after.child(3).attrs).toEqual(before.child(3).attrs);
    for (const [i, element] of cells.entries()) {
      expect(row.get(i)).toBe(element);
      expect(element.get(0)).toBe(paragraphs[i]);
      expect(after.child(i).firstChild.attrs.id).toBe(`row-a-field-${i}`);
      content[i].forEach((node, j) => expect(paragraphs[i].get(j)).toBe(node));
    }
  });

  it('rejects stale, overlapping, ambiguous and non-scalar changes before any write', () => {
    const page = livePage(
      doc(
        table(
          cell(text('Sam')),
          cell(text('Sam')),
          cell(text('Floor 2')),
          cell(badge),
          cell(text('prefix'), badge),
          cell(badge, badge),
          { type: 'tableCell', content: [paragraph('one'), paragraph('two')] },
          cell(text('foo', [{ type: 'bold' }]), text('bar')),
          {
            type: 'tableCell',
            content: [
              { type: 'blockquote', content: [table(cell(text('nested')))] },
            ],
          },
        ),
      ),
    );
    const before = page.state();
    for (const edits of [
      [update(owner, { ...office, oldValue: 'Floor' })],
      [update(owner, { ...status, oldValue: 'draft' })],
      [update(owner, owner)],
      [update(owner), update(owner)],
      [
        update(owner),
        {
          type: 'replace_text',
          ref: 'b2',
          oldText: 'Sam',
          newText: 'Eli',
          occurrence: 2,
        },
      ],
      [update(owner), { type: 'delete', ref: 'b1' }],
      [update(owner, { ...office, column: 0 })],
      [update(owner, { ...office, column: 1.5 })],
      [update(owner, { ...office, column: 10 })],
      [update(owner, { ...status, column: 5 })],
      [update(owner, { ...status, column: 6 })],
      [update(owner, { column: 7, oldValue: 'onetwo', newValue: 'three' })],
      [update(owner, { column: 8, oldValue: 'foobar', newValue: 'quux' })],
      [update(owner, { column: 8, oldValue: 'foobar', newValue: 'bar' })],
      [update(owner, { column: 9, oldValue: 'nested', newValue: 'outer' })],
      [{ ...update(owner), ref: 'b1' }],
      [{ ...update(owner), ref: 'unknown' }],
      [update()],
    ] as BlockEdit[][]) {
      expect(page.edit(edits)).toMatchObject({ ok: false });
      expect(page.state()).toEqual(before);
    }
    expect(page.edit([update(owner)], 'stale')).toMatchObject({
      ok: false,
      error: expect.stringMatching(/changed/),
    });
    expect(page.state()).toEqual(before);
  });

  it('validates the live badge before applying any other cell and tolerates adjacent emptied text', () => {
    const page = livePage(
      doc(
        table(
          cell(text('Other')),
          cell(text('Sam')),
          cell(text('Prefix'), badge),
        ),
      ),
    );
    expect(
      page.edit([
        { type: 'replace_text', ref: 'b2', oldText: 'Prefix', newText: '' },
      ]).ok,
    ).toBe(true);
    const row = (page.fragment.get(0) as Y.XmlElement).get(0) as Y.XmlElement;
    const paragraph = (row.get(2) as Y.XmlElement).get(0) as Y.XmlElement;
    const badgeElement = paragraph
      .toArray()
      .find((node) => node instanceof Y.XmlElement) as Y.XmlElement;
    const edit = update(owner, { ...status, column: 3 });
    const plan = planBlockEdits(page.read(), [edit]);
    if (plan.ok === false) throw new Error(plan.error);
    badgeElement.setAttribute('text', 'Changed');
    const before = page.state();
    expect(applyBlockSplices(page.fragment, plan.splices)).toBe(false);
    expect(page.state()).toEqual(before);
    const receipt = page.edit([
      update(owner, { ...status, column: 3, oldValue: 'Changed' }),
    ]);
    expect(receipt.ok).toBe(true);
    expect(paragraph.toArray()).toContain(badgeElement);
    expect(badgeElement.getAttribute('text')).toBe('Approved');
  });

  it('fills and clears empty text cells in place, alongside another operation on the same row', () => {
    const page = livePage(doc(table(cell(text('Other')), cell(), cell(badge))));
    const block = (
      (page.fragment.get(0) as Y.XmlElement).get(0) as Y.XmlElement
    ).get(1) as Y.XmlElement;
    const paragraph = block.get(0) as Y.XmlElement;
    const fill = { column: 2, oldValue: '', newValue: 'North' };
    expect(
      page.edit([
        update(fill),
        { type: 'replace_text', ref: 'b2', oldText: 'Other', newText: 'First' },
      ]).ok,
    ).toBe(true);
    const run = paragraph.get(0);
    expect(
      page.edit([update({ column: 2, oldValue: 'North', newValue: '' })]).ok,
    ).toBe(true);
    expect(page.edit([update(fill)]).ok).toBe(true);
    expect(block.get(0)).toBe(paragraph);
    expect(paragraph.get(0)).toBe(run);
    expect(textsOf(page.read().child(0).child(0))).toEqual([
      'First',
      'North',
      '',
    ]);
  });
});

describe('exact text edits', () => {
  const change = (
    ref: string,
    oldText: string,
    newText: string,
  ): BlockEdit => ({ type: 'replace_text', ref, oldText, newText });
  const cell = (label: string) => ({
    type: 'tableCell',
    content: [paragraph(label)],
  });

  it('edits only the changed text across formatted context and preserves relative positions', () => {
    const comment = {
      type: 'comment',
      attrs: { commentId: 'c1', resolved: false },
    };
    const page = livePage(
      doc(
        {
          type: 'paragraph',
          content: [
            text('State: '),
            text('Cat', [{ type: 'bold' }, comment]),
            text(' due', [{ type: 'italic' }]),
          ],
        },
        paragraph('next'),
      ),
    );
    const block = page.fragment.get(0) as Y.XmlElement;
    const ytext = block.get(0) as Y.XmlText;
    const beforeRef = Y.createRelativePositionFromTypeIndex(ytext, 2);
    const afterRef = Y.createRelativePositionFromTypeIndex(ytext, 12);
    const next = page.fragment.get(1);
    const oldMarks = page
      .read()
      .child(0)
      .child(1)
      .marks.map((m) => m.toJSON());
    expect(
      page.edit([change(page.refAt(0), 'State: Cat due', 'State: Cougar due')])
        .ok,
    ).toBe(true);
    expect(page.read().child(0).textContent).toBe('State: Cougar due');
    expect(
      page
        .read()
        .child(0)
        .child(1)
        .marks.map((m) => m.toJSON()),
    ).toEqual(oldMarks);
    expect(page.fragment.get(0)).toBe(block);
    expect(block.get(0)).toBe(ytext);
    expect(page.fragment.get(1)).toBe(next);
    expect(
      Y.createAbsolutePositionFromRelativePosition(beforeRef, page.ydoc)?.index,
    ).toBe(2);
    expect(
      Y.createAbsolutePositionFromRelativePosition(afterRef, page.ydoc)?.index,
    ).toBe(15);
  });

  it('keeps Unicode characters whole inside code and leaves adjacent atoms in place', () => {
    const page = livePage(
      doc({
        type: 'paragraph',
        content: [
          text('go😃', [{ type: 'code' }]),
          { type: 'hardBreak' },
          text('end'),
        ],
      }),
    );
    const block = page.fragment.get(0) as Y.XmlElement;
    const atom = block.get(1);
    expect(page.edit([change('b1', 'go😃', 'go😄!')]).ok).toBe(true);
    expect(page.read().child(0).child(0).text).toBe('go😄!');
    expect(page.read().child(0).child(0).marks[0].type.name).toBe('code');
    expect(block.get(1)).toBe(atom);
    const before = page.state();
    expect(page.edit([change('b1', '😄!end', 'bad')])).toMatchObject({
      ok: false,
    });
    expect(page.edit([change('b1', '\uD83D', 'bad')])).toMatchObject({
      ok: false,
    });
    expect(page.state()).toEqual(before);
  });

  it('uses a unique match within an addressed table row and keeps its cells', () => {
    const page = livePage(
      doc({
        type: 'table',
        content: [
          { type: 'tableRow', content: [cell('Draft'), cell('May 1')] },
        ],
      }),
    );
    const row = (page.fragment.get(0) as Y.XmlElement).get(0) as Y.XmlElement;
    const cells = row.toArray();
    expect(page.edit([change(page.refAt(0, 0), 'May 1', 'June 1')]).ok).toBe(
      true,
    );
    expect(row.get(0)).toBe(cells[0]);
    expect(row.get(1)).toBe(cells[1]);
    expect(page.read().child(0).textContent).toBe('DraftJune 1');
    const before = page.state();
    expect(
      page.edit([change(page.refAt(0, 0), 'ftJune', 'bad')]),
    ).toMatchObject({ ok: false });
    expect(page.state()).toEqual(before);
  });

  it('rejects ambiguous occurrence, formatting and overlap before any mutation', () => {
    const page = livePage(
      doc(
        {
          type: 'paragraph',
          content: [text('a', [{ type: 'bold' }]), text('b twice twice')],
        },
        paragraph('other'),
      ),
    );
    const before = page.state();
    for (const edit of [
      change('b1', 'twice', 'x'),
      change('b1', 'ab', 'X'),
      change('b1', 'ab', 'aXb'),
      change('b1', '', 'x'),
    ]) {
      expect(page.edit([change('b2', 'other', 'changed'), edit])).toMatchObject(
        { ok: false },
      );
      expect(page.state()).toEqual(before);
    }
    expect(
      page.edit([change('b1', 'ab', ''), change('b1', 'a', 'x')]),
    ).toMatchObject({ ok: false, error: expect.stringMatching(/overlap/) });
    expect(
      page.edit([change('b1', 'a', 'x'), { type: 'delete', ref: 'b1' }]),
    ).toMatchObject({ ok: false });
    expect(page.state()).toEqual(before);
    expect(page.edit([change('b1', 'ab', '')]).ok).toBe(true);
    expect(page.read().child(0).textContent).toBe(' twice twice');
  });

  it('applies disjoint text edits against one snapshot alongside structural inserts', () => {
    const page = livePage(doc(paragraph('one two three four')));
    expect(
      page.edit([
        change('b1', 'one', 'ONE plus'),
        change('b1', 'four', '4'),
        { type: 'insert_before', ref: 'b1', content: [paragraph('start')] },
      ]).ok,
    ).toBe(true);
    expect(textsOf(page.read())).toEqual(['start', 'ONE plus two three 4']);
  });

  it('keeps adjacent legacy Y.XmlText objects when a phrase spans them', () => {
    const page = livePage(doc(paragraph('left middle')));
    const block = page.fragment.get(0) as Y.XmlElement;
    const first = block.get(0);
    const second = new Y.XmlText(' right');
    block.insert(1, [second]);
    expect(page.edit([change('b1', 'middle right', 'replacement')]).ok).toBe(
      true,
    );
    expect(page.read().textContent).toBe('left replacement');
    expect(block.get(0)).toBe(first);
    expect(block.get(1)).toBe(second);
  });
});

describe('document edits', () => {
  const source = (id: string): JSONContent => ({
    type: 'transclusionSource',
    attrs: { id },
    content: [paragraph('synced')],
  });
  it('preserves unchanged nested Yjs elements and blocks inside a whole-page replacement', () => {
    const list = bulletList('one', 'two');
    const page = livePage(
      doc(paragraph('first'), list, paragraph('middle'), paragraph('end')),
    );
    const [first, nativeList, middle] = page.fragment.toArray();
    const firstItem = (nativeList as Y.XmlElement).get(0);
    expect(
      page.edit([
        {
          type: 'replace_document',
          ref: '',
          content: [
            paragraph('first'),
            bulletList('one', 'TWO'),
            paragraph('middle'),
            paragraph('last'),
          ],
        },
      ]).ok,
    ).toBe(true);
    expect(page.fragment.get(0)).toBe(first);
    expect(page.fragment.get(1)).toBe(nativeList);
    expect((nativeList as Y.XmlElement).get(0)).toBe(firstItem);
    expect(page.fragment.get(2)).toBe(middle);
  });

  it.each(['append_document', 'prepend_document', 'replace_document'] as const)(
    'initializes a genuinely empty page with %s',
    (type) => {
      const page = livePage(doc());
      expect(
        page.edit([{ type, ref: '', content: [paragraph('new')] }]).ok,
      ).toBe(true);
      expect(textsOf(page.read())).toEqual(['new']);
    },
  );

  it('refuses duplicate synced sources in the final state and permits existing duplicates to stay or improve', () => {
    const page = livePage(
      doc(source('shared'), source('shared'), paragraph('last')),
    );
    const state = page.state();
    const bad: BlockEdit[][] = [
      [{ type: 'append_document', ref: '', content: [source('shared')] }],
      [{ type: 'prepend_document', ref: '', content: [source('shared')] }],
      [
        {
          type: 'replace_document',
          ref: '',
          content: [source('new'), source('new')],
        },
      ],
      [
        {
          type: 'insert_after',
          ref: page.refAt(2),
          content: [source('shared')],
        },
      ],
    ];
    for (const edits of bad) {
      expect(page.edit(edits)).toMatchObject({
        ok: false,
        error: expect.stringMatching(/synced block/),
      });
      expect(page.state()).toEqual(state);
    }
    expect(
      page.edit([
        {
          type: 'replace_document',
          ref: '',
          content: [source('shared'), source('shared'), paragraph('changed')],
        },
      ]).ok,
    ).toBe(true);
    expect(page.edit([{ type: 'delete', ref: page.refAt(0) }]).ok).toBe(true);
    expect(
      page.edit([
        {
          type: 'insert_before',
          ref: page.refAt(0),
          content: [source('fresh')],
        },
        { type: 'replace', ref: page.refAt(1), content: [source('fresh')] },
      ]),
    ).toMatchObject({ ok: false });
  });
});

it('applies adjoining text edits from right to left when their minimal changes start at the same offset', () => {
  const left: BlockEdit = {
    type: 'replace_text',
    ref: 'b1',
    oldText: 'a',
    newText: 'aX',
  };
  const right: BlockEdit = {
    type: 'replace_text',
    ref: 'b1',
    oldText: 'b',
    newText: 'Y',
  };
  for (const edits of [
    [left, right],
    [right, left],
  ]) {
    const page = livePage(doc(paragraph('ab')));
    expect(page.edit(edits).ok).toBe(true);
    expect(page.read().textContent).toBe('aXY');
  }
});

it('checks the shared anchor ID namespace for retained, appended and replaced blocks', () => {
  const anchor = (id: string): JSONContent => ({
    type: 'paragraph',
    content: [{ type: 'sectionAnchor', attrs: { id } }],
  });
  const heading: JSONContent = {
    type: 'heading',
    attrs: { id: 'title', level: 2 },
    content: [text('Title')],
  };
  const page = livePage(doc(heading, anchor('topic'), paragraph('body')));
  const original = page.state();
  for (const edit of [
    { type: 'append_document', ref: '', content: [anchor('topic')] },
    { type: 'replace', ref: 'b3', content: [anchor('title')] },
    {
      type: 'replace_document',
      ref: '',
      content: [heading, { ...paragraph('copy'), attrs: { id: 'title' } }],
    },
  ] as BlockEdit[]) {
    expect(page.edit([edit])).toMatchObject({
      ok: false,
      error: expect.stringMatching(/ID .*already used/),
    });
    expect(page.state()).toEqual(original);
  }
  const move: BlockEdit[] = [
    { type: 'delete', ref: 'b2' },
    { type: 'insert_after', ref: 'b3', content: [anchor('topic')] },
  ];
  expect(page.edit(move)).toMatchObject({
    ok: false,
    error: expect.stringMatching(/recreate a deleted block/),
  });
  const source = {
    type: 'transclusionSource',
    attrs: { id: 'title' },
    content: [paragraph('source')],
  };
  const legacy = livePage(doc(heading, source));
  expect(
    legacy.edit([{ type: 'replace', ref: 'b1', content: [source] }]),
  ).toMatchObject({ ok: false, error: expect.stringMatching(/synced block/) });
});

describe('document additions around footnotes', () => {
  const reference = (id: string): JSONContent => ({
    type: 'paragraph',
    content: [
      text('Source'),
      {
        type: 'footnoteReference',
        attrs: { 'data-id': id, referenceNumber: '1' },
        content: [text('1')],
      },
    ],
  });
  const footnotes = (id: string): JSONContent => ({
    type: 'footnotes',
    content: [
      {
        type: 'footnote',
        attrs: { id: 'fn:1', 'data-id': id },
        content: [paragraph('Definition')],
      },
    ],
  });

  it('appends ordinary content before the terminal footnotes without replacing native elements', () => {
    const page = livePage(doc(reference('note'), footnotes('note')));
    const [body, notes] = page.fragment.toArray();
    expect(
      page.edit([
        { type: 'append_document', ref: '', content: [paragraph('last body')] },
      ]).ok,
    ).toBe(true);
    expect(page.fragment.get(0)).toBe(body);
    expect(page.fragment.get(2)).toBe(notes);
    expect(page.read().child(1).textContent).toBe('last body');
  });

  it.each(['append_document', 'prepend_document'] as const)(
    'keeps a first matching footnotes list last on %s',
    (type) => {
      const page = livePage(doc(paragraph('existing')));
      const body = page.fragment.get(0);
      const incoming = [reference('note'), footnotes('note')];
      expect(page.edit([{ type, ref: '', content: incoming }]).ok).toBe(true);
      expect(page.read().lastChild.type.name).toBe('footnotes');
      expect(page.fragment.get(type === 'prepend_document' ? 1 : 0)).toBe(body);
    },
  );

  it('rejects duplicate lists, copied references and orphan definitions atomically', () => {
    const page = livePage(doc(reference('note'), footnotes('note')));
    const before = page.state();
    for (const content of [
      [footnotes('extra')],
      [reference('note')],
      [reference('unknown')],
    ]) {
      expect(
        page.edit([{ type: 'append_document', ref: '', content }]),
      ).toMatchObject({ ok: false, error: expect.stringMatching(/footnote/) });
      expect(page.state()).toEqual(before);
    }
    expect(
      livePage(doc(paragraph('base'))).edit([
        { type: 'prepend_document', ref: '', content: [footnotes('orphan')] },
      ]),
    ).toMatchObject({ ok: false });
  });
});

it('keeps the original Yjs text and comment mark for a rich block replacement with one literal change', () => {
  const comment = {
    type: 'comment',
    attrs: { commentId: 'commented', resolved: true },
  };
  const block = (word: string) => ({
    type: 'paragraph',
    content: [text('First '), text(word, [comment]), text(' tail')],
  });
  const page = livePage(doc(block('cat')));
  const element = page.fragment.get(0) as Y.XmlElement;
  const ytext = element.get(0) as Y.XmlText;
  const end = Y.createRelativePositionFromTypeIndex(ytext, 11);
  expect(
    page.edit([{ type: 'replace', ref: 'b1', content: [block('kitten')] }]).ok,
  ).toBe(true);
  expect(page.fragment.get(0)).toBe(element);
  expect(element.get(0)).toBe(ytext);
  expect(
    Y.createAbsolutePositionFromRelativePosition(end, page.ydoc)?.index,
  ).toBe(14);
  expect(page.read().child(0).child(1).marks[0].toJSON()).toEqual(comment);
});

it('fills an empty native paragraph in place, including a previously emptied XmlText', () => {
  const page = livePage(doc(paragraph('sample')));
  const element = page.fragment.get(0) as Y.XmlElement;
  const ytext = element.get(0) as Y.XmlText;
  expect(
    page.edit([
      { type: 'replace_text', ref: 'b1', oldText: 'sample', newText: '' },
    ]).ok,
  ).toBe(true);
  expect(
    page.edit([
      {
        type: 'replace',
        ref: 'b1',
        content: [
          { type: 'paragraph', content: [text('filled', [{ type: 'bold' }])] },
        ],
      },
    ]).ok,
  ).toBe(true);
  expect(page.fragment.get(0)).toBe(element);
  expect(element.get(0)).toBe(ytext);
});

it('selects a numbered exact occurrence in repeated table cells using their row ref', () => {
  const cell = () => ({ type: 'tableCell', content: [paragraph('Approved')] });
  const page = livePage(
    doc({
      type: 'table',
      content: [{ type: 'tableRow', content: [cell(), cell()] }],
    }),
  );
  const edit: BlockEdit = {
    type: 'replace_text',
    ref: page.refAt(0, 0),
    oldText: 'Approved',
    newText: 'Pending',
  };
  expect(page.edit([edit])).toMatchObject({
    ok: false,
    error: expect.stringMatching(/more than once/),
  });
  expect(page.edit([{ ...edit, occurrence: 3 }])).toMatchObject({
    ok: false,
    error: expect.stringMatching(/2 exact matches/),
  });
  expect(page.edit([{ ...edit, occurrence: 2 }]).ok).toBe(true);
  expect(textsOf(page.read().child(0).child(0))).toEqual([
    'Approved',
    'Pending',
  ]);
});

it('resolves distinct or overlapping Unicode occurrences against one immutable snapshot', () => {
  const page = livePage(doc(paragraph('😃😃😃 / same same')));
  const edit: BlockEdit = {
    type: 'replace_text',
    ref: 'b1',
    oldText: '😃😃',
    newText: '🎉',
  };
  const state = page.state();
  expect(
    page.edit([
      { ...edit, occurrence: 1 },
      { ...edit, occurrence: 2 },
    ]),
  ).toMatchObject({ ok: false, error: expect.stringMatching(/overlap/) });
  expect(page.state()).toEqual(state);
  for (const occurrence of [0, -1, 1.5])
    expect(page.edit([{ ...edit, occurrence }]).ok).toBe(false);
  expect(
    page.edit([
      { ...edit, occurrence: 2 },
      { ...edit, oldText: 'same', newText: 'first', occurrence: 1 },
      { ...edit, oldText: 'same', newText: 'second', occurrence: 2 },
    ]).ok,
  ).toBe(true);
  expect(page.read().textContent).toBe('😃🎉 / first second');
});

it('rejects a delete paired with wrapping an unidentified legacy block elsewhere', () => {
  const page = livePage(doc(paragraph('legacy note'), paragraph('other')));
  const before = page.state();
  expect(
    page.edit([
      { type: 'delete', ref: 'b1' },
      {
        type: 'insert_after',
        ref: 'b2',
        content: [{ type: 'callout', content: [paragraph('legacy note')] }],
      },
    ]),
  ).toMatchObject({
    ok: false,
    error: expect.stringMatching(/recreate a deleted block/),
  });
  expect(page.state()).toEqual(before);
});
