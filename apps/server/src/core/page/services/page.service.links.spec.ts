import { PageService } from './page.service';
import { QueueJob } from '../../../integrations/queue/constants';

const USER_ID = '019a1f00-0000-7000-8000-000000000001';
const WORKSPACE_ID = '019a1f00-0000-7000-8000-000000000002';
const SPACE_ID = '019a1f00-0000-7000-8000-000000000003';
const PAGE_ID = '019a1f00-0000-7000-8000-000000000004';
const TARGET_SLUG_ID = 'a1B2c3D4e5';

describe('PageService content with page links', () => {
  function makeService() {
    const pageRepo = {
      insertPage: jest.fn(async (page: any) => ({ ...page, id: PAGE_ID })),
    };
    const generalQueue = {
      add: jest.fn(async (..._args: any[]) => undefined),
    };
    const watcherService = {
      addPageWatchers: jest.fn(async () => undefined),
    };
    const collaborationGateway = {
      handleYjsEvent: jest.fn(async (..._args: any[]) => undefined),
    };

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
      {} as any,
      {} as any,
    );
    jest.spyOn(service, 'nextPagePosition').mockResolvedValue('a0');

    return { service, pageRepo, generalQueue, collaborationGateway };
  }

  function backlinkJobs(generalQueue: { add: jest.Mock }) {
    return generalQueue.add.mock.calls.filter(
      ([name]) => name === QueueJob.PAGE_BACKLINKS,
    );
  }

  function firstLinkMark(content: any) {
    return content.content[0].content.find((node: any) => node.marks)?.marks[0];
  }

  it('stores markdown page links as internal links', async () => {
    const { service, pageRepo } = makeService();

    await service.create(USER_ID, WORKSPACE_ID, {
      spaceId: SPACE_ID,
      title: 'Overview',
      format: 'markdown',
      content: `See [the runbook](/s/engineering/p/runbook-${TARGET_SLUG_ID}).`,
    } as any);

    const { content } = pageRepo.insertPage.mock.calls[0][0];
    expect(firstLinkMark(content).attrs).toMatchObject({
      href: `/s/engineering/p/runbook-${TARGET_SLUG_ID}`,
      internal: true,
    });
  });

  it('stores html page links as internal links', async () => {
    const { service, pageRepo } = makeService();

    await service.create(USER_ID, WORKSPACE_ID, {
      spaceId: SPACE_ID,
      title: 'Overview',
      format: 'html',
      content: `<p><a href="/s/engineering/p/runbook-${TARGET_SLUG_ID}">runbook</a></p>`,
    } as any);

    const { content } = pageRepo.insertPage.mock.calls[0][0];
    expect(firstLinkMark(content).attrs.internal).toBe(true);
  });

  it('keeps links to other sites external', async () => {
    const { service, pageRepo, generalQueue } = makeService();

    await service.create(USER_ID, WORKSPACE_ID, {
      spaceId: SPACE_ID,
      title: 'Overview',
      format: 'markdown',
      content: 'See [the guide](https://example.com/guide).',
    } as any);

    const { content } = pageRepo.insertPage.mock.calls[0][0];
    expect(firstLinkMark(content).attrs.internal).toBe(false);
    expect(backlinkJobs(generalQueue)).toHaveLength(0);
  });

  it('queues backlinks for page links in the initial content', async () => {
    const { service, generalQueue } = makeService();

    await service.create(USER_ID, WORKSPACE_ID, {
      spaceId: SPACE_ID,
      title: 'Overview',
      format: 'markdown',
      content: `See [the runbook](/s/engineering/p/runbook-${TARGET_SLUG_ID}#rollback).`,
    } as any);

    expect(backlinkJobs(generalQueue)).toEqual([
      [
        QueueJob.PAGE_BACKLINKS,
        {
          pageId: PAGE_ID,
          workspaceId: WORKSPACE_ID,
          mentions: [],
          internalLinkSlugIds: [TARGET_SLUG_ID],
        },
      ],
    ]);
  });

  it('queues backlinks for page mentions in json content', async () => {
    const { service, generalQueue } = makeService();
    const mention = {
      id: '019a1f00-0000-7000-8000-000000000010',
      label: 'Runbook',
      entityType: 'page',
      entityId: '019a1f00-0000-7000-8000-000000000011',
      slugId: TARGET_SLUG_ID,
      creatorId: USER_ID,
    };

    await service.create(USER_ID, WORKSPACE_ID, {
      spaceId: SPACE_ID,
      title: 'Overview',
      format: 'json',
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'mention', attrs: mention }] },
        ],
      },
    } as any);

    const jobs = backlinkJobs(generalQueue);
    expect(jobs).toHaveLength(1);
    expect(jobs[0][1].mentions).toEqual([
      expect.objectContaining({ entityId: mention.entityId }),
    ]);
  });

  it('does not queue backlinks inside a caller transaction', async () => {
    const { service, generalQueue } = makeService();

    await service.create(
      USER_ID,
      WORKSPACE_ID,
      {
        spaceId: SPACE_ID,
        title: 'Overview',
        format: 'markdown',
        content: `See [the runbook](/s/engineering/p/runbook-${TARGET_SLUG_ID}).`,
      } as any,
      {} as any,
    );

    expect(backlinkJobs(generalQueue)).toHaveLength(0);
  });

  it('flags page links in markdown sent to an existing page', async () => {
    const { service, collaborationGateway } = makeService();

    await service.updatePageContent(
      PAGE_ID,
      `See [the runbook](/s/engineering/p/runbook-${TARGET_SLUG_ID}).`,
      'append' as any,
      'markdown',
      { id: USER_ID } as any,
    );

    const [, , payload] = collaborationGateway.handleYjsEvent.mock.calls[0];
    expect(firstLinkMark(payload.prosemirrorJson).attrs.internal).toBe(true);
  });
});
