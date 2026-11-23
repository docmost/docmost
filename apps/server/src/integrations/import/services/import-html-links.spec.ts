import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FileTask } from '@docmost/db/types/entity.types';
import { ImportAttachmentService } from './import-attachment.service';
import { ImportService } from './import.service';
import { formatImportHtml } from '../utils/import-formatter';

jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => (task: () => Promise<void>) => task(),
}));
jest.mock('@sindresorhus/slugify', () => ({
  __esModule: true,
  default: (title: string) => title.toLowerCase(),
}));

describe('HTML provider links', () => {
  const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

  it('embeds a URL on its own line and preserves ordinary links within prose', async () => {
    const doc = await ImportService.prototype.processHTML(
      `<p><a href="${url}">${url}</a></p>` +
        `<p>Watch <strong><a href="${url}">${url}</a></strong> first.</p>` +
        `<p><a href="${url}">Watch the guide</a></p>`,
    );
    expect(doc.content.filter((node) => node.type === 'embed')).toHaveLength(1);
    const sentences = doc.content.filter(
      (node) => node.type === 'paragraph' && node.content,
    );
    expect(sentences[0].content.map((node) => node.text).join('')).toBe(
      `Watch ${url} first.`,
    );
    expect(sentences[0].content[1].marks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'link',
          attrs: expect.objectContaining({ href: url }),
        }),
        { type: 'bold' },
      ]),
    );
    expect(sentences[1].content).toMatchObject([
      { text: 'Watch the guide', marks: [{ type: 'link' }] },
    ]);
  });
});

it('preserves a link destination in the first heading of imported HTML', async () => {
  const doc = await ImportService.prototype.processHTML(
    '<h1>Guide<span data-type="section-anchor" data-id="intro"></span></h1>' +
      '<p><a href="#intro">Back to the start</a></p>',
  );
  const { prosemirrorJson } =
    ImportService.prototype.extractTitleAndRemoveHeading(doc);
  expect(prosemirrorJson.content).toMatchObject([
    {
      type: 'heading',
      content: [
        { text: 'Guide' },
        { type: 'sectionAnchor', attrs: { id: 'intro' } },
      ],
    },
    {
      type: 'paragraph',
      content: [{ marks: [{ type: 'link', attrs: { href: '#intro' } }] }],
    },
  ]);
});

describe('linked images in HTML archives', () => {
  let extractDir: string;
  const fileTask = {
    workspaceId: 'workspace',
    spaceId: 'space',
    creatorId: 'user',
  } as FileTask;
  const pages = new Map([
    ['guide.html', { id: 'target', slugId: 'slug', title: 'Guide' }],
  ]);

  beforeAll(async () => {
    extractDir = await mkdtemp(join(tmpdir(), 'docmost-linked-image-'));
    await writeFile(join(extractDir, 'tile.png'), 'image fixture');
    await writeFile(join(extractDir, 'manual.pdf'), 'linked file');
  });

  afterAll(() => rm(extractDir, { recursive: true, force: true }));

  async function importArchiveHtml(html: string) {
    const result = await formatImportHtml({
      html,
      currentFilePath: 'home.html',
      filePathToPageMetaMap: pages,
      creatorId: 'user',
      sourcePageId: 'home',
      workspaceId: 'workspace',
    });
    const service = new ImportAttachmentService(null, null, null);
    jest.spyOn(service as any, 'uploadWithRetry').mockResolvedValue(undefined);
    const withFiles = await service.processAttachments({
      html: result.html,
      pageRelativePath: 'home.html',
      extractDir,
      pageId: 'home',
      fileTask,
      attachmentCandidates: new Map(
        ['tile.png', 'manual.pdf'].map((name) => [
          name,
          join(extractDir, name),
        ]),
      ),
    });
    return ImportService.prototype.processHTML(withFiles);
  }

  it('keeps a local image linked to a page and preserves the surrounding words', async () => {
    const doc = await importArchiveHtml(
      '<p>Before <a href="guide.html"><img src="tile.png" alt="Read" width="40"></a> after.</p>',
    );
    expect(doc.content).toMatchObject([
      { type: 'paragraph', content: [{ text: 'Before' }] },
      {
        type: 'image',
        attrs: {
          src: expect.stringMatching(/^\/api\/files\//),
          href: '/p/guide-slug',
          alt: 'Read',
        },
      },
      { type: 'paragraph', content: [{ text: ' after.' }] },
    ]);
  });

  it('keeps both the image and its linked caption when the caption matches the target page title', async () => {
    const doc = await importArchiveHtml(
      '<a href="guide.html"><img src="tile.png" width="40">Guide</a>',
    );
    expect(doc.content).toMatchObject([
      { type: 'image', attrs: { href: '/p/guide-slug' } },
      {
        type: 'paragraph',
        content: [
          {
            text: 'Guide',
            marks: [{ type: 'link', attrs: { href: '/p/guide-slug' } }],
          },
        ],
      },
    ]);
  });

  it.each([
    ['https://docs.example/guide', 'https://docs.example/guide'],
    ['manual.pdf', expect.stringMatching(/^\/api\/files\/.+\/manual\.pdf$/)],
  ])('preserves an image linked to %s', async (source, target) => {
    const doc = await importArchiveHtml(
      `<p><a href="${source}"><img src="tile.png" width="40"></a></p>`,
    );
    expect(doc.content).toMatchObject([
      {
        type: 'image',
        attrs: { src: expect.stringMatching(/^\/api\/files\//), href: target },
      },
    ]);
  });
});
