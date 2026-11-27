import { createServer, type Server } from 'node:http';
import { connect as netConnect, type AddressInfo } from 'node:net';
import { Agent, fetch } from 'undici';
import { OutboundAgentFactory } from './outbound-agent.factory';
import { OutboundUrlError } from './outbound-url.guard';

describe('OutboundAgentFactory', () => {
  it('validates the URL through the guard and returns a releasable undici Agent', async () => {
    const validate = jest.fn().mockResolvedValue({ hostname: 'siem.example.com', address: '203.0.113.5', family: 4 });
    const factory = new OutboundAgentFactory({ validate } as any);

    const lease = await factory.lease('https://siem.example.com/ingest', { caCert: undefined, rejectUnauthorized: true });

    expect(validate).toHaveBeenCalledWith('https://siem.example.com/ingest', { publicOnly: undefined });
    expect(lease.dispatcher).toBeInstanceOf(Agent);
    await expect(lease.release()).resolves.toBeUndefined();
  });

  it('asks the guard for a public address when publicOnly is set', async () => {
    const validate = jest.fn().mockResolvedValue({ hostname: 'example.com', address: '93.184.216.34', family: 4 });
    const factory = new OutboundAgentFactory({ validate } as any);

    const lease = await factory.lease('https://example.com/', undefined, { publicOnly: true });

    expect(validate).toHaveBeenCalledWith('https://example.com/', { publicOnly: true });
    await lease.release();
  });

  it('propagates guard rejections', async () => {
    const validate = jest.fn().mockRejectedValue(new OutboundUrlError('Destination URL must use https'));
    const factory = new OutboundAgentFactory({ validate } as any);

    await expect(factory.lease('http://siem.example.com')).rejects.toThrow(OutboundUrlError);
  });
});

describe('OutboundAgentFactory via a proxy', () => {
  const ENV_KEYS = ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy'];
  let savedEnv: Record<string, string | undefined>;
  let target: Server;
  let proxy: Server;
  let targetPort: number;
  let tunnels: string[];

  const listen = (server: Server) =>
    new Promise<number>((resolve) =>
      server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)),
    );
  const close = (server: Server) =>
    new Promise<void>((resolve) => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    });

  beforeEach(async () => {
    savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
    ENV_KEYS.forEach((key) => delete process.env[key]);

    target = createServer((_req, res) => res.end('target'));
    targetPort = await listen(target);

    // Records each tunnel request, then connects it to the local target.
    tunnels = [];
    proxy = createServer();
    proxy.on('connect', (req, socket) => {
      tunnels.push(req.url ?? '');
      const upstream = netConnect(targetPort, '127.0.0.1', () => {
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        upstream.pipe(socket);
        socket.pipe(upstream);
      });
      upstream.on('error', () => socket.destroy());
      socket.on('error', () => upstream.destroy());
    });
    process.env.HTTP_PROXY = `http://127.0.0.1:${await listen(proxy)}`;
  });

  afterEach(async () => {
    ENV_KEYS.forEach((key) => {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    });
    await Promise.all([close(target), close(proxy)]);
  });

  const factoryPinnedTo = (address: string) =>
    new OutboundAgentFactory({
      validate: jest.fn().mockResolvedValue({ hostname: 'unused', address, family: 4 }),
    } as any);

  it('sends the request through the proxy when asked to', async () => {
    const lease = await factoryPinnedTo('127.0.0.1').lease(`http://preview.test:${targetPort}/`, undefined, {
      viaProxy: true,
    });

    const res = await fetch(`http://preview.test:${targetPort}/`, { dispatcher: lease.dispatcher });

    expect(await res.text()).toBe('target');
    expect(tunnels).toEqual([`preview.test:${targetPort}`]);
    await lease.release();
  });

  it('connects directly to a host NO_PROXY skips', async () => {
    process.env.NO_PROXY = 'pinned.test';
    const lease = await factoryPinnedTo('127.0.0.1').lease(`http://pinned.test:${targetPort}/`, undefined, {
      viaProxy: true,
    });

    const res = await fetch(`http://pinned.test:${targetPort}/`, { dispatcher: lease.dispatcher });

    expect(await res.text()).toBe('target');
    expect(tunnels).toEqual([]);
    await lease.release();
  });

  it('ignores the proxy unless asked to', async () => {
    const lease = await factoryPinnedTo('127.0.0.1').lease(`http://pinned.test:${targetPort}/`);

    const res = await fetch(`http://pinned.test:${targetPort}/`, { dispatcher: lease.dispatcher });

    expect(await res.text()).toBe('target');
    expect(tunnels).toEqual([]);
    await lease.release();
  });
});
