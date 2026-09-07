import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { promises as dns } from 'node:dns';
import { BlockList, isIPv4, isIPv6 } from 'node:net';
import { EnvironmentService } from '../environment/environment.service';
import {
  OutboundNetworkPolicy,
  parseOutboundNetworkPolicy,
  policyNamesAddress,
} from './outbound-network-policy';

export const OUTBOUND_LOOKUP = 'OUTBOUND_LOOKUP';

export type ResolvedAddress = { address: string; family: number };
export type LookupFn = (hostname: string) => Promise<ResolvedAddress[]>;
export type PinnedAddress = { hostname: string; address: string; family: 4 | 6 };

/** A rejected URL. Only transient resolution failures are retryable. */
export class OutboundUrlError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'OutboundUrlError';
  }
}

export const defaultLookup: LookupFn = async (hostname) => {
  const results = await dns.lookup(hostname, { all: true });
  return results.map((r) => ({ address: r.address, family: r.family }));
};

// Reserved ranges blocked unless explicitly allowed on self-hosted deployments.
const ALWAYS_BLOCKED = new BlockList();
ALWAYS_BLOCKED.addSubnet('0.0.0.0', 8, 'ipv4');       // "this" network / unspecified
ALWAYS_BLOCKED.addSubnet('127.0.0.0', 8, 'ipv4');
ALWAYS_BLOCKED.addSubnet('169.254.0.0', 16, 'ipv4');  // link-local / cloud metadata
ALWAYS_BLOCKED.addSubnet('192.0.0.0', 24, 'ipv4');    // IETF protocol assignments
ALWAYS_BLOCKED.addSubnet('192.0.2.0', 24, 'ipv4');    // TEST-NET-1
ALWAYS_BLOCKED.addSubnet('192.88.99.0', 24, 'ipv4');  // deprecated 6to4 relay anycast
ALWAYS_BLOCKED.addSubnet('198.18.0.0', 15, 'ipv4');   // benchmarking
ALWAYS_BLOCKED.addSubnet('198.51.100.0', 24, 'ipv4'); // TEST-NET-2
ALWAYS_BLOCKED.addSubnet('203.0.113.0', 24, 'ipv4');  // TEST-NET-3
ALWAYS_BLOCKED.addRange('224.0.0.0', '255.255.255.255', 'ipv4'); // multicast + reserved
ALWAYS_BLOCKED.addSubnet('::', 96, 'ipv6');           // deprecated IPv4-compatible
ALWAYS_BLOCKED.addSubnet('::ffff:0:0:0', 96, 'ipv6'); // IPv4-translated (SIIT): ::ffff:0:7f00:1 is 127.0.0.1
ALWAYS_BLOCKED.addSubnet('::', 128, 'ipv6');          // unspecified
ALWAYS_BLOCKED.addSubnet('::1', 128, 'ipv6');         // loopback
ALWAYS_BLOCKED.addSubnet('64:ff9b::', 96, 'ipv6');    // NAT64 well-known prefix
ALWAYS_BLOCKED.addSubnet('64:ff9b:1::', 48, 'ipv6');  // NAT64 local-use
ALWAYS_BLOCKED.addSubnet('100::', 64, 'ipv6');        // discard-only
ALWAYS_BLOCKED.addSubnet('2001::', 32, 'ipv6');       // Teredo
ALWAYS_BLOCKED.addSubnet('2001:db8::', 32, 'ipv6');   // documentation
ALWAYS_BLOCKED.addSubnet('2002::', 16, 'ipv6');       // 6to4
ALWAYS_BLOCKED.addSubnet('fe80::', 10, 'ipv6');       // link-local
ALWAYS_BLOCKED.addSubnet('fec0::', 10, 'ipv6');       // deprecated site-local
ALWAYS_BLOCKED.addSubnet('ff00::', 8, 'ipv6');        // multicast

// Private ranges that self-hosted deployments can allow.
const PRIVATE_NETWORKS = new BlockList();
PRIVATE_NETWORKS.addSubnet('10.0.0.0', 8, 'ipv4');
PRIVATE_NETWORKS.addSubnet('100.64.0.0', 10, 'ipv4'); // CGNAT
PRIVATE_NETWORKS.addSubnet('172.16.0.0', 12, 'ipv4');
PRIVATE_NETWORKS.addSubnet('192.168.0.0', 16, 'ipv4');
PRIVATE_NETWORKS.addSubnet('fc00::', 7, 'ipv6');      // unique-local

// These ranges cannot be allowed by policy.
const HARD_BLOCKED = new BlockList();
HARD_BLOCKED.addSubnet('0.0.0.0', 8, 'ipv4');
HARD_BLOCKED.addSubnet('169.254.0.0', 16, 'ipv4');
HARD_BLOCKED.addRange('224.0.0.0', '255.255.255.255', 'ipv4');
HARD_BLOCKED.addSubnet('::', 128, 'ipv6');
HARD_BLOCKED.addSubnet('fe80::', 10, 'ipv6');
HARD_BLOCKED.addSubnet('ff00::', 8, 'ipv6');

/** Returns true for reserved or transition ranges. Invalid input is blocked. */
export function isAlwaysBlockedAddress(ip: string): boolean {
  if (isIPv4(ip)) return ALWAYS_BLOCKED.check(ip, 'ipv4');
  if (isIPv6(ip)) return ALWAYS_BLOCKED.check(ip, 'ipv6');
  return true;
}

/** Returns true for ranges that policy cannot allow. Invalid input is blocked. */
export function isHardBlockedAddress(ip: string): boolean {
  if (isIPv4(ip)) return HARD_BLOCKED.check(ip, 'ipv4');
  if (isIPv6(ip)) return HARD_BLOCKED.check(ip, 'ipv6');
  return true;
}

/** Returns true for private network ranges. Invalid input is blocked. */
export function isPrivateNetworkAddress(ip: string): boolean {
  if (isIPv4(ip)) return PRIVATE_NETWORKS.check(ip, 'ipv4');
  if (isIPv6(ip)) return PRIVATE_NETWORKS.check(ip, 'ipv6');
  return true;
}

/** Returns true for addresses blocked by cloud deployments. */
export function isPrivateAddress(ip: string): boolean {
  return isAlwaysBlockedAddress(ip) || isPrivateNetworkAddress(ip);
}

type Refusal = {
  address: string;
  kind: 'not-an-ip' | 'hard-blocked' | 'private' | 'reserved';
};

function findRefusal(
  resolved: ResolvedAddress[],
  port: number,
  policy: OutboundNetworkPolicy,
): Refusal | undefined {
  for (const { address } of resolved) {
    // Reject invalid resolver output before policy checks.
    if (!isIPv4(address) && !isIPv6(address)) return { address, kind: 'not-an-ip' };
    if (isHardBlockedAddress(address)) return { address, kind: 'hard-blocked' };
    if (policyNamesAddress(policy, address, port)) continue;
    if (isPrivateNetworkAddress(address)) {
      if (policy.mode === 'all') continue;
      return { address, kind: 'private' };
    }
    if (isAlwaysBlockedAddress(address)) return { address, kind: 'reserved' };
  }
  return undefined;
}

function describeRefusal(hostname: string, { address, kind }: Refusal): string {
  if (kind === 'not-an-ip') {
    return `Destination host "${hostname}" resolved to "${address}", which is not an IP address`;
  }
  if (kind === 'hard-blocked') {
    return `Destination host "${hostname}" resolves to a link-local, metadata or reserved address (${address}), which is never allowed`;
  }
  const description =
    kind === 'private' ? 'a private address' : 'a loopback or reserved address';
  return `Destination host "${hostname}" resolves to ${description} (${address}). Set ALLOWED_PRIVATE_NETWORKS on the server to allow it`;
}

function effectivePort(url: URL): number {
  if (url.port) return Number(url.port);
  return url.protocol === 'https:' ? 443 : 80;
}

@Injectable()
export class OutboundUrlGuard {
  private readonly logger = new Logger(OutboundUrlGuard.name);
  private readonly lookup: LookupFn;
  private cachedPolicy?: { raw: string; policy: OutboundNetworkPolicy };

  constructor(
    private readonly environmentService: EnvironmentService,
    @Optional() @Inject(OUTBOUND_LOOKUP) lookup?: LookupFn,
  ) {
    this.lookup = lookup ?? defaultLookup;
  }

  /** Caches the parsed policy and logs each invalid value once. */
  private resolvePolicy(): OutboundNetworkPolicy {
    const raw = this.environmentService.getAllowedPrivateNetworks();
    if (this.cachedPolicy?.raw !== raw) {
      const policy = parseOutboundNetworkPolicy(raw);
      if (policy.invalid) {
        this.logger.error(
          `Invalid ALLOWED_PRIVATE_NETWORKS value "${raw}"; refusing every private and reserved destination`,
        );
      }
      this.cachedPolicy = { raw, policy };
    }
    return this.cachedPolicy.policy;
  }

  /** Validates the URL and returns the address used to pin the connection. */
  async validate(rawUrl: string): Promise<PinnedAddress> {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new OutboundUrlError('Destination URL is not a valid URL');
    }

    const isCloud = this.environmentService.isCloud();
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new OutboundUrlError('Destination URL must use http or https');
    }
    if (isCloud && url.protocol !== 'https:') {
      throw new OutboundUrlError('Destination URL must use https');
    }
    if (url.username || url.password) {
      throw new OutboundUrlError('Destination URL must not contain credentials');
    }

    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    let resolved: ResolvedAddress[];
    if (isIPv4(hostname) || isIPv6(hostname)) {
      resolved = [{ address: hostname, family: isIPv4(hostname) ? 4 : 6 }];
    } else {
      try {
        resolved = await this.lookup(hostname);
      } catch {
        throw new OutboundUrlError(
          `Could not resolve destination host "${hostname}"`,
          true,
        );
      }
    }
    if (resolved.length === 0) {
      throw new OutboundUrlError(
        `Could not resolve destination host "${hostname}"`,
        true,
      );
    }

    if (isCloud) {
      const blocked = resolved.find((r) => isPrivateAddress(r.address));
      if (blocked) {
        throw new OutboundUrlError(
          `Destination host "${hostname}" resolves to a private or reserved address (${blocked.address}), which is not allowed`,
        );
      }
    } else {
      const refusal = findRefusal(
        resolved,
        effectivePort(url),
        this.resolvePolicy(),
      );
      if (refusal) throw new OutboundUrlError(describeRefusal(hostname, refusal));
    }

    const pick = resolved[0];
    return { hostname, address: pick.address, family: pick.family === 6 ? 6 : 4 };
  }
}
