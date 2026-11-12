import { TrashCleanupService } from './trash-cleanup.service';
import { QueueJob } from '../../../integrations/queue/constants';

function buildService(descendantIds: string[]) {
  const calls: string[] = [];
  const db = {
    withRecursive: jest.fn(() => ({
      selectFrom: () => ({
        selectAll: () => ({
          execute: async () => descendantIds.map((id) => ({ id })),
        }),
      }),
    })),
    deleteFrom: jest.fn((table: string) => ({
      where: () => ({
        execute: async () => {
          calls.push(`delete ${table}`);
        },
      }),
    })),
  };
  const attachmentQueue = {
    add: jest.fn(async (_name: string, data: { pageId: string }) => {
      calls.push(`queue ${data.pageId}`);
    }),
  };
  const legalHoldService = {
    preservePages: jest.fn(async () => {
      calls.push('preserve');
    }),
  };

  const service = new TrashCleanupService(
    db as any,
    attachmentQueue as any,
    legalHoldService as any,
  );

  return { service, calls, db, attachmentQueue, legalHoldService };
}

describe('TrashCleanupService.cleanupPage', () => {
  it('preserves held pages before queueing their attachments and deleting them', async () => {
    const { service, calls, attachmentQueue, legalHoldService } = buildService(
      ['page-1', 'page-2'],
    );

    await service['cleanupPage']('page-1', 'ws-1');

    expect(legalHoldService.preservePages).toHaveBeenCalledWith(
      ['page-1', 'page-2'],
      { workspaceId: 'ws-1' },
    );
    expect(calls).toEqual([
      'preserve',
      'queue page-1',
      'queue page-2',
      'delete pages',
    ]);
    expect(attachmentQueue.add).toHaveBeenCalledWith(
      QueueJob.DELETE_PAGE_ATTACHMENTS,
      { pageId: 'page-1' },
      expect.objectContaining({ jobId: 'delete-page-attachments-page-1' }),
    );
  });

  it('keeps the pages and their attachments when preservation fails', async () => {
    const { service, db, attachmentQueue, legalHoldService } = buildService([
      'page-1',
    ]);
    legalHoldService.preservePages.mockRejectedValueOnce(new Error('db down'));

    await expect(service['cleanupPage']('page-1', 'ws-1')).rejects.toThrow(
      'db down',
    );

    expect(attachmentQueue.add).not.toHaveBeenCalled();
    expect(db.deleteFrom).not.toHaveBeenCalled();
  });

  it('queues and deletes nothing for a page that is already gone', async () => {
    const { service, db, attachmentQueue } = buildService([]);

    await service['cleanupPage']('page-1', 'ws-1');

    expect(attachmentQueue.add).not.toHaveBeenCalled();
    expect(db.deleteFrom).not.toHaveBeenCalled();
  });
});
