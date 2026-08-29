import { EnvironmentService } from '../environment/environment.service';
import { QueueJob } from '../queue/constants';
import { OutgoingWebhookListener } from './outgoing-webhook.listener';

describe('OutgoingWebhookListener', () => {
  const queue = { add: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => queue.add.mockClear());

  it('debounces page updates with a BullMQ-safe job ID', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-29T12:00:00Z'));
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
      { delay: 10_000, jobId: 'page-updated-page-1-178800480' },
    );
    jest.useRealTimers();
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
});
