import { PageContentUpdatedListener } from './page-content-updated.listener';

describe('PageContentUpdatedListener', () => {
  it('creates a new draft verification row and notifies previous verifiers when an approved page changes', async () => {
    const previous = {
      id: 'pv1',
      pageId: 'p1',
      workspaceId: 'w1',
      spaceId: 's1',
      status: 'approved',
      type: 'qms',
      creatorId: 'u1',
    };
    const verifiers = [{ id: 'v1' }, { id: 'v2' }];
    const pageVerificationRepo = {
      findLatestByPageId: jest.fn().mockResolvedValue(previous),
      getVerifiers: jest.fn().mockResolvedValue(verifiers),
      insert: jest.fn().mockResolvedValue({ id: 'pv2' }),
      replaceVerifiers: jest.fn(),
    };
    const notificationQueue = { add: jest.fn() };

    const listener = new PageContentUpdatedListener(
      pageVerificationRepo as any,
      notificationQueue as any,
    );

    await listener.handle({
      pageId: 'p1',
      spaceId: 's1',
      workspaceId: 'w1',
      historyId: 'hist-2',
    });

    expect(pageVerificationRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        pageId: 'p1',
        status: 'draft',
        pageHistoryId: 'hist-2',
        type: 'qms',
      }),
    );
    expect(notificationQueue.add).toHaveBeenCalledWith(
      'page-reverification-required-notification',
      expect.objectContaining({ pageId: 'p1', verifierIds: ['v1', 'v2'] }),
    );
  });

  it('does nothing when the latest verification is not approved', async () => {
    const pageVerificationRepo = {
      findLatestByPageId: jest.fn().mockResolvedValue({ status: 'draft' }),
      insert: jest.fn(),
    };
    const notificationQueue = { add: jest.fn() };
    const listener = new PageContentUpdatedListener(
      pageVerificationRepo as any,
      notificationQueue as any,
    );

    await listener.handle({ pageId: 'p1', spaceId: 's1', workspaceId: 'w1', historyId: 'h1' });

    expect(pageVerificationRepo.insert).not.toHaveBeenCalled();
  });
});
