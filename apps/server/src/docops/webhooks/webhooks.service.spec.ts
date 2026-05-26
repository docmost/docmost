import { createHmac } from 'crypto';

// ── HMAC signature verification ────────────────────────────────────────────────

describe('Webhook HMAC-SHA256 signing', () => {
  const SECRET = 'test-secret-key-at-least-16-chars';

  const sign = (body: string) =>
    'sha256=' + createHmac('sha256', SECRET).update(body).digest('hex');

  it('produces sha256= prefix + 64-char hex', () => {
    expect(sign('{"event":"cr.test"}')).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('same body+secret → same signature (deterministic)', () => {
    const body = JSON.stringify({ event: 'cr.published' });
    expect(sign(body)).toBe(sign(body));
  });

  it('different body → different signature', () => {
    expect(sign(JSON.stringify({ event: 'cr.approved' }))).not.toBe(
      sign(JSON.stringify({ event: 'cr.published' })),
    );
  });

  it('different secret → different signature', () => {
    const body = JSON.stringify({ event: 'cr.approved' });
    const sig1 = 'sha256=' + createHmac('sha256', 'secret-a').update(body).digest('hex');
    const sig2 = 'sha256=' + createHmac('sha256', 'secret-b').update(body).digest('hex');
    expect(sig1).not.toBe(sig2);
  });

  it('receiver can verify using same algorithm', () => {
    const body = JSON.stringify({ event: 'cr.published', crId: 'cr-123' });
    const sent = sign(body);
    const expected = 'sha256=' + createHmac('sha256', SECRET).update(body).digest('hex');
    expect(sent).toBe(expected);
  });
});

// ── WebhookDeliveryService — queue dispatch ───────────────────────────────────

import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { KYSELY_MODULE_CONNECTION_TOKEN } from 'nestjs-kysely';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { DOCOPS_WEBHOOK_QUEUE, WEBHOOK_DELIVER_JOB } from './webhooks.constants';

describe('WebhookDeliveryService', () => {
  let service: WebhookDeliveryService;
  let queue: { add: jest.Mock };
  let db: any;

  const buildMockDb = (rows: { id: string }[] = []) => ({
    selectFrom: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(rows),
  });

  beforeEach(async () => {
    queue = { add: jest.fn().mockResolvedValue({}) };
    db = buildMockDb([]);

    const module = await Test.createTestingModule({
      providers: [
        WebhookDeliveryService,
        { provide: getQueueToken(DOCOPS_WEBHOOK_QUEUE), useValue: queue },
        { provide: KYSELY_MODULE_CONNECTION_TOKEN(), useValue: db },
      ],
    }).compile();

    service = module.get(WebhookDeliveryService);
  });

  it('does not enqueue when no webhooks match', async () => {
    db.execute = jest.fn().mockResolvedValue([]);
    await service.deliver('cr.approved', 'svc-1', { id: 'cr-1' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('enqueues one job per matching webhook', async () => {
    db.execute = jest.fn().mockResolvedValue([{ id: 'wh-1' }, { id: 'wh-2' }]);

    await service.deliver('cr.published', 'svc-1', { id: 'cr-1' });

    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(queue.add).toHaveBeenCalledWith(
      WEBHOOK_DELIVER_JOB,
      expect.objectContaining({ webhookId: 'wh-1', event: 'cr.published' }),
      expect.any(Object),
    );
    expect(queue.add).toHaveBeenCalledWith(
      WEBHOOK_DELIVER_JOB,
      expect.objectContaining({ webhookId: 'wh-2', event: 'cr.published' }),
      expect.any(Object),
    );
  });

  it('payload includes event, timestamp, and changeRequest', async () => {
    db.execute = jest.fn().mockResolvedValue([{ id: 'wh-1' }]);

    await service.deliver('cr.approved', 'svc-1', { id: 'cr-1', title: 'T' });

    const jobData = queue.add.mock.calls[0][1];
    expect(jobData.payload).toHaveProperty('event', 'cr.approved');
    expect(jobData.payload).toHaveProperty('timestamp');
    expect(jobData.payload.changeRequest).toMatchObject({ id: 'cr-1', title: 'T' });
  });
});
