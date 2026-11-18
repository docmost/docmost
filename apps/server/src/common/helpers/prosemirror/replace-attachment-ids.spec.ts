import { replaceAttachmentIds } from './utils';

const OLD = '11111111-1111-7111-8111-111111111111';
const OLD2 = '22222222-2222-7222-8222-222222222222';
const NEW = '33333333-3333-7333-8333-333333333333';
const NEW2 = '44444444-4444-7444-8444-444444444444';

const doc = (...content: any[]) => ({ type: 'doc', content });

describe('replaceAttachmentIds', () => {
  const idMap = new Map([
    [OLD, NEW],
    [OLD2, NEW2],
  ]);

  it('rewrites attachmentId and src on an image node', () => {
    const result = replaceAttachmentIds(
      doc({
        type: 'image',
        attrs: { attachmentId: OLD, src: `/api/files/${OLD}/a.png` },
      }),
      idMap,
    );
    expect(result.content[0].attrs).toEqual({
      attachmentId: NEW,
      src: `/api/files/${NEW}/a.png`,
    });
  });

  it('rewrites url on an attachment node and leaves name untouched', () => {
    const result = replaceAttachmentIds(
      doc({
        type: 'attachment',
        attrs: {
          attachmentId: OLD,
          url: `/api/files/${OLD}/report.pdf`,
          name: 'report.pdf',
        },
      }),
      idMap,
    );
    expect(result.content[0].attrs).toEqual({
      attachmentId: NEW,
      url: `/api/files/${NEW}/report.pdf`,
      name: 'report.pdf',
    });
  });

  it('keeps the query string on a drawio src', () => {
    const result = replaceAttachmentIds(
      doc({
        type: 'drawio',
        attrs: { attachmentId: OLD, src: `/api/files/${OLD}/d.svg?t=123` },
      }),
      idMap,
    );
    expect(result.content[0].attrs.src).toBe(`/api/files/${NEW}/d.svg?t=123`);
  });

  it('maps repeated old ids to the same new id', () => {
    const result = replaceAttachmentIds(
      doc(
        { type: 'image', attrs: { attachmentId: OLD, src: `/api/files/${OLD}/a.png` } },
        { type: 'image', attrs: { attachmentId: OLD, src: `/api/files/${OLD}/a.png` } },
      ),
      idMap,
    );
    expect(result.content[0].attrs.attachmentId).toBe(NEW);
    expect(result.content[1].attrs.attachmentId).toBe(NEW);
  });

  it('leaves unmapped ids and non-attachment nodes unchanged', () => {
    const other = '55555555-5555-7555-8555-555555555555';
    const input = doc(
      { type: 'image', attrs: { attachmentId: other, src: `/api/files/${other}/a.png` } },
      { type: 'paragraph', attrs: { attachmentId: OLD } },
    );
    const result = replaceAttachmentIds(input, idMap);
    expect(result).toEqual(input);
  });

  it('does not mutate the input', () => {
    const input = doc({
      type: 'image',
      attrs: { attachmentId: OLD, src: `/api/files/${OLD}/a.png` },
    });
    const clone = JSON.parse(JSON.stringify(input));
    replaceAttachmentIds(input, idMap);
    expect(input).toEqual(clone);
  });

  it('rewrites nested nodes', () => {
    const result = replaceAttachmentIds(
      doc({
        type: 'columns',
        content: [
          {
            type: 'column',
            content: [
              { type: 'image', attrs: { attachmentId: OLD, src: `/api/files/${OLD}/a.png` } },
            ],
          },
        ],
      }),
      idMap,
    );
    expect(result.content[0].content[0].content[0].attrs.attachmentId).toBe(NEW);
  });
});
