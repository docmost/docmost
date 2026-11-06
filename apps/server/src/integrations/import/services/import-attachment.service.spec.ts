import * as os from 'os';
import * as path from 'path';
import { promises as fs } from 'fs';
import { ImportAttachmentService } from './import-attachment.service';

jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => (task: () => Promise<unknown>) => task(),
}));
jest.mock('../../storage/storage.service', () => ({ StorageService: class {} }));
jest.mock('../../environment/environment.service', () => ({
  EnvironmentService: class {},
}));
jest.mock('@sindresorhus/slugify', () => ({
  __esModule: true,
  default: (value: string) => value,
}));

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const dataUri = (mime: string, b64 = Buffer.from('hello').toString('base64')) =>
  `data:${mime};base64,${b64}`;

const fileTask = {
  workspaceId: 'ws-1',
  spaceId: 'space-1',
  creatorId: 'user-1',
};

describe('ImportAttachmentService', () => {
  let service: ImportAttachmentService;
  let storage: { uploadStream: jest.Mock };
  let queue: { add: jest.Mock };
  let inserted: any[];
  let uploadSizeLimit: string;

  const run = (html: string, extra: Record<string, unknown> = {}) =>
    service.processAttachments({
      html,
      pageId: 'page-1',
      pageRelativePath: '',
      fileTask,
      ...extra,
    });

  beforeEach(() => {
    inserted = [];
    uploadSizeLimit = '50mb';
    storage = { uploadStream: jest.fn().mockResolvedValue(undefined) };
    queue = { add: jest.fn().mockResolvedValue(undefined) };
    const db = {
      insertInto: jest.fn().mockReturnValue({
        values: (v: any) => {
          inserted.push(v);
          return { execute: jest.fn().mockResolvedValue(undefined) };
        },
      }),
    };
    const env = { getFileUploadSizeLimit: () => uploadSizeLimit };

    service = new ImportAttachmentService(
      storage as any,
      env as any,
      db as any,
      queue as any,
    );
    (service as any).RETRY_DELAY = 0;
  });

  describe('embedded base64 sources', () => {
    it('uploads an embedded image and rewrites the img node', async () => {
      const html = await run(`<p><img src="${dataUri('image/png', PNG_BASE64)}"></p>`);

      expect(html).not.toContain('data:image');
      expect(html).toMatch(/src="\/api\/files\/[\w-]+\/[\w-]+\.png"/);
      expect(html).toContain('data-attachment-id=');
      expect(html).toContain('width="1"');
      expect(inserted).toHaveLength(1)
      expect(storage.uploadStream).toHaveBeenCalledTimes(1);
    });

    it('records ownership, mime type and size on the attachment row', async () => {
      await run(`<img src="${dataUri('image/png', PNG_BASE64)}">`);

      expect(inserted).toHaveLength(1);
      expect(inserted[0]).toMatchObject({
        pageId: 'page-1',
        workspaceId: 'ws-1',
        spaceId: 'space-1',
        creatorId: 'user-1',
        mimeType: 'image/png',
        fileExt: '.png',
        type: 'file',
        fileSize: Buffer.from(PNG_BASE64, 'base64').length,
      });
      expect(inserted[0].filePath).toContain(inserted[0].id);
    });

    it('normalizes image/jpeg to .jpg and audio/mpeg to .mp3', async () => {
      await run(
        `<img src="${dataUri('image/jpeg')}"><audio src="${dataUri('audio/mpeg')}"></audio>`,
      );

      expect(inserted.map((i) => i.fileExt).sort()).toEqual(['.jpg', '.mp3']);
    });

    it('parses audio and video elements', async () => {
      const html = await run(
        `<audio src="${dataUri('audio/mpeg')}"></audio><video src="${dataUri('video/mp4')}"></video>`,
      );

      expect(html).not.toContain('data:');
      expect(html).toMatch(/<audio[^>]*src="\/api\/files\//);
      expect(html).toMatch(/<video[^>]*src="\/api\/files\//);
      expect(inserted).toHaveLength(2)
    });

    it('turns a PDF link into a pdf node with size and queues indexing', async () => {
      const html = await run(
        `<a href="${dataUri('application/pdf')}">doc</a>`,
      );

      expect(html).toContain('data-type="pdf"');
      expect(html).toContain('data-size="5"');
      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(inserted).toHaveLength(1)
    });

    it('turns other embedded links into attachment nodes with size', async () => {
      const html = await run(`<a href="${dataUri('application/zip')}">zip</a>`);

      expect(html).toContain('data-type="attachment"');
      expect(html).toContain('data-attachment-mime="application/zip"');
      expect(html).toContain('data-attachment-size="5"');
      expect(inserted).toHaveLength(1)
    });

    it.each([
      ['object', 'data'],
      ['embed', 'src'],
      ['iframe', 'src'],
    ])('rewrites <%s %s> data URIs', async (tag, attr) => {
      const html = await run(
        `<${tag} ${attr}="${dataUri('application/pdf')}"></${tag}>`,
      );

      expect(html).toContain('data-type="pdf"');
      expect(html).not.toContain('data:application/pdf');
      expect(inserted).toHaveLength(1)
    });

    it('rewrites data URIs in attachment and diagram nodes', async () => {
      const html = await run(
        `<div data-type="attachment" data-attachment-url="${dataUri('application/zip')}"></div>` +
          `<div data-type="drawio" data-src="${dataUri('image/svg+xml')}"></div>`,
      );

      expect(html).not.toContain('data:');
      expect(html).toContain('data-type="attachment"');
      expect(html).toContain('data-type="drawio"');
      expect(inserted).toHaveLength(2);
      expect(inserted).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fileName: expect.stringMatching(/\.zip$/),
            fileSize: 5,
            mimeType: 'application/zip',
            fileExt: '.zip',
            type: 'file',
            creatorId: 'user-1',
            workspaceId: 'ws-1',
            spaceId: 'space-1',
            pageId: 'page-1',
          }),
          expect.objectContaining({
            fileName: expect.stringMatching(/\.svg$/),
            fileSize: 5,
            mimeType: 'image/svg+xml',
            fileExt: '.svg',
            type: 'file',
            creatorId: 'user-1',
            workspaceId: 'ws-1',
            spaceId: 'space-1',
            pageId: 'page-1',
          }),
        ]),
      );
    });

    it('uploads identical embedded payloads only once', async () => {
      const uri = dataUri('image/png', PNG_BASE64);
      const html = await run(`<img src="${uri}"><img src="${uri}">`);

      const ids = [...html.matchAll(/data-attachment-id="([^"]+)"/g)].map(
        (m) => m[1],
      );
      expect(ids).toHaveLength(2);
      expect(ids[0]).toBe(ids[1]);
      expect(storage.uploadStream).toHaveBeenCalledTimes(1);
      expect(inserted).toHaveLength(1);
    });
  });

  describe.only('invalid embedded sources', () => {
    it.each([
      ['invalid base64', 'data:image/png;base64,not*valid*base64!'],
      ['missing base64 flag', 'data:image/png,aGVsbG8='],
      ['missing mime type', 'data:;base64,aGVsbG8='],
      ['unsupported mime type', 'data:application/x-unknown-thing;base64,aGVsbG8='],
      ['empty payload', 'data:image/png;base64,'],
      ['missing comma', 'data:image/png;base64'],
    ])('skips %s', async (_label, uri) => {
      const html = await run(`<img src="${uri}">`);

      expect(html).toContain(uri);
      expect(storage.uploadStream).not.toHaveBeenCalled();
      expect(inserted).toHaveLength(0);
    });

    it('skips payloads over the upload size limit', async () => {
      uploadSizeLimit = '4b';
      const html = await run(`<img src="${dataUri('image/png')}">`);

      expect(html).toContain('data:image/png');
      expect(storage.uploadStream).not.toHaveBeenCalled();
      expect(inserted).toHaveLength(0);
    });

    it('imports payloads within the upload size limit', async () => {
      uploadSizeLimit = '6b';
      await run(`<img src="${dataUri('image/png')}">`);

      expect(storage.uploadStream).toHaveBeenCalledTimes(1);
      expect(inserted).toHaveLength(1);
    });

    it('does not fail the import when one valid and one invalid source are mixed', async () => {
      const html = await run(
        `<img src="data:image/png;base64,***"><img src="${dataUri('image/png', PNG_BASE64)}">`,
      );

      expect(html).toContain('data:image/png;base64,***');
      expect(storage.uploadStream).toHaveBeenCalledTimes(1);
      expect(inserted).toHaveLength(1);
    });

    it('ignores anchors and images that have no source', async () => {
      await expect(run('<a name="x">anchor</a><img>')).resolves.toContain(
        'anchor',
      );
      expect(storage.uploadStream).not.toHaveBeenCalled();
    });
  });

  describe('external URLs', () => {
    it('leaves http and https sources untouched', async () => {
      const html = await run(
        '<img src="https://example.com/a.png"><a href="http://example.com/b.pdf">b</a>' +
          '<iframe src="https://example.com/embed"></iframe>',
      );

      expect(html).toContain('https://example.com/a.png');
      expect(html).toContain('http://example.com/b.pdf');
      expect(html).toContain('<iframe src="https://example.com/embed">');
      expect(storage.uploadStream).not.toHaveBeenCalled();
      expect(inserted).toHaveLength(0);
    });
  });

  describe('upload failures', () => {
    it('does not throw when storage fails and does not insert a row', async () => {
      storage.uploadStream.mockRejectedValue(new Error('storage down'));

      await expect(
        run(`<img src="${dataUri('image/png', PNG_BASE64)}">`),
      ).resolves.toContain('/api/files/');
      expect(storage.uploadStream).toHaveBeenCalledTimes(2);
      expect(inserted).toHaveLength(0);
    });
  });

  describe('archive (relative path) sources', () => {
    let dir: string;
    let candidates: Map<string, string>;

    beforeEach(async () => {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), 'import-attachment-'));
      const imgPath = path.join(dir, 'pic.png');
      const pdfPath = path.join(dir, 'My File.pdf');
      await fs.writeFile(imgPath, Buffer.from(PNG_BASE64, 'base64'));
      await fs.writeFile(pdfPath, 'pdf-bytes');
      candidates = new Map([
        ['pic.png', imgPath],
        ['My File.pdf', pdfPath],
      ]);
    });

    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('uploads relative images and rewrites the src', async () => {
      const html = await run('<img src="pic.png">', {
        attachmentCandidates: candidates,
        extractDir: dir,
      });

      expect(html).toMatch(/src="\/api\/files\/[\w-]+\/pic\.png"/);
      expect(inserted[0]).toMatchObject({
        fileName: 'pic.png',
        mimeType: 'image/png',
        workspaceId: 'ws-1',
        pageId: 'page-1',
      });
    });

    it('uploads a repeated relative reference once', async () => {
      await run('<img src="pic.png"><img src="pic.png">', {
        attachmentCandidates: candidates,
        extractDir: dir,
      });

      expect(storage.uploadStream).toHaveBeenCalledTimes(1);
    });

    it('adds stat-based size after upload for relative files', async () => {
      const html = await run('<a href="My%20File.pdf">pdf</a>', {
        attachmentCandidates: candidates,
        extractDir: dir,
      });

      expect(html).toContain('data-type="pdf"');
      expect(html).toContain('data-size="9"');
    });


    it('handles relative and embedded sources on the same page', async () => {
      const html = await run(
        `<img src="pic.png"><img src="${dataUri('image/png', PNG_BASE64)}">`,
        { attachmentCandidates: candidates, extractDir: dir },
      );

      expect(html).not.toContain('data:image');
      expect(storage.uploadStream).toHaveBeenCalledTimes(2);
      expect(inserted).toHaveLength(2);
    });
  });
});
