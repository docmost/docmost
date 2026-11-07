import { PageService } from './page.service';
import { QueueJob } from '../../../integrations/queue/constants';

const USER_ID = '019a1f00-0000-7000-8000-000000000001';
const WORKSPACE_ID = '019a1f00-0000-7000-8000-000000000002';
const SPACE_ID = '019a1f00-0000-7000-8000-000000000003';
const PAGE_ID = '019a1f00-0000-7000-8000-000000000004';

function makeService() {
  const pageRepo = {
    insertPage: jest.fn(async (page: any) => ({ ...page, id: PAGE_ID })),
  };
  const generalQueue = { add: jest.fn(async () => undefined) };
  const collaborationGateway = {
    handleYjsEvent: jest.fn(async () => undefined),
  };
  const watcherService = { addPageWatchers: jest.fn(async () => undefined) };

  const service = new PageService(
    pageRepo as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    generalQueue as any,
    {} as any,
    collaborationGateway as any,
    watcherService as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  jest
    .spyOn(service, 'nextPagePosition')
    .mockImplementation(async () => 'a0abc');

  return { service, generalQueue, collaborationGateway, watcherService };
}

function findLinkMarks(node: any): any[] {
  return [
    ...(node.marks ?? []).filter((mark: any) => mark.type === 'link'),
    ...(node.content ?? []).flatMap(findLinkMarks),
  ];
}

describe('PageService content links', () => {
  async function writeContent(content: string, format: 'markdown' | 'html') {
    const { service, collaborationGateway } = makeService();
    await service.updatePageContent(
      PAGE_ID,
      content,
      'replace' as any,
      format,
      {
        id: USER_ID,
      } as any,
    );
    const [, , payload] = collaborationGateway.handleYjsEvent.mock
      .calls[0] as any[];
    return findLinkMarks(payload.prosemirrorJson);
  }

  it('stores markdown links to page paths as internal links', async () => {
    const [link] = await writeContent(
      '[Some page](/s/infrastructure/p/some-page-abc123)',
      'markdown',
    );

    expect(link.attrs.href).toBe('/s/infrastructure/p/some-page-abc123');
    expect(link.attrs.internal).toBe(true);
  });

  it('stores html links to page paths as internal links', async () => {
    const [link] = await writeContent(
      '<p><a href="/s/infrastructure/p/abc123">Some page</a></p>',
      'html',
    );

    expect(link.attrs.internal).toBe(true);
  });

  it('finds links nested in other blocks', async () => {
    const links = await writeContent(
      '- item with [a page](/s/docs/p/abc123)\n\n> quote with [another](/s/docs/p/def456)',
      'markdown',
    );

    expect(links.map((link) => link.attrs.internal)).toEqual([true, true]);
  });

  it.each([
    'https://example.com/s/docs/p/abc123',
    'https://example.com/p/abc123',
    'https://example.com/docs',
    '/s/docs/settings',
  ])('keeps %s as an external link', async (href) => {
    const [link] = await writeContent(`[Link](${href})`, 'markdown');

    expect(link.attrs.href).toBe(href);
    expect(link.attrs.internal).toBe(false);
  });

  it('does not change the internal flag of json content', async () => {
    const link = {
      type: 'link',
      attrs: { href: '/s/docs/p/abc123', internal: false },
    };
    const { service, collaborationGateway } = makeService();

    await service.updatePageContent(
      PAGE_ID,
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Link', marks: [link] }],
          },
        ],
      },
      'replace' as any,
      'json' as any,
      { id: USER_ID } as any,
    );

    const [, , payload] = collaborationGateway.handleYjsEvent.mock
      .calls[0] as any[];
    expect(findLinkMarks(payload.prosemirrorJson)[0].attrs.internal).toBe(
      false,
    );
  });
});

describe('PageService create backlinks', () => {
  function backlinkJobs(generalQueue: { add: jest.Mock }) {
    return generalQueue.add.mock.calls.filter(
      ([name]) => name === QueueJob.PAGE_BACKLINKS,
    );
  }

  const pageDto = {
    title: 'Page',
    spaceId: SPACE_ID,
    format: 'markdown',
  } as any;

  it('queues backlinks for the links in the initial content', async () => {
    const { service, generalQueue } = makeService();

    await service.create(USER_ID, WORKSPACE_ID, {
      ...pageDto,
      content: '[Some page](/s/docs/p/some-page-abc123)',
    });

    expect(backlinkJobs(generalQueue)).toEqual([
      [
        QueueJob.PAGE_BACKLINKS,
        {
          pageId: PAGE_ID,
          workspaceId: WORKSPACE_ID,
          mentions: [],
          internalLinkSlugIds: ['abc123'],
        },
      ],
    ]);
  });

  it('queues backlinks for page mentions in the initial content', async () => {
    const { service, generalQueue } = makeService();
    const targetPageId = '019a1f00-0000-7000-8000-000000000005';

    await service.create(USER_ID, WORKSPACE_ID, {
      ...pageDto,
      format: 'json',
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'mention',
                attrs: {
                  id: '019a1f00-0000-7000-8000-000000000006',
                  label: 'Target',
                  entityType: 'page',
                  entityId: targetPageId,
                },
              },
            ],
          },
        ],
      },
    });

    const [[, job]] = backlinkJobs(generalQueue);
    expect(job.mentions.map((mention: any) => mention.entityId)).toEqual([
      targetPageId,
    ]);
  });

  it('does not queue backlinks for a page without content', async () => {
    const { service, generalQueue } = makeService();

    await service.create(USER_ID, WORKSPACE_ID, {
      title: 'Page',
      spaceId: SPACE_ID,
    } as any);

    expect(backlinkJobs(generalQueue)).toEqual([]);
  });

  it('does not queue backlinks before a caller transaction commits', async () => {
    const { service, generalQueue, watcherService } = makeService();

    await service.create(
      USER_ID,
      WORKSPACE_ID,
      { ...pageDto, content: '[Some page](/s/docs/p/abc123)' },
      {} as any,
    );

    expect(watcherService.addPageWatchers).toHaveBeenCalled();
    expect(backlinkJobs(generalQueue)).toEqual([]);
  });
});
