import { EnvironmentService } from '../environment/environment.service';
import { QueueJob } from '../queue/constants';
import { OutgoingWebhookListener } from './outgoing-webhook.listener';

describe('OutgoingWebhookListener', () => {
  const queue = { addBulk: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    queue.addBulk.mockReset().mockResolvedValue(undefined);
  });

  it('keeps the latest page update when the previous job is active', async () => {
    const env = {
      getOutgoingWebhookUrl: () => 'https://example.com/events',
      getOutgoingWebhookEvents: () => ['page.updated'],
    } as EnvironmentService;
    const listener = new OutgoingWebhookListener(env, queue as never);

    await listener.handleUpdated({
      pageIds: ['page-1'],
      workspaceId: 'workspace-1',
    });

    expect(queue.addBulk).toHaveBeenCalledWith([
      {
        name: QueueJob.DELIVER_OUTGOING_WEBHOOK,
        data: expect.objectContaining({
          event: 'page.updated',
          pageId: 'page-1',
          workspaceId: 'workspace-1',
        }),
        opts: {
          delay: 10_000,
          deduplication: {
            id: 'page.updated-page-1',
            replace: true,
            keepLastIfActive: true,
          },
        },
      },
    ]);
  });

  it('ignores disabled events', async () => {
    const env = {
      getOutgoingWebhookUrl: () => 'https://example.com/events',
      getOutgoingWebhookEvents: () => ['page.created'],
    } as EnvironmentService;
    const listener = new OutgoingWebhookListener(env, queue as never);

    await listener.handleUpdated({ pageIds: ['page-1'] });

    expect(queue.addBulk).not.toHaveBeenCalled();
  });

  it('does not acknowledge queue insertion failures inside the listener', async () => {
    queue.addBulk.mockRejectedValueOnce(new Error('Redis unavailable'));
    const env = {
      getOutgoingWebhookUrl: () => 'https://example.com/events',
      getOutgoingWebhookEvents: () => ['page.created'],
    } as EnvironmentService;
    const listener = new OutgoingWebhookListener(env, queue as never);

    await expect(
      listener.handleCreated({ pageIds: ['page-1'] }),
    ).rejects.toThrow('Redis unavailable');
  });

  it('inserts large page events in bounded batches', async () => {
    const env = {
      getOutgoingWebhookUrl: () => 'https://example.com/events',
      getOutgoingWebhookEvents: () => ['page.created'],
    } as EnvironmentService;
    const listener = new OutgoingWebhookListener(env, queue as never);
    const pageIds = Array.from({ length: 201 }, (_, index) => `page-${index}`);

    await listener.handleCreated({ pageIds });

    expect(queue.addBulk).toHaveBeenCalledTimes(3);
    expect(queue.addBulk.mock.calls.map(([jobs]) => jobs.length)).toEqual([
      100, 100, 1,
    ]);
  });
});
