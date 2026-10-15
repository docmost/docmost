import { IncomingMessage } from 'node:http';
import { BlockList, isIP } from 'node:net';
import proxyAddr from '@fastify/proxy-addr';
import { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from 'fastify';

// https://www.cloudflare.com/ips/
const CLOUDFLARE_RANGES = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

const isTrustedProxy = proxyAddr.compile([
  'loopback',
  'linklocal',
  'uniquelocal',
  '100.64.0.0/10',
]);

const cloudflareEdges = new BlockList();
for (const range of CLOUDFLARE_RANGES) {
  const [network, prefix] = range.split('/');
  cloudflareEdges.addSubnet(
    network,
    Number(prefix),
    isIP(network) === 6 ? 'ipv6' : 'ipv4',
  );
}

function normalizeIp(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  // Drops the port Azure Application Gateway appends, IPv4-mapped prefixes and IPv6 zone ids.
  const ip = value
    .trim()
    .replace(/^\[(.+)\](:\d+)?$/, '$1')
    .replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, '$1')
    .replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, '')
    .replace(/%.*$/, '');
  return isIP(ip) ? ip : undefined;
}

export function resolveClientIp(req: IncomingMessage): string | undefined {
  const ip = normalizeIp(proxyAddr(req, isTrustedProxy));
  const cloudflareClientIp = normalizeIp(req.headers['cf-connecting-ip']);
  if (
    ip &&
    cloudflareClientIp &&
    cloudflareEdges.check(ip, isIP(ip) === 6 ? 'ipv6' : 'ipv4')
  ) {
    return cloudflareClientIp;
  }
  return ip ?? normalizeIp(req.socket.remoteAddress);
}

export function overrideRequestIp(
  request: FastifyRequest,
  _reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  // Fastify defines ip as a prototype getter, so it can't be assigned.
  Object.defineProperty(request, 'ip', {
    value: resolveClientIp(request.raw),
  });
  done();
}
