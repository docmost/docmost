import { EnvironmentService } from '../environment/environment.service';
import { QueueJob } from '../queue/constants';
import { OutgoingWebhookListener } from './outgoing-webhook.listener';

describe('OutgoingWebhookListener', () => {
  const queue = { add: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    queue.add.mockReset().mockResolvedValue(undefined);
  });

  it('debounces page updates by extending and replacing the delayed job', async () => {
    const env = {
      getOutgoingWebhookUrl: () => 'https://example.com/events',
      getOutgoingWebhookEvents: () => ['page.updated'],
    } as EnvironmentService;
    const listener = new OutgoingWebhookListener(env, queue as never);

    await listener.handleUpdated({
      pageIds: ['page-1'],
      workspaceId: 'workspace-1',
    });

    expect(queue.add).toHaveBeenCalledWith(
      QueueJob.DELIVER_OUTGOING_WEBHOOK,
      expect.objectContaining({
        event: 'page.updated',
        pageId: 'page-1',
        workspaceId: 'workspace-1',
      }),
      {
        delay: 10_000,
        deduplication: {
          id: 'page.updated-page-1',
          ttl: 10_000,
          extend: true,
          replace: true,
        },
      },
    );
  });

  it('ignores disabled events', async () => {
    const env = {
      getOutgoingWebhookUrl: () => 'https://example.com/events',
      getOutgoingWebhookEvents: () => ['page.created'],
    } as EnvironmentService;
    const listener = new OutgoingWebhookListener(env, queue as never);

    await listener.handleUpdated({ pageIds: ['page-1'] });

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('does not acknowledge queue insertion failures inside the listener', async () => {
    queue.add.mockRejectedValueOnce(new Error('Redis unavailable'));
    const env = {
      getOutgoingWebhookUrl: () => 'https://example.com/events',
      getOutgoingWebhookEvents: () => ['page.created'],
    } as EnvironmentService;
    const listener = new OutgoingWebhookListener(env, queue as never);

    await expect(
      listener.handleCreated({ pageIds: ['page-1'] }),
    ).rejects.toThrow('Redis unavailable');
  });
});
