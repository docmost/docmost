import {
  CamelCasePlugin,
  CompiledQuery,
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { ExportFormat } from './dto/export-dto';
import { ExportService } from './export.service';
import { updateAttachmentUrlsToLocalPaths } from './utils';

jest.mock('@sindresorhus/slugify', () => ({
  __esModule: true,
  default: (text: string) => text.toLowerCase().replace(/\s+/g, '-'),
}));

const WORKSPACE_ID = '019a4f3e-0000-7000-8000-000000000001';
const USER_ID = '019a4f3e-0000-7000-8000-000000000002';
const SPACE_ID = '019a4f3e-0000-7000-8000-000000000003';
const SOURCE_PAGE_ID = '019a4f3e-0000-7000-8000-000000000004';
const MENTIONED_PAGE_ID = '019a4f3e-0000-7000-8000-000000000005';
const AUDIO_FILE_ID = '019a4f3e-0000-7000-8000-000000000006';
const PDF_FILE_ID = '019a4f3e-0000-7000-8000-000000000007';
const BASE_URL = 'https://docs.example.com';

function pageMention(entityId: string, label: string) {
  return {
    type: 'mention',
    attrs: {
      id: `mention-${label}`,
      label,
      entityType: 'page',
      entityId,
      slugId: 'storedslug',
    },
  };
}

function docWith(...mentions: object[]) {
  return { type: 'doc', content: [{ type: 'paragraph', content: mentions }] };
}

// answers every pages select with the mentioned page, everything else with no rows
function buildService(opts: { accessiblePageIds: string[]; content?: object }) {
  const queries: CompiledQuery[] = [];
  const driver = new DummyDriver();
  driver.acquireConnection = async () =>
    ({
      executeQuery: async (query: CompiledQuery) => ({
        rows: query.sql.includes('from "pages"')
          ? [
              {
                id: MENTIONED_PAGE_ID,
                slug_id: 'liveslug',
                title: 'Live title',
                creator_id: USER_ID,
                space_id: SPACE_ID,
                workspace_id: WORKSPACE_ID,
                space: { id: SPACE_ID, name: 'Private', slug: 'private' },
              },
            ]
          : [],
      }),
      streamQuery: async function* () {},
    }) as any;
  const db = new Kysely<any>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver,
      createIntrospector: (kysely) => new PostgresIntrospector(kysely),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [new CamelCasePlugin()],
    log: (event) => {
      if (event.level === 'query') queries.push(event.query);
    },
  });

  const sourcePage = {
    id: SOURCE_PAGE_ID,
    slugId: 'sourceslug',
    title: 'Source',
    spaceId: SPACE_ID,
    workspaceId: WORKSPACE_ID,
    parentPageId: null,
    content:
      opts.content ?? docWith(pageMention(MENTIONED_PAGE_ID, 'Stored label')),
  };
  const pageRepo = {
    findById: jest.fn().mockResolvedValue(sourcePage),
    withSpace: (eb: any) => PageRepo.prototype.withSpace(eb),
  };
  const pagePermissionRepo = {
    filterAccessiblePageIds: jest.fn(
      async ({ pageIds }: { pageIds: string[] }) =>
        pageIds.filter(
          (id) => id === SOURCE_PAGE_ID || opts.accessiblePageIds.includes(id),
        ),
    ),
  };
  const spaceMemberRepo = new SpaceMemberRepo(
    db as any,
    {} as any,
    {} as any,
    {} as any,
  );
  const domainService = { getUrl: () => BASE_URL };
  const service = new ExportService(
    pageRepo as any,
    pagePermissionRepo as any,
    db as any,
    {} as any,
    {} as any,
    domainService as any,
    spaceMemberRepo,
    { findActiveNamesByIds: async () => [] } as any,
  );
  return { service, queries, pagePermissionRepo };
}

it.each([ExportFormat.HTML, ExportFormat.Markdown])(
  'exports label blocks as headings in %s',
  async (format) => {
    const { service } = buildService({ accessiblePageIds: [] });
    const page = {
      content: {
        type: 'doc',
        content: [
          {
            type: 'itemsByLabel',
            attrs: { labels: ['private-tag'], heading: 'Field guides' },
          },
          { type: 'itemsByLabel', attrs: { labels: ['private-tag'] } },
        ],
      },
    };

    const exported = await service.exportPage(format, page as any);
    expect(exported).toContain('Field guides');
    expect(exported).toContain('Pages by label');
    expect(exported).not.toMatch(/private-tag|data-config/);
  },
);

async function exportSinglePage(service: ExportService) {
  const result = await service.exportPages(
    SOURCE_PAGE_ID,
    ExportFormat.HTML,
    false,
    false,
    USER_ID,
  );
  if (result.type !== 'file') throw new Error('expected a single file');
  return result.content;
}

function mentionLookup(queries: CompiledQuery[]) {
  return queries.find((query) => query.sql.includes('from "pages"'));
}

describe('ExportService page mentions', () => {
  it('links a mentioned page the user can open with its current title', async () => {
    const { service } = buildService({ accessiblePageIds: [MENTIONED_PAGE_ID] });

    const html = await exportSinglePage(service);

    expect(html).toContain(`href="${BASE_URL}/s/private/p/live-title-liveslug"`);
    expect(html).toContain('Live title');
  });

  it('keeps the stored label in a single-page export when the user cannot open the mentioned page', async () => {
    const { service } = buildService({ accessiblePageIds: [] });

    const html = await exportSinglePage(service);

    expect(html).toContain('Stored label');
    expect(html).not.toContain('Live title');
    expect(html).not.toContain('/s/private/');
  });

  it("limits the mention lookup to live pages in the user's spaces", async () => {
    const { service, queries } = buildService({
      accessiblePageIds: [MENTIONED_PAGE_ID],
    });

    await service.turnPageMentionsToLinks(
      docWith(pageMention(MENTIONED_PAGE_ID, 'Stored label')),
      WORKSPACE_ID,
      BASE_URL,
      USER_ID,
    );

    const lookup = mentionLookup(queries);
    expect(lookup.sql).toContain('"deleted_at" is null');
    expect(lookup.sql).toContain('from "space_members"');
    expect(lookup.parameters).toContain(USER_ID);
  });

  it('skips page mentions without a valid page id', async () => {
    const { service, queries, pagePermissionRepo } = buildService({
      accessiblePageIds: [MENTIONED_PAGE_ID],
    });

    const json = await service.turnPageMentionsToLinks(
      docWith(
        pageMention('not-a-page-id', 'Broken'),
        pageMention(MENTIONED_PAGE_ID, 'Stored label'),
      ),
      WORKSPACE_ID,
      BASE_URL,
      USER_ID,
    );

    expect(mentionLookup(queries).parameters).not.toContain('not-a-page-id');
    for (const [args] of pagePermissionRepo.filterAccessiblePageIds.mock.calls) {
      expect(args.pageIds).not.toContain('not-a-page-id');
    }
    expect(JSON.stringify(json)).toContain('Live title');
  });
});

describe('ExportService unknown nodes', () => {
  it('leaves out a node type the schema does not know in a single-page export', async () => {
    const { service } = buildService({
      accessiblePageIds: [],
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Before' }] },
          { type: 'legacyWidget', attrs: { src: 'widget' } },
          { type: 'paragraph', content: [{ type: 'text', text: 'After' }] },
        ],
      },
    });

    const html = await exportSinglePage(service);

    expect(html).toMatch(/>Before<\/p><p[^>]*>After<\/p>/);
  });
});

describe('ExportService audio blocks', () => {
  const audioDoc = {
    type: 'doc',
    content: [
      {
        type: 'audio',
        attrs: {
          src: `/api/files/${AUDIO_FILE_ID}/standup.mp3`,
          name: 'standup.mp3',
          attachmentId: AUDIO_FILE_ID,
        },
      },
    ],
  };

  it.each([
    [ExportFormat.Markdown, `[standup.mp3](files/${AUDIO_FILE_ID}/standup.mp3)`],
    [ExportFormat.HTML, `src="files/${AUDIO_FILE_ID}/standup.mp3"`],
  ])(
    'keeps the audio file link in a %s export that includes attachments',
    async (format, expected) => {
      const { service } = buildService({ accessiblePageIds: [] });

      const exported = await service.exportPage(format, {
        title: '',
        content: updateAttachmentUrlsToLocalPaths(audioDoc),
      } as any);

      expect(exported).toContain(expected);
    },
  );
});

describe('ExportService pdf blocks', () => {
  const pdfDoc = {
    type: 'doc',
    content: [
      {
        type: 'pdf',
        attrs: {
          src: `/api/files/${PDF_FILE_ID}/Q3_report.pdf`,
          name: 'Q3_report.pdf',
          attachmentId: PDF_FILE_ID,
        },
      },
    ],
  };

  it.each([
    [ExportFormat.Markdown, `[Q3_report.pdf](files/${PDF_FILE_ID}/Q3_report.pdf)`],
    [ExportFormat.HTML, `<iframe src="files/${PDF_FILE_ID}/Q3_report.pdf"`],
  ])(
    'keeps the pdf file link in a %s export that includes attachments',
    async (format, expected) => {
      const { service } = buildService({ accessiblePageIds: [] });

      const exported = await service.exportPage(format, {
        title: '',
        content: updateAttachmentUrlsToLocalPaths(pdfDoc),
      } as any);

      expect(exported).toContain(expected);
    },
  );

  it('names an unnamed pdf link after its file, without the query string', async () => {
    const { service } = buildService({ accessiblePageIds: [] });
    const src = `/api/files/${PDF_FILE_ID}/Q3_report.pdf?jwt=abc.def`;

    const markdown = await service.exportPage(ExportFormat.Markdown, {
      title: '',
      content: {
        type: 'doc',
        content: [{ type: 'pdf', attrs: { src, attachmentId: PDF_FILE_ID } }],
      },
    } as any);

    expect(markdown).toContain(`[Q3_report.pdf](${src})`);
  });

  it('leaves out a pdf that is not a Docmost file', async () => {
    const { service } = buildService({ accessiblePageIds: [] });
    const page = {
      title: '',
      content: {
        type: 'doc',
        content: [
          {
            type: 'pdf',
            attrs: {
              src: 'https://example.com/files/report.pdf',
              attachmentId: PDF_FILE_ID,
            },
          },
        ],
      },
    } as any;

    const html = await service.exportPage(ExportFormat.HTML, page);
    const markdown = await service.exportPage(ExportFormat.Markdown, page);

    expect(html).not.toContain('example.com');
    expect(markdown.trim()).toBe('');
  });
});
