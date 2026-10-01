import {
  getAttachmentIdFromUrl,
  getReferencedAttachmentIds,
  replaceAttachmentIds,
} from './attachment-refs';

const ID_A = '0199a6b2-1d2e-7c3f-8a4b-5c6d7e8f9a0b';
const ID_B = '0199a6b2-2e3f-7d40-9b5c-6d7e8f9a0b1c';
const ID_NEW = '0199a6b2-3f40-7e51-ac6d-7e8f9a0b1c2d';

const doc = (...content: any[]) => ({ type: 'doc', content });
const image = (attrs: Record<string, any>) => ({ type: 'image', attrs });

describe('getAttachmentIdFromUrl', () => {
  it.each([
    `/api/files/${ID_A}/cat.png`,
    `/files/${ID_A}/cat.png`,
    `https://docs.example.com/api/files/${ID_A}/cat.png`,
    `http://localhost:3000/api/files/${ID_A}/cat.png?t=1`,
  ])('reads the id from %s', (url) => {
    expect(getAttachmentIdFromUrl(url)).toBe(ID_A);
  });

  it.each([
    `/api/files/public/${ID_A}/cat.png?jwt=token`,
    `https://cdn.example.com/images/${ID_A}/cat.png`,
    '/api/files/not-a-uuid/cat.png',
    undefined,
    null,
  ])('ignores %s', (url) => {
    expect(getAttachmentIdFromUrl(url)).toBeUndefined();
  });
});

describe('getReferencedAttachmentIds', () => {
  it('collects attachmentIds and ids from src/url, without duplicates', () => {
    const content = doc(
      image({ attachmentId: ID_A, src: `/api/files/${ID_A}/a.png` }),
      {
        type: 'paragraph',
        content: [image({ src: `/api/files/${ID_A}/a.png` })],
      },
      {
        type: 'attachment',
        attrs: { url: `/api/files/${ID_B}/report.pdf`, attachmentId: null },
      },
      image({ src: 'https://example.com/external.png' }),
    );

    expect(getReferencedAttachmentIds(content)).toEqual([ID_A, ID_B]);
  });

  it('ignores urls of nodes that are not attachments', () => {
    const content = doc({
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'link',
          marks: [
            { type: 'link', attrs: { href: `/api/files/${ID_A}/a.png` } },
          ],
        },
      ],
    });

    expect(getReferencedAttachmentIds(content)).toEqual([]);
  });
});

describe('replaceAttachmentIds', () => {
  it('fills in a missing attachmentId when an id maps to itself', () => {
    const content = doc(image({ src: `/api/files/${ID_A}/a.png` }));
    const result = replaceAttachmentIds(content, new Map([[ID_A, ID_A]]));

    expect(result.content[0].attrs).toEqual({
      attachmentId: ID_A,
      src: `/api/files/${ID_A}/a.png`,
    });
  });

  it('points attachmentId, src and url to the new id', () => {
    const content = doc(
      image({ attachmentId: ID_A, src: `/api/files/${ID_A}/a.png` }),
      {
        type: 'attachment',
        attrs: { attachmentId: ID_A, url: `/api/files/${ID_A}/a.png` },
      },
    );
    const result = replaceAttachmentIds(content, new Map([[ID_A, ID_NEW]]));

    expect(result.content[0].attrs).toEqual({
      attachmentId: ID_NEW,
      src: `/api/files/${ID_NEW}/a.png`,
    });
    expect(result.content[1].attrs).toEqual({
      attachmentId: ID_NEW,
      url: `/api/files/${ID_NEW}/a.png`,
    });
  });

  it('leaves unmapped nodes unchanged and does not mutate the input', () => {
    const content = doc(
      image({ src: `/api/files/${ID_A}/a.png` }),
      image({ attachmentId: ID_B, src: `/api/files/${ID_B}/b.png` }),
    );
    const before = JSON.parse(JSON.stringify(content));
    const result = replaceAttachmentIds(content, new Map([[ID_B, ID_NEW]]));

    expect(content).toEqual(before);
    expect(result.content[0]).toEqual(before.content[0]);
    expect(result.content[1].attrs.attachmentId).toBe(ID_NEW);
  });
});
