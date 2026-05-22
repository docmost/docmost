import {
  rewriteAttachmentsForUnsync,
  type AttachmentRewritePlan,
} from '../utils/transclusion-unsync.util';

describe('rewriteAttachmentsForUnsync', () => {
  const fixedIds = (() => {
    let i = 0;
    return () => `new-${++i}`;
  });

  it('returns content unchanged when no attachment nodes are present', () => {
    const content = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'hello' }] },
      ],
    };
    const r = rewriteAttachmentsForUnsync(content, fixedIds());
    expect(r.content).toEqual(content);
    expect(r.copies).toEqual([]);
  });

  it('rewrites attachmentId and src on a single image node', () => {
    const oldId = '11111111-1111-1111-1111-111111111111';
    const content = {
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: {
            attachmentId: oldId,
            src: `/api/files/${oldId}/cat.png`,
          },
        },
      ],
    };
    const gen = fixedIds();
    const r = rewriteAttachmentsForUnsync(content, gen);

    expect(r.copies).toHaveLength(1);
    const plan: AttachmentRewritePlan = r.copies[0];
    expect(plan.oldAttachmentId).toBe(oldId);
    expect(plan.newAttachmentId).toBe('new-1');

    const img = (r.content as any).content[0];
    expect(img.attrs.attachmentId).toBe('new-1');
    expect(img.attrs.src).toBe('/api/files/new-1/cat.png');
  });

  it('rewrites every attachment node type (image, video, audio, attachment, drawio, excalidraw, pdf)', () => {
    const types = [
      'image',
      'video',
      'audio',
      'attachment',
      'drawio',
      'excalidraw',
      'pdf',
    ] as const;
    const content = {
      type: 'doc',
      content: types.map((t, i) => ({
        type: t,
        attrs: {
          attachmentId: `old-${i}`,
          src: `/api/files/old-${i}/file`,
        },
      })),
    };
    const r = rewriteAttachmentsForUnsync(content, fixedIds());
    expect(r.copies).toHaveLength(types.length);
    expect((r.content as any).content.map((n: any) => n.attrs.attachmentId)).toEqual(
      Array.from({ length: types.length }, (_, i) => `new-${i + 1}`),
    );
  });

  it('reuses one new id per old attachmentId across nodes (dedupe)', () => {
    const shared = 'shared-old';
    const content = {
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: {
            attachmentId: shared,
            src: `/api/files/${shared}/a.png`,
          },
        },
        {
          type: 'image',
          attrs: {
            attachmentId: shared,
            src: `/api/files/${shared}/a.png`,
          },
        },
      ],
    };
    const r = rewriteAttachmentsForUnsync(content, fixedIds());
    expect(r.copies).toHaveLength(1);
    expect(r.copies[0].oldAttachmentId).toBe(shared);
    const newId = r.copies[0].newAttachmentId;
    expect((r.content as any).content[0].attrs.attachmentId).toBe(newId);
    expect((r.content as any).content[1].attrs.attachmentId).toBe(newId);
  });

  it('does not mutate the input content object', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: { attachmentId: 'old-x', src: '/api/files/old-x/x.png' },
        },
      ],
    };
    const snapshot = JSON.parse(JSON.stringify(content));
    rewriteAttachmentsForUnsync(content, fixedIds());
    expect(content).toEqual(snapshot);
  });

  it('skips nodes whose attachmentId is missing or not a uuid-shaped string', () => {
    const content = {
      type: 'doc',
      content: [
        { type: 'image', attrs: {} },
        { type: 'image', attrs: { attachmentId: '' } },
      ],
    };
    const r = rewriteAttachmentsForUnsync(content, fixedIds());
    expect(r.copies).toEqual([]);
    expect(r.content).toEqual(content);
  });

  it('recurses into nested containers (column, callout)', () => {
    const oldId = 'old-nested';
    const content = {
      type: 'doc',
      content: [
        {
          type: 'callout',
          content: [
            {
              type: 'image',
              attrs: {
                attachmentId: oldId,
                src: `/api/files/${oldId}/x.png`,
              },
            },
          ],
        },
      ],
    };
    const r = rewriteAttachmentsForUnsync(content, fixedIds());
    expect(r.copies).toHaveLength(1);
    const newId = r.copies[0].newAttachmentId;
    const inner = (r.content as any).content[0].content[0];
    expect(inner.attrs.attachmentId).toBe(newId);
    expect(inner.attrs.src).toBe(`/api/files/${newId}/x.png`);
  });
});
