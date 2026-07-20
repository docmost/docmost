import { PageContentUpdatedListener } from './page-content-updated.listener';

// Fake Kysely db matching the mocking pattern used in
// page-verification.service.spec.ts: `executeTx` calls
// `db.transaction().execute(cb)`, so a fake db just needs a `.transaction()`
// method whose `.execute(cb)` invokes `cb(trx)` with a fake trx object.
function createFakeDb() {
  const trx = { __fakeTrx: true };
  const db = {
    transaction: () => ({
      execute: (cb: (trx: unknown) => Promise<unknown>) => cb(trx),
    }),
  };
  return { db, trx };
}

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
    const { db } = createFakeDb();

    const listener = new PageContentUpdatedListener(
      pageVerificationRepo as any,
      db as any,
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
      expect.anything(),
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
    const { db } = createFakeDb();
    const listener = new PageContentUpdatedListener(
      pageVerificationRepo as any,
      db as any,
      notificationQueue as any,
    );

    await listener.handle({ pageId: 'p1', spaceId: 's1', workspaceId: 'w1', historyId: 'h1' });

    expect(pageVerificationRepo.insert).not.toHaveBeenCalled();
  });

  it('passes the same transaction object to insert and replaceVerifiers so they commit/rollback atomically', async () => {
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
    const { db, trx } = createFakeDb();

    const listener = new PageContentUpdatedListener(
      pageVerificationRepo as any,
      db as any,
      notificationQueue as any,
    );

    await listener.handle({
      pageId: 'p1',
      spaceId: 's1',
      workspaceId: 'w1',
      historyId: 'hist-2',
    });

    expect(pageVerificationRepo.insert).toHaveBeenCalledWith(
      expect.any(Object),
      trx,
    );
    expect(pageVerificationRepo.replaceVerifiers).toHaveBeenCalledWith(
      'pv2',
      ['v1', 'v2'],
      'u1',
      trx,
    );
  });

  it('does not leave an orphaned draft verification row if replaceVerifiers throws (transaction rolls back)', async () => {
    const previous = {
      id: 'pv1',
      pageId: 'p1',
      workspaceId: 'w1',
      spaceId: 's1',
      status: 'approved',
      type: 'qms',
      creatorId: 'u1',
    };
    const verifiers = [{ id: 'v1' }];

    // Simulate a real transaction: track whether the insert "committed" by
    // only marking it persisted once the whole executeTx callback resolves
    // without throwing. If replaceVerifiers throws, execute() rejects and
    // the row must never be considered committed.
    let committedRows: string[] = [];
    let pendingRows: string[] = [];

    const pageVerificationRepo = {
      findLatestByPageId: jest.fn().mockResolvedValue(previous),
      getVerifiers: jest.fn().mockResolvedValue(verifiers),
      insert: jest.fn().mockImplementation(async () => {
        pendingRows.push('pv2');
        return { id: 'pv2' };
      }),
      replaceVerifiers: jest
        .fn()
        .mockRejectedValue(new Error('replaceVerifiers failed')),
    };
    const notificationQueue = { add: jest.fn() };

    const trx = { __fakeTrx: true };
    const db = {
      transaction: () => ({
        execute: async (cb: (trx: unknown) => Promise<unknown>) => {
          try {
            const result = await cb(trx);
            committedRows = [...pendingRows];
            return result;
          } catch (err) {
            // Rollback: pending rows are discarded, nothing is committed.
            pendingRows = [];
            throw err;
          }
        },
      }),
    };

    const listener = new PageContentUpdatedListener(
      pageVerificationRepo as any,
      db as any,
      notificationQueue as any,
    );

    await expect(
      listener.handle({
        pageId: 'p1',
        spaceId: 's1',
        workspaceId: 'w1',
        historyId: 'hist-2',
      }),
    ).rejects.toThrow('replaceVerifiers failed');

    expect(committedRows).toEqual([]);
    expect(notificationQueue.add).not.toHaveBeenCalled();
  });
});
