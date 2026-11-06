import { PageHistoryRecorderService } from './page-history-recorder.service';
import { QueueJob } from '../../integrations/queue/constants';

const emptyDoc = { type: 'doc', content: [{ type: 'paragraph' }] };
const textDoc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('PageHistoryRecorderService', () => {
  let historyRepo: any;
  let pageRepo: any;
  let collabHistory: any;
  let watcherService: any;
  let notificationQueue: any;
  let generalQueue: any;
  let service: PageHistoryRecorderService;

  const page = (over: any = {}) => ({
    id: 'page-1',
    spaceId: 'space-1',
    workspaceId: 'ws-1',
    title: 'Title',
    content: textDoc('hello'),
    ...over,
  });

  beforeEach(() => {
    historyRepo = {
      findPageLastHistory: jest.fn(),
      saveHistory: jest.fn().mockResolvedValue({ id: 'new-history' }),
    };
    pageRepo = { findById: jest.fn() };
    collabHistory = {
      popContributors: jest.fn().mockResolvedValue(['u1']),
      addContributors: jest.fn().mockResolvedValue(undefined),
      clearContributors: jest.fn().mockResolvedValue(undefined),
    };
    watcherService = {
      addPageWatchers: jest.fn().mockResolvedValue(undefined),
    };
    notificationQueue = { add: jest.fn().mockResolvedValue(undefined) };
    generalQueue = { add: jest.fn().mockResolvedValue(undefined) };
    service = new PageHistoryRecorderService(
      historyRepo,
      pageRepo,
      collabHistory,
      watcherService,
      notificationQueue,
      generalQueue,
    );
  });

  it('reuses the latest version when content and title are equal', async () => {
    pageRepo.findById.mockResolvedValue(page());
    historyRepo.findPageLastHistory.mockResolvedValue({
      id: 'last',
      title: 'Title',
      content: textDoc('hello'),
    });

    await expect(service.recordPageHistory('page-1')).resolves.toBe('last');
    expect(historyRepo.saveHistory).not.toHaveBeenCalled();
    expect(collabHistory.popContributors).not.toHaveBeenCalled();
  });

  it('inserts a version when the content changed', async () => {
    pageRepo.findById.mockResolvedValue(page());
    historyRepo.findPageLastHistory.mockResolvedValue({
      id: 'last',
      title: 'Title',
      content: textDoc('old'),
    });

    await expect(service.recordPageHistory('page-1')).resolves.toBe(
      'new-history',
    );
    expect(historyRepo.saveHistory).toHaveBeenCalledWith(expect.anything(), {
      contributorIds: ['u1'],
    });
    expect(watcherService.addPageWatchers).toHaveBeenCalledWith(
      ['u1'],
      'page-1',
      'space-1',
      'ws-1',
    );
    expect(generalQueue.add).toHaveBeenCalledWith(
      QueueJob.PAGE_BACKLINKS,
      expect.objectContaining({ pageId: 'page-1', workspaceId: 'ws-1' }),
    );
  });

  it('inserts a version when only the title changed', async () => {
    pageRepo.findById.mockResolvedValue(page({ title: 'New title' }));
    historyRepo.findPageLastHistory.mockResolvedValue({
      id: 'last',
      title: 'Title',
      content: textDoc('hello'),
    });

    await expect(service.recordPageHistory('page-1')).resolves.toBe(
      'new-history',
    );
    expect(historyRepo.saveHistory).toHaveBeenCalledTimes(1);
  });

  it('skips an empty first version by default', async () => {
    pageRepo.findById.mockResolvedValue(page({ content: emptyDoc }));
    historyRepo.findPageLastHistory.mockResolvedValue(undefined);

    await expect(service.recordPageHistory('page-1')).resolves.toBeNull();
    expect(collabHistory.clearContributors).toHaveBeenCalledWith('page-1');
    expect(historyRepo.saveHistory).not.toHaveBeenCalled();
  });

  it('records an empty first version with allowEmpty', async () => {
    pageRepo.findById.mockResolvedValue(page({ content: emptyDoc }));
    historyRepo.findPageLastHistory.mockResolvedValue(undefined);

    await expect(
      service.recordPageHistory('page-1', { allowEmpty: true }),
    ).resolves.toBe('new-history');
    expect(historyRepo.saveHistory).toHaveBeenCalledTimes(1);
  });

  it('puts contributors back when the insert fails', async () => {
    pageRepo.findById.mockResolvedValue(page());
    historyRepo.findPageLastHistory.mockResolvedValue(undefined);
    historyRepo.saveHistory.mockRejectedValue(new Error('boom'));

    await expect(service.recordPageHistory('page-1')).rejects.toThrow('boom');
    expect(collabHistory.addContributors).toHaveBeenCalledWith('page-1', [
      'u1',
    ]);
  });

  it('returns null for a missing page', async () => {
    pageRepo.findById.mockResolvedValue(undefined);

    await expect(service.recordPageHistory('page-1')).resolves.toBeNull();
    expect(collabHistory.clearContributors).toHaveBeenCalledWith('page-1');
    expect(historyRepo.saveHistory).not.toHaveBeenCalled();
  });

  it('queues the page updated notification only with contributors and a previous version', async () => {
    pageRepo.findById.mockResolvedValue(page());

    historyRepo.findPageLastHistory.mockResolvedValue(undefined);
    await service.recordPageHistory('page-1');
    expect(notificationQueue.add).not.toHaveBeenCalled();

    historyRepo.findPageLastHistory.mockResolvedValue({
      id: 'last',
      title: 'Title',
      content: textDoc('old'),
    });
    collabHistory.popContributors.mockResolvedValue([]);
    await service.recordPageHistory('page-1');
    expect(notificationQueue.add).not.toHaveBeenCalled();

    collabHistory.popContributors.mockResolvedValue(['u1']);
    await service.recordPageHistory('page-1');
    expect(notificationQueue.add).toHaveBeenCalledWith(
      QueueJob.PAGE_UPDATED,
      expect.objectContaining({ pageId: 'page-1', actorIds: ['u1'] }),
    );
  });
});
