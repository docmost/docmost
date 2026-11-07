import { pageNodeToDocxBuffer } from '@docmost/editor-ext';
import * as JSZip from 'jszip';
import { jsonToNode } from '../../collaboration/collaboration.util';

const EMU_PER_PX = 9525;

function png(width: number, height: number): Uint8Array {
  const header = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header);
  header.writeUInt32BE(13, 8);
  header.write('IHDR', 12, 'latin1');
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  return header;
}

function jpeg(width: number, height: number): Uint8Array {
  const data = Buffer.alloc(24);
  Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08]).copy(data);
  data.writeUInt16BE(height, 7);
  data.writeUInt16BE(width, 9);
  return data;
}

function webp(width: number, height: number): Uint8Array {
  const data = Buffer.alloc(30);
  data.write('RIFF', 0, 'latin1');
  data.writeUInt32LE(22, 4);
  data.write('WEBPVP8X', 8, 'latin1');
  data.writeUInt32LE(10, 16);
  data.writeUIntLE(width - 1, 24, 3);
  data.writeUIntLE(height - 1, 27, 3);
  return data;
}

function svg(attributes: string): Uint8Array {
  return Buffer.from(
    `<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" ${attributes}><rect/></svg>`,
  );
}

const paragraph = (type: string, attrs: Record<string, unknown>) => ({
  type: 'doc',
  content: [{ type, attrs }],
});

async function exportDoc(
  json: any,
  image: Uint8Array | (() => Uint8Array),
): Promise<{ media: string[]; document: string; contentTypes: string }> {
  const buffer = await pageNodeToDocxBuffer(jsonToNode(json), () =>
    typeof image === 'function' ? image() : image,
  );
  const zip = await JSZip.loadAsync(buffer);
  return {
    media: zip
      .filter((path, file) => path.startsWith('word/media/') && !file.dir)
      .map((file) => file.name),
    document: await zip.file('word/document.xml').async('string'),
    contentTypes: await zip.file('[Content_Types].xml').async('string'),
  };
}

const extentInPx = (document: string) => {
  const [, cx, cy] = document.match(/<wp:extent cx="(\d+)" cy="(\d+)"/);
  return { width: Number(cx) / EMU_PER_PX, height: Number(cy) / EMU_PER_PX };
};

describe('docx image export', () => {
  describe('size and alignment', () => {
    it('uses the width and alignment of the node', async () => {
      const { document } = await exportDoc(
        paragraph('image', { src: '/a.png', width: 200, align: 'left' }),
        png(400, 100),
      );

      expect(extentInPx(document)).toEqual({ width: 200, height: 50 });
      expect(document).toContain('<w:jc w:val="left"/>');
    });

    it('reads a width stored as a percentage', async () => {
      const { document } = await exportDoc(
        paragraph('image', { src: '/a.png', width: '50%', align: 'right' }),
        png(1000, 1000),
      );

      expect(extentInPx(document)).toEqual({ width: 300, height: 300 });
      expect(document).toContain('<w:jc w:val="right"/>');
    });

    it('falls back to the natural width', async () => {
      const { document } = await exportDoc(
        paragraph('image', { src: '/a.png' }),
        png(320, 160),
      );

      expect(extentInPx(document)).toEqual({ width: 320, height: 160 });
      expect(document).toContain('<w:jc w:val="center"/>');
    });

    it.each([
      ['natural', undefined],
      ['requested', 2000],
    ])('caps a large %s width to the page', async (_name, width) => {
      const { document } = await exportDoc(
        paragraph('image', { src: '/a.png', width }),
        png(2000, 1000),
      );

      expect(extentInPx(document)).toEqual({ width: 600, height: 300 });
    });

    it('caps the width to a share of the page inside a table', async () => {
      const cell = (content: any) => ({
        type: 'tableCell',
        content: [content],
      });
      const { document } = await exportDoc(
        {
          type: 'doc',
          content: [
            {
              type: 'table',
              content: [
                {
                  type: 'tableRow',
                  content: [
                    cell({ type: 'image', attrs: { src: '/a.png' } }),
                    cell({ type: 'paragraph' }),
                  ],
                },
              ],
            },
          ],
        },
        png(1000, 500),
      );

      expect(extentInPx(document)).toEqual({ width: 300, height: 150 });
    });
  });

  describe('image type', () => {
    it.each([
      'data:image/png;base64,iVBORw0KGgo=',
      '/api/files/id/photo.png?t=1700000000',
      '/api/files/id/photo',
      '/api/files/id/photo.JPG',
    ])('names the media part after the bytes for %s', async (src) => {
      const { media } = await exportDoc(
        paragraph('image', { src }),
        png(10, 10),
      );

      expect(media).toEqual([
        expect.stringMatching(/^word\/media\/[^.]+\.png$/),
      ]);
    });

    it('trusts the bytes over the extension', async () => {
      const { media, contentTypes } = await exportDoc(
        paragraph('image', { src: '/a.png' }),
        jpeg(10, 10),
      );

      expect(media).toEqual([expect.stringMatching(/\.jpg$/)]);
      expect(contentTypes).toContain('Extension="jpg"');
    });
  });

  describe('svg', () => {
    it.each(['image', 'drawio', 'excalidraw'])(
      'embeds an svg %s with a fallback',
      async (type) => {
        const { media, document } = await exportDoc(
          paragraph(type, { src: '/diagram.svg?t=1700000000' }),
          svg('width="421px" height="281px" viewBox="0 0 421 281"'),
        );

        expect(media.map((name) => name.split('.').pop()).sort()).toEqual([
          'png',
          'svg',
        ]);
        expect(document).toContain('asvg:svgBlip');
        expect(extentInPx(document)).toEqual({ width: 421, height: 281 });
      },
    );

    it.each([
      ['width and height', 'width="400" height="100"', 400, 100],
      ['absolute units', 'width="1in" height="72pt"', 96, 96],
      ['only a viewBox', 'viewBox="0 0 200 50"', 200, 50],
      ['a viewBox with commas', 'viewBox="0,0,200,50"', 200, 50],
      ['a width and a viewBox', 'width="100" viewBox="0 0 200 50"', 100, 25],
      ['a height and a viewBox', 'height="100" viewBox="0 0 200 50"', 400, 100],
      [
        'relative sizes',
        'width="100%" height="100%" viewBox="0 0 200 50"',
        200,
        50,
      ],
      ['no size', '', 300, 150],
    ])('reads the size from %s', async (_name, attributes, width, height) => {
      const { document } = await exportDoc(
        paragraph('image', { src: '/a.svg' }),
        svg(attributes),
      );

      expect(extentInPx(document)).toEqual({ width, height });
    });

    it('reads the root tag past a long attribute containing ">"', async () => {
      const content = `<mxfile>${'x'.repeat(2_000_000)}</mxfile>`;
      const { document } = await exportDoc(
        paragraph('drawio', { src: '/a.svg' }),
        svg(`content='${content}' stroke-width="9" width="40" height="20"`),
      );

      expect(extentInPx(document)).toEqual({ width: 40, height: 20 });
    });

    it('finds the root after a prolog', async () => {
      const prolog =
        '\ufeff<?xml version="1.0"?>\n<!-- <svg width="1"> -->\n' +
        '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" [ <!ENTITY a "b"> ]>\n';
      const { document } = await exportDoc(
        paragraph('image', { src: '/a.svg' }),
        Buffer.from(`${prolog}<svg width="40" height="20"></svg>`),
      );

      expect(extentInPx(document)).toEqual({ width: 40, height: 20 });
    });

    it('does not take sizes from similar attributes or child elements', async () => {
      const { document } = await exportDoc(
        paragraph('image', { src: '/a.svg' }),
        Buffer.from(
          '<svg stroke-width="9" data-height="8"><rect width="7" height="6"/></svg>',
        ),
      );

      expect(extentInPx(document)).toEqual({ width: 300, height: 150 });
    });
  });

  describe('images that cannot be placed', () => {
    const note = '[Image not exported]';

    it.each([
      ['webp', webp(10, 10)],
      ['unknown bytes', Buffer.from('not an image')],
      ['html', Buffer.from('<html><body>Not found</body></html>')],
      [
        'html with an inline svg',
        Buffer.from(
          '<html><body><svg width="10" height="10"></svg></body></html>',
        ),
      ],
      ['no bytes', new Uint8Array()],
    ])('leaves a note for %s', async (_name, image) => {
      const { media, document } = await exportDoc(
        paragraph('image', { src: '/a.webp' }),
        image,
      );

      expect(media).toEqual([]);
      expect(document).toContain(note);
    });

    it('leaves a note when the image cannot be fetched', async () => {
      const { media, document } = await exportDoc(
        paragraph('image', { src: '/a.png' }),
        () => {
          throw new Error('not found');
        },
      );

      expect(media).toEqual([]);
      expect(document).toContain(note);
    });

    it('keeps an image without a source silent', async () => {
      const { document } = await exportDoc(
        paragraph('image', { src: '' }),
        png(10, 10),
      );

      expect(document).not.toContain(note);
    });
  });
});
