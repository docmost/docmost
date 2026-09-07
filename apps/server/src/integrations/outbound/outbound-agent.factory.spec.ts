import { Agent } from 'undici';
import { OutboundAgentFactory } from './outbound-agent.factory';
import { OutboundUrlError } from './outbound-url.guard';

describe('OutboundAgentFactory', () => {
  it('validates the URL through the guard and returns a releasable undici Agent', async () => {
    const validate = jest.fn().mockResolvedValue({ hostname: 'siem.example.com', address: '203.0.113.5', family: 4 });
    const factory = new OutboundAgentFactory({ validate } as any);

    const lease = await factory.lease('https://siem.example.com/ingest', { caCert: undefined, rejectUnauthorized: true });

    expect(validate).toHaveBeenCalledWith('https://siem.example.com/ingest');
    expect(lease.dispatcher).toBeInstanceOf(Agent);
    await expect(lease.release()).resolves.toBeUndefined();
  });

  it('propagates guard rejections', async () => {
    const validate = jest.fn().mockRejectedValue(new OutboundUrlError('Destination URL must use https'));
    const factory = new OutboundAgentFactory({ validate } as any);

    await expect(factory.lease('http://siem.example.com')).rejects.toThrow(OutboundUrlError);
  });
});
