import { lookup } from 'node:dns';
import { isIP } from 'node:net';
import { Agent, fetch as undiciFetch, RequestInit, Response } from 'undici';

/**
 * SSRF guard for integration outbound HTTP (token endpoints and resource
 * calls, whose base URLs are workspace-admin-configured).
 *
 * DISABLED by default: self-hosted deployments routinely run providers on the
 * same private network or docker bridge, and Docmost historically applied no
 * egress restrictions. Operators of multi-tenant or otherwise exposed
 * deployments opt in with INTEGRATION_ALLOW_LOCAL_CONNECTIONS=false, after
 * which integration egress to loopback, link-local (incl. cloud metadata),
 * RFC1918/CGNAT, and IPv6 unique-local destinations is refused.
 *
 * Enforcement is two-layered:
 * - IP-literal hosts are checked synchronously before the request.
 * - DNS names are checked inside the dialer's lookup hook — after resolution,
 *   before the TCP connect — so a record that changes between validation and
 *   connect (DNS rebinding) is still caught.
 */

/** Response type produced by outboundFetch (undici's, not the DOM lib's). */
export type OutboundResponse = Response;

export function allowLocalConnections(): boolean {
  return process.env.INTEGRATION_ALLOW_LOCAL_CONNECTIONS !== 'false';
}

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

function positiveIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Per-request deadline for integration egress (token + resource calls). */
export function integrationRequestTimeoutMs(): number {
  return positiveIntEnv(
    'INTEGRATION_REQUEST_TIMEOUT_MS',
    DEFAULT_REQUEST_TIMEOUT_MS,
  );
}

/** Hard cap on provider response bodies read into memory. */
export function integrationMaxResponseBytes(): number {
  return positiveIntEnv(
    'INTEGRATION_MAX_RESPONSE_BYTES',
    DEFAULT_MAX_RESPONSE_BYTES,
  );
}

export class OutboundResponseTooLargeError extends Error {
  constructor(limit: number) {
    super(`Integration response exceeded the ${limit}-byte limit`);
    this.name = 'OutboundResponseTooLargeError';
  }
}

/**
 * Reads a response body as text, aborting once it exceeds the configured
 * byte limit — a declared Content-Length above the limit fails fast, and the
 * stream is counted as it arrives so a lying or absent header cannot bypass
 * the cap.
 */
export async function readOutboundBody(
  resp: OutboundResponse,
  maxBytes = integrationMaxResponseBytes(),
): Promise<string> {
  const declared = Number.parseInt(resp.headers.get('content-length') ?? '', 10);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new OutboundResponseTooLargeError(maxBytes);
  }
  if (!resp.body) return '';

  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        throw new OutboundResponseTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
    if (received > maxBytes) {
      await resp.body.cancel().catch(() => undefined);
    }
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

const IPV4_BLOCKED_RANGES: Array<[number, number]> = [
  // [network, prefix] — loopback, unspecified, link-local, RFC1918, CGNAT,
  // multicast, broadcast.
  [ipv4ToInt('127.0.0.0'), 8],
  [ipv4ToInt('0.0.0.0'), 8],
  [ipv4ToInt('169.254.0.0'), 16],
  [ipv4ToInt('10.0.0.0'), 8],
  [ipv4ToInt('172.16.0.0'), 12],
  [ipv4ToInt('192.168.0.0'), 16],
  [ipv4ToInt('100.64.0.0'), 10],
  [ipv4ToInt('224.0.0.0'), 4],
  [ipv4ToInt('255.255.255.255'), 32],
];

function ipv4ToInt(ip: string): number {
  return ip
    .split('.')
    .reduce((acc, octet) => (acc << 8) + Number.parseInt(octet, 10), 0);
}

function isBlockedIpv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  return IPV4_BLOCKED_RANGES.some(([network, prefix]) => {
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (value & mask) >>> 0 === (network & mask) >>> 0;
  });
}

/** Returns the first two hextets of a normalized IPv6 address. */
function ipv6Hextets(ip: string): number[] {
  const [head, tail = ''] = ip.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const missing = 8 - headParts.length - tailParts.length;
  const parts = [
    ...headParts,
    ...Array.from({ length: Math.max(missing, 0) }, () => '0'),
    ...tailParts,
  ];
  return parts.map((p) => (p.includes('.') ? -1 : Number.parseInt(p, 16) || 0));
}

/** Extracts an embedded IPv4 from mapped (::ffff:), 6to4, and NAT64 forms. */
function embeddedIpv4(ip: string): string | null {
  const lower = ip.toLowerCase();
  const v4Suffix = lower.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1] ?? null;
  if (lower.startsWith('::ffff:') && v4Suffix) return v4Suffix;
  const hextets = ipv6Hextets(lower);
  if (hextets[0] === 0x2002) {
    // 6to4: 2002:AABB:CCDD::/48 embeds A.B.C.D.
    return [
      hextets[1] >> 8,
      hextets[1] & 0xff,
      hextets[2] >> 8,
      hextets[2] & 0xff,
    ].join('.');
  }
  if (hextets[0] === 0x64 && hextets[1] === 0xff9b) {
    // NAT64 64:ff9b::/96 embeds the IPv4 in the last 32 bits.
    if (v4Suffix) return v4Suffix;
    return [
      hextets[6] >> 8,
      hextets[6] & 0xff,
      hextets[7] >> 8,
      hextets[7] & 0xff,
    ].join('.');
  }
  return null;
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.split('%')[0].toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  const first = ipv6Hextets(lower)[0] ?? 0;
  if ((first & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((first & 0xfe00) === 0xfc00) return true; // unique-local fc00::/7
  if ((first & 0xff00) === 0xff00) return true; // multicast ff00::/8
  const v4 = embeddedIpv4(lower);
  return v4 !== null && isBlockedIpv4(v4);
}

/** True when the address must not be dialed while the guard is enabled. */
export function isBlockedOutboundAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isBlockedIpv4(address);
  if (version === 6) return isBlockedIpv6(address);
  return true;
}

export class BlockedOutboundUrlError extends Error {
  constructor(host: string) {
    super(
      `Outbound integration host resolves to a blocked address: ${host}. ` +
        'This deployment sets INTEGRATION_ALLOW_LOCAL_CONNECTIONS=false; use a ' +
        'publicly routable provider URL or lift that restriction.',
    );
    this.name = 'BlockedOutboundUrlError';
  }
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: any,
  family?: number,
) => void;

function guardedLookup(
  hostname: string,
  options: { all?: boolean },
  callback: LookupCallback,
): void {
  lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, undefined);
    const list = Array.isArray(addresses)
      ? addresses
      : [{ address: addresses as unknown as string, family: 4 }];
    if (list.some((entry) => isBlockedOutboundAddress(entry.address))) {
      return callback(new BlockedOutboundUrlError(hostname), undefined);
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

let guardedAgent: Agent | undefined;

function getGuardedAgent(): Agent {
  guardedAgent ??= new Agent({ connect: { lookup: guardedLookup as any } });
  return guardedAgent;
}

/**
 * Save-time validation: friendly error for the admin connection form. The
 * dial-time hook stays authoritative; this only fails fast on configs that
 * could never be dialed.
 */
export async function assertAllowedOutboundUrl(rawUrl: string): Promise<void> {
  if (allowLocalConnections()) return;
  const hostname = new URL(rawUrl).hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname)) {
    if (isBlockedOutboundAddress(hostname)) {
      throw new BlockedOutboundUrlError(hostname);
    }
    return;
  }
  await new Promise<void>((resolve, reject) => {
    // Only surface guard verdicts here — a transient DNS failure should not
    // block saving a connection the dial-time hook will police anyway.
    guardedLookup(hostname, { all: true }, (err) =>
      err instanceof BlockedOutboundUrlError ? reject(err) : resolve(),
    );
  });
}

/**
 * The only way integration code performs outbound HTTP. Applies the guard
 * (when enabled) to both IP-literal and DNS-resolved destinations; with the
 * guard disabled it behaves exactly like global fetch.
 */
export function outboundFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const signal = init.signal ?? AbortSignal.timeout(integrationRequestTimeoutMs());
  if (allowLocalConnections()) {
    return undiciFetch(url, { ...init, signal });
  }
  const hostname = new URL(url).hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname) && isBlockedOutboundAddress(hostname)) {
    return Promise.reject(new BlockedOutboundUrlError(hostname));
  }
  return undiciFetch(url, { ...init, signal, dispatcher: getGuardedAgent() });
}
