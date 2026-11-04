import { IncomingMessage } from 'node:http';
import {
  Controller,
  Get,
  MiddlewareConsumer,
  Module,
  NestModule,
  Req,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { FastifyRequest } from 'fastify';
import { overrideRequestIp, resolveClientIp } from './client-ip.utils';

const CLIENT = '198.51.100.20';
const ATTACKER = '203.0.113.66';
const PROXY = '172.18.0.2';
const CLOUDFLARE_EDGE = '162.158.1.1';

type Headers = Record<string, string>;

function fakeRequest(
  remoteAddress: string | undefined,
  headers: Headers = {},
): IncomingMessage {
  return { socket: { remoteAddress }, headers } as unknown as IncomingMessage;
}

describe('resolveClientIp', () => {
  it.each<[string, Headers]>([
    ['X-Client-IP', { 'x-client-ip': '9.9.9.9' }],
    ['X-Real-IP', { 'x-real-ip': '9.9.9.9' }],
    ['True-Client-IP', { 'true-client-ip': '9.9.9.9' }],
    ['X-Forwarded-For', { 'x-forwarded-for': '9.9.9.9' }],
    ['CF-Connecting-IP', { 'cf-connecting-ip': '9.9.9.9' }],
  ])('ignores %s from a client that connects directly', (_header, headers) => {
    expect(resolveClientIp(fakeRequest(ATTACKER, headers))).toBe(ATTACKER);
  });

  it.each<[string, string, string]>([
    ['nginx appending to a client-sent header', PROXY, `9.9.9.9, ${CLIENT}`],
    ['Traefik or Caddy replacing the header', PROXY, CLIENT],
    ['a proxy on loopback', '127.0.0.1', CLIENT],
    ['a chain of private proxies', '127.0.0.1', `${CLIENT}, 10.0.0.5`],
    ['an AWS ALB after a junk entry', '10.0.1.10', `unknown, ${CLIENT}`],
    ['an Azure App Service front end', '169.254.130.1', CLIENT],
    ['an Azure Container Apps ingress', '::ffff:100.100.0.52', CLIENT],
  ])('reads X-Forwarded-For written by %s', (_setup, peer, forwardedFor) => {
    expect(
      resolveClientIp(fakeRequest(peer, { 'x-forwarded-for': forwardedFor })),
    ).toBe(CLIENT);
  });

  it.each<[string, string, string]>([
    ['Azure Application Gateway', `9.9.9.9, ${CLIENT}:51234`, CLIENT],
    ['an ALB with client ports on IPv6', '[2001:db8::5]:443', '2001:db8::5'],
  ])('strips the port that %s adds', (_setup, forwardedFor, expected) => {
    expect(
      resolveClientIp(
        fakeRequest('10.1.0.4', { 'x-forwarded-for': forwardedFor }),
      ),
    ).toBe(expected);
  });

  it.each<[string, string, Headers, string]>([
    [
      'Cloudflare through a proxy that replaces X-Forwarded-For',
      PROXY,
      { 'x-forwarded-for': CLOUDFLARE_EDGE, 'cf-connecting-ip': CLIENT },
      CLIENT,
    ],
    [
      'Cloudflare through a proxy that trusts Cloudflare',
      PROXY,
      {
        'x-forwarded-for': `9.9.9.9, ${CLIENT}, ${CLOUDFLARE_EDGE}`,
        'cf-connecting-ip': CLIENT,
      },
      CLIENT,
    ],
    [
      'Cloudflare connecting to Docmost directly',
      CLOUDFLARE_EDGE,
      { 'x-forwarded-for': CLIENT, 'cf-connecting-ip': CLIENT },
      CLIENT,
    ],
    [
      'Cloudflare over IPv6',
      PROXY,
      {
        'x-forwarded-for': '2606:4700:10::6816:1',
        'cf-connecting-ip': '2001:db8::7',
      },
      '2001:db8::7',
    ],
    [
      'a Cloudflare edge without CF-Connecting-IP',
      CLOUDFLARE_EDGE,
      {},
      CLOUDFLARE_EDGE,
    ],
    [
      'a Cloudflare edge with an invalid CF-Connecting-IP',
      CLOUDFLARE_EDGE,
      { 'cf-connecting-ip': 'not-an-ip' },
      CLOUDFLARE_EDGE,
    ],
    [
      'a direct client forging CF-Connecting-IP',
      ATTACKER,
      { 'cf-connecting-ip': '9.9.9.9' },
      ATTACKER,
    ],
    [
      'a client forging a Cloudflare hop behind nginx',
      PROXY,
      {
        'x-forwarded-for': `9.9.9.9, ${CLOUDFLARE_EDGE}, ${ATTACKER}`,
        'cf-connecting-ip': '9.9.9.9',
      },
      ATTACKER,
    ],
  ])('resolves %s', (_setup, peer, headers, expected) => {
    expect(resolveClientIp(fakeRequest(peer, headers))).toBe(expected);
  });

  it.each(['unknown', '(null)'])(
    'falls back to the proxy address when X-Forwarded-For is %s',
    (forwardedFor) => {
      expect(
        resolveClientIp(fakeRequest(PROXY, { 'x-forwarded-for': forwardedFor })),
      ).toBe(PROXY);
    },
  );

  it('unwraps IPv4-mapped addresses', () => {
    expect(resolveClientIp(fakeRequest(`::ffff:${ATTACKER}`))).toBe(ATTACKER);
  });

  it('drops IPv6 zone ids', () => {
    expect(resolveClientIp(fakeRequest('fe80::1%eth0'))).toBe('fe80::1');
  });

  it('returns undefined when the socket has no address', () => {
    expect(resolveClientIp(fakeRequest(undefined))).toBeUndefined();
  });
});

describe('overrideRequestIp', () => {
  let app: NestFastifyApplication;
  let middlewareIp: string | undefined;

  @Controller('ip')
  class IpController {
    @Get()
    ip(@Req() request: FastifyRequest) {
      return { ip: request.ip, middlewareIp };
    }
  }

  @Module({ controllers: [IpController] })
  class IpModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
      consumer
        .apply(
          (
            req: IncomingMessage & { ip?: string },
            _res: unknown,
            next: () => void,
          ) => {
            middlewareIp = req.ip;
            next();
          },
        )
        .forRoutes(IpController);
    }
  }

  beforeAll(async () => {
    const adapter = new FastifyAdapter({ trustProxy: true });
    adapter.getInstance().addHook('onRequest', overrideRequestIp);
    app = await NestFactory.create<NestFastifyApplication>(IpModule, adapter, {
      logger: false,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(() => app.close());

  async function requestIp(remoteAddress: string, headers: Headers) {
    const res = await app.inject({
      method: 'GET',
      url: '/ip',
      remoteAddress,
      headers,
    });
    return res.json();
  }

  it('replaces the X-Forwarded-For entry trustProxy picks', async () => {
    expect(
      await requestIp(ATTACKER, { 'x-forwarded-for': '9.9.9.9' }),
    ).toEqual({ ip: ATTACKER, middlewareIp: ATTACKER });
  });

  it('is visible to Nest middleware when added before NestFactory.create', async () => {
    expect(
      await requestIp(PROXY, { 'x-forwarded-for': `9.9.9.9, ${CLIENT}` }),
    ).toEqual({ ip: CLIENT, middlewareIp: CLIENT });
  });
});
