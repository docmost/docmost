import { createHmac } from 'node:crypto';
import { EnvironmentService } from '../environment/environment.service';
import {
  OutgoingWebhookService,
  signOutgoingWebhook,
} from './outgoing-webhook.service';

const secret = 'test-secret-with-at-least-thirty-two-characters';

describe('OutgoingWebhookService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('signs the exact request body with HMAC-SHA256', () => {
    const body = '{"hello":"world"}';
    expect(signOutgoingWebhook(secret, body)).toBe(
      `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`,
    );
  });

  it('delivers a signed page event', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const env = {
      getOutgoingWebhookUrl: () => 'https://example.com/events',
      getOutgoingWebhookSecret: () => secret,
    } as EnvironmentService;
    const service = new OutgoingWebhookService(env);

    await service.deliver({
      deliveryId: 'delivery-1',
      event: 'page.updated',
      occurredAt: '2026-08-29T12:00:00.000Z',
      workspaceId: 'workspace-1',
      pageId: 'page-1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.com/events');
    expect(request.headers['x-docmost-event']).toBe('page.updated');
    expect(request.headers['x-docmost-delivery']).toBe('delivery-1');
    expect(request.headers['x-docmost-signature-256']).toBe(
      signOutgoingWebhook(secret, request.body as string),
    );
  });

  it('throws on non-success responses so BullMQ retries delivery', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(null, { status: 503 }));
    const env = {
      getOutgoingWebhookUrl: () => 'https://example.com/events',
      getOutgoingWebhookSecret: () => secret,
    } as EnvironmentService;
    const service = new OutgoingWebhookService(env);

    await expect(
      service.deliver({
        deliveryId: 'delivery-1',
        event: 'page.created',
        occurredAt: '2026-08-29T12:00:00.000Z',
        pageId: 'page-1',
      }),
    ).rejects.toThrow('HTTP 503');
  });
});
