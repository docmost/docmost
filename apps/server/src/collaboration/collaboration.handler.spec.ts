import { TiptapTransformer } from '@hocuspocus/transformer';
import type { JSONContent } from '@tiptap/core';
import * as Y from 'yjs';
import { CollaborationHandler } from './collaboration.handler';
import { tiptapExtensions } from './collaboration.util';
import { editableDocument, pageRevision } from './block-edit/block-refs';
import type { BlockEdit } from './block-edit/block-edits.types';

const paragraph = (text: string) => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});

function liveHandler(
  content: JSONContent[] = [paragraph('one'), paragraph('two')],
) {
  const ydoc = TiptapTransformer.toYdoc(
    { type: 'doc', content },
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
      code: 'stale_revision',
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
      code: 'collab_conflict',
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
        code: 'stale_revision',
        currentRevision: page.revision(),
        error: expect.stringMatching(/page changed/i),
      });
      expect(page.state()).toEqual(before);
      expect(await page.edit([edit], page.revision())).toMatchObject({
        ok: true,
      });
    },
  );

  it('returns the saved revision, scoped text, and fresh refs for each edit after structural shifts', async () => {
    const page = liveHandler([
      paragraph('unrelated'),
      {
        type: 'blockquote',
        content: [paragraph('one two'), paragraph('private neighbor')],
      },
      paragraph('remove me'),
    ]);
    const original = page.revision();
    const result = await page.edit(
      [
        { type: 'replace_text', ref: 'b3', oldText: 'two', newText: '2' },
        {
          type: 'replace_text',
          ref: 'b2',
          oldText: 'one',
          newText: 'longer first',
        },
        { type: 'insert_before', ref: 'b1', content: [paragraph('prefix')] },
        { type: 'delete', ref: 'b5' },
      ],
      original,
    );
    expect(result).toMatchObject({
      ok: true,
      contentRevision: page.revision(),
      insertedRefs: [[], [], ['b1'], []],
      changes: [
        { operation: 1, type: 'replace_text', refs: ['b4'], text: '2' },
        {
          operation: 2,
          type: 'replace_text',
          refs: ['b3'],
          text: 'longer first',
        },
        { operation: 3, type: 'insert_before', refs: ['b1'] },
        { operation: 4, type: 'delete', refs: [] },
      ],
    });
    expect(page.revision()).not.toBe(original);
    expect(JSON.stringify(result)).not.toMatch(
      /private neighbor|remove me|unrelated/,
    );
  });

  it('reports the final row ref and only the saved cell fields in the batch', async () => {
    const cell = (value: string) => ({
      type: 'tableCell',
      content: [paragraph(value)],
    });
    const badge = {
      type: 'tableCell',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'status', attrs: { text: 'Draft', color: 'blue' } },
          ],
        },
      ],
    };
    const page = liveHandler([
      {
        type: 'table',
        content: [{ type: 'tableRow', content: [cell('private'), badge] }],
      },
    ]);
    const result = await page.edit(
      [
        {
          type: 'update_cells',
          ref: 'b2',
          changes: [
            { column: 2, oldValue: 'Draft', newValue: 'Ready', color: 'green' },
          ],
        },
        { type: 'insert_before', ref: 'b1', content: [paragraph('prefix')] },
      ],
      page.revision(),
    );
    expect(result).toMatchObject({
      ok: true,
      contentRevision: page.revision(),
      updatedCells: [
        { rowRef: 'b3', column: 2, value: 'Ready', color: 'green' },
      ],
      changes: [
        { operation: 1, type: 'update_cells', refs: ['b3'] },
        { operation: 2, type: 'insert_before', refs: ['b1'] },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('private');
  });

  it('reports only saved attributes, including noops and schema defaults', async () => {
    const page = liveHandler([
      {
        type: 'heading',
        attrs: { id: 'private-id', level: 3 },
        content: [{ type: 'text', text: 'Private' }],
      },
    ]);
    const edits: BlockEdit[] = [
      { type: 'set_attrs', ref: 'b1', attrs: { level: null } },
      { type: 'set_attrs', ref: 'b1', attrs: { textAlign: 'center' } },
      { type: 'insert_before', ref: 'b1', content: [paragraph('prefix')] },
    ];
    const result = await page.edit(edits, page.revision());
    expect(result).toMatchObject({
      ok: true,
      contentRevision: page.revision(),
      changes: [
        { operation: 1, type: 'set_attrs', refs: ['b2'], attrs: { level: 1 } },
        {
          operation: 2,
          type: 'set_attrs',
          refs: ['b2'],
          attrs: { textAlign: 'center' },
        },
        { operation: 3, type: 'insert_before', refs: ['b1'] },
      ],
    });
    if (result.ok) {
      expect(result.changes.map((change) => change.attrs)).toEqual([
        { level: 1 },
        { textAlign: 'center' },
        undefined,
      ]);
    }
    expect(JSON.stringify(result)).not.toMatch(/private-id|Private/);
    const saved = page.revision();
    expect(await page.edit([{ ...edits[0], ref: 'b2' }], saved)).toMatchObject({
      ok: true,
      contentRevision: saved,
      changes: [
        { operation: 1, type: 'set_attrs', refs: ['b2'], attrs: { level: 1 } },
      ],
    });
  });

  it('confirms a moved range and its final sibling when another edit shifts every position', async () => {
    const page = liveHandler([
      paragraph('one'),
      paragraph('two'),
      paragraph('target'),
    ]);
    expect(
      await page.edit(
        [
          { type: 'move_after', ref: 'b1', endRef: 'b2', targetRef: 'b3' },
          { type: 'insert_before', ref: 'b3', content: [paragraph('prefix')] },
        ],
        page.revision(),
      ),
    ).toMatchObject({
      ok: true,
      insertedRefs: [['b3', 'b4'], ['b1']],
      changes: [
        {
          operation: 1,
          type: 'move_after',
          refs: ['b3', 'b4'],
          destination: { index: 3, parentType: 'doc', targetRef: 'b2' },
        },
        { operation: 2, type: 'insert_before', refs: ['b1'] },
      ],
    });
  });

  it('reports the actual parent when a move removes its original target wrapper', async () => {
    const quote = (child: JSONContent) => ({
      type: 'blockquote',
      content: [child],
    });
    const page = liveHandler([
      paragraph('top'),
      quote(quote(paragraph('moved'))),
    ]);
    const result = await page.edit(
      [{ type: 'move_before', ref: 'b4', targetRef: 'b3' }],
      page.revision(),
    );
    expect(result).toMatchObject({
      ok: true,
      changes: [
        {
          operation: 1,
          type: 'move_before',
          refs: ['b2'],
          destination: { index: 2, parentType: 'doc' },
        },
      ],
    });
    expect(result).not.toHaveProperty('changes.0.destination.targetRef');
  });

  it('reports the actual destination for a moved paragraph with no individually readable block ref', async () => {
    const page = liveHandler([
      paragraph('move'),
      {
        type: 'bulletList',
        content: [{ type: 'listItem', content: [paragraph('existing')] }],
      },
    ]);
    expect(
      await page.edit(
        [{ type: 'move_into', ref: 'b1', targetRef: 'b3', position: 'end' }],
        page.revision(),
      ),
    ).toMatchObject({
      ok: true,
      insertedRefs: [[]],
      movedInto: [{ parentRef: 'b2', parentType: 'listItem' }],
      changes: [
        {
          operation: 1,
          type: 'move_into',
          refs: [],
          destination: {
            index: 2,
            parentType: 'listItem',
            parentRef: 'b2',
            targetRef: 'b2',
          },
        },
      ],
    });
  });

  it('returns replacement refs and bounded correct text without borrowing neighboring content', async () => {
    const page = liveHandler();
    const replacement: BlockEdit = {
      type: 'replace',
      ref: 'b2',
      content: [paragraph('two'), paragraph('extra')],
    };
    expect(await page.edit([replacement], page.revision())).toMatchObject({
      ok: true,
      changes: [{ operation: 1, type: 'replace', refs: ['b2', 'b3'] }],
    });
    const long = 'x' + '🎉'.repeat(500);
    const result = await page.edit(
      [{ type: 'replace_text', ref: 'b3', oldText: 'extra', newText: long }],
      page.revision(),
    );
    expect(result).toMatchObject({
      ok: true,
      changes: [
        {
          operation: 1,
          type: 'replace_text',
          refs: ['b3'],
          text: expect.stringMatching(/^x(?:🎉){1,256}$/u),
          textTruncated: true,
        },
      ],
    });
  });
});
