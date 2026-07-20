import { HistoryProcessor } from './history.processor';
import { EventName } from '../../common/events/event.contants';

describe('HistoryProcessor content-updated event', () => {
  it('emits PAGE_CONTENT_UPDATED after saving a new history row', async () => {
    const savedHistory = { id: 'hist-1' };
    const page = {
      id: 'p1',
      spaceId: 's1',
      workspaceId: 'w1',
      content: { type: 'doc', content: [] },
    };
    const pageHistoryRepo = {
      findPageLastHistory: jest
        .fn()
        .mockResolvedValue({ content: { type: 'doc', content: [{ type: 'paragraph' }] } }),
      saveHistory: jest.fn().mockResolvedValue(savedHistory),
    };
    const pageRepo = { findById: jest.fn().mockResolvedValue(page) };
    const collabHistory = {
      popContributors: jest.fn().mockResolvedValue([]),
      addContributors: jest.fn(),
      clearContributors: jest.fn(),
    };
    const watcherService = { addPageWatchers: jest.fn() };
    const notificationQueue = { add: jest.fn() };
    const generalQueue = { add: jest.fn().mockReturnValue({ catch: jest.fn() }) };
    const eventEmitter = { emit: jest.fn() };

    const processor: any = new HistoryProcessor(
      pageHistoryRepo as any,
      pageRepo as any,
      collabHistory as any,
      watcherService as any,
      notificationQueue as any,
      generalQueue as any,
      eventEmitter as any,
    );

    await processor.process({ name: 'page-history', data: { pageId: 'p1' } } as any);

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      EventName.PAGE_CONTENT_UPDATED,
      { pageId: 'p1', spaceId: 's1', workspaceId: 'w1', historyId: 'hist-1' },
    );
  });
});
