import { HistoryProcessor } from './history.processor';
import { QueueJob } from '../../integrations/queue/constants';

const PAGE_ID = '01a14cce-0000-7000-8000-0000000000b1';

function paragraphDoc(text: string) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

const PAGE = {
  id: PAGE_ID,
  slugId: 'slug_1',
  title: 'Approved title',
  icon: null,
  coverPhoto: null,
  spaceId: 'space_1',
  workspaceId: 'ws_1',
  creatorId: 'user_creator',
  lastUpdatedById: 'user_approver',
  content: paragraphDoc('approved content'),
};

function makeProcessor(opts: { draft?: any; lastHistory?: any }) {
  const pageHistoryRepo = {
    findPageLastHistory: jest.fn(async () => opts.lastHistory),
    saveHistory: jest.fn(async () => undefined),
  };
  const pageRepo = { findById: jest.fn(async () => PAGE) };
  const pageDraftRepo = { findByPageId: jest.fn(async () => opts.draft) };
  const collabHistory = {
    popContributors: jest.fn(async () => ['user_editor']),
    addContributors: jest.fn(async () => undefined),
    clearContributors: jest.fn(async () => undefined),
  };
  const watcherService = { addPageWatchers: jest.fn(async () => undefined) };
  const notificationQueue = { add: jest.fn(async () => undefined) };
  const generalQueue = { add: jest.fn(async () => undefined) };

  const processor = new HistoryProcessor(
    pageHistoryRepo as any,
    pageRepo as any,
    collabHistory as any,
    watcherService as any,
    notificationQueue as any,
    generalQueue as any,
    pageDraftRepo as any,
  );

  return {
    processor,
    pageHistoryRepo,
    pageDraftRepo,
    watcherService,
    notificationQueue,
    generalQueue,
  };
}

function historyJob() {
  return { name: QueueJob.PAGE_HISTORY, data: { pageId: PAGE_ID } } as any;
}

describe('HistoryProcessor.process', () => {
  it('process snapshots the draft with kind draft and skips backlinks', async () => {
    const draftContent = paragraphDoc('draft content');
    const mocks = makeProcessor({
      draft: {
        pageId: PAGE_ID,
        title: 'Draft title',
        icon: null,
        content: draftContent,
        lastUpdatedById: 'user_editor',
      },
      lastHistory: { content: paragraphDoc('approved content') },
    });

    await mocks.processor.process(historyJob());

    expect(mocks.pageDraftRepo.findByPageId).toHaveBeenCalledWith(PAGE_ID, {
      includeContent: true,
    });
    expect(mocks.pageHistoryRepo.saveHistory).toHaveBeenCalledWith(PAGE, {
      contributorIds: ['user_editor'],
      kind: 'draft',
      override: {
        title: 'Draft title',
        icon: null,
        content: draftContent,
        lastUpdatedById: 'user_editor',
      },
    });
    expect(mocks.generalQueue.add).not.toHaveBeenCalled();
    expect(mocks.notificationQueue.add).not.toHaveBeenCalled();
  });

  it('skips a draft snapshot equal to the latest history row of any kind', async () => {
    const draftContent = paragraphDoc('submitted draft');
    const mocks = makeProcessor({
      draft: {
        pageId: PAGE_ID,
        title: null,
        icon: null,
        content: draftContent,
        lastUpdatedById: 'user_editor',
      },
      lastHistory: { kind: 'draft', content: paragraphDoc('submitted draft') },
    });

    await mocks.processor.process(historyJob());

    expect(mocks.pageHistoryRepo.saveHistory).not.toHaveBeenCalled();
  });

  it('keeps regular snapshots, backlinks and watcher notifications for pages without a draft', async () => {
    const mocks = makeProcessor({
      draft: undefined,
      lastHistory: { content: paragraphDoc('older content') },
    });

    await mocks.processor.process(historyJob());

    expect(mocks.pageHistoryRepo.saveHistory).toHaveBeenCalledWith(PAGE, {
      contributorIds: ['user_editor'],
    });
    expect(mocks.generalQueue.add).toHaveBeenCalledWith(
      QueueJob.PAGE_BACKLINKS,
      expect.objectContaining({ pageId: PAGE_ID }),
    );
    expect(mocks.notificationQueue.add).toHaveBeenCalledWith(
      QueueJob.PAGE_UPDATED,
      expect.objectContaining({ pageId: PAGE_ID, actorIds: ['user_editor'] }),
    );
  });
});
