import { BlockList, isIPv4, isIPv6 } from 'node:net';

export type OutboundPolicyMode = 'all' | 'none';

export type OutboundPolicyEntry = { list: BlockList; port?: number };

/** An invalid policy denies all private destinations. */
export type OutboundNetworkPolicy = {
  mode: OutboundPolicyMode;
  entries: OutboundPolicyEntry[];
  invalid: boolean;
};

function toBytes(address: string, family: 'ipv4' | 'ipv6'): number[] {
  if (family === 'ipv4') return address.split('.').map(Number);

  const bytesOf = (part: string): number[] =>
    part
      ? part.split(':').flatMap((group) => {
          if (group.includes('.')) return group.split('.').map(Number);
          const value = parseInt(group, 16);
          return [value >> 8, value & 0xff];
        })
      : [];

  const [head, tail] = address.split('::');
  const headBytes = bytesOf(head);
  const tailBytes = address.includes('::') ? bytesOf(tail) : [];
  const zeros = new Array(16 - headBytes.length - tailBytes.length).fill(0);
  return [...headBytes, ...zeros, ...tailBytes];
}

function hasHostBits(bytes: number[], prefix: number): boolean {
  return bytes.some((byte, index) => {
    const bitsBefore = index * 8;
    if (bitsBefore >= prefix) return byte !== 0;
    return (byte & (0xff >> Math.min(8, prefix - bitsBefore))) !== 0;
  });
}

/** Prefix zero is reserved for the explicit `all` mode. */
function parseCidr(
  raw: string,
): { address: string; prefix: number; family: 'ipv4' | 'ipv6' } | null {
  const [address, prefixRaw] = raw.split('/');
  if (!prefixRaw) return null;
  const prefix = Number(prefixRaw);
  if (!Number.isInteger(prefix) || prefix < 1) return null;
  const family = isIPv4(address) ? 'ipv4' : isIPv6(address) ? 'ipv6' : null;
  if (!family) return null;
  if (prefix > (family === 'ipv4' ? 32 : 128)) return null;
  if (hasHostBits(toBytes(address, family), prefix)) return null;
  return { address, prefix, family };
}

/** Parses optional ports without treating IPv6 colons as separators. */
function splitPort(token: string): { cidr: string; port?: number } {
  const bracketed = /^\[(.+)\](?::(\d+))?$/.exec(token);
  if (bracketed) {
    const [, cidr, port] = bracketed;
    return port === undefined ? { cidr } : { cidr, port: Number(port) };
  }
  const withPort = /^([^:]+):(\d+)$/.exec(token);
  if (withPort) return { cidr: withPort[1], port: Number(withPort[2]) };
  return { cidr: token };
}

function parseEntry(token: string): OutboundPolicyEntry | null {
  const { cidr: raw, port } = splitPort(token);
  if (port !== undefined && (port < 1 || port > 65535)) return null;
  const cidr = parseCidr(raw);
  if (!cidr) return null;
  const list = new BlockList();
  list.addSubnet(cidr.address, cidr.prefix, cidr.family);
  return { list, port };
}

/** Parses `[all|none,]CIDR[:port],...` and fails closed on invalid input. */
export function parseOutboundNetworkPolicy(raw: string): OutboundNetworkPolicy {
  const tokens = (raw ?? '')
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return { mode: 'none', entries: [], invalid: false };

  const first = tokens[0].toLowerCase();
  const hasMode = first === 'all' || first === 'none';
  const mode: OutboundPolicyMode = hasMode ? first : 'none';

  const entries: OutboundPolicyEntry[] = [];
  for (const token of hasMode ? tokens.slice(1) : tokens) {
    const entry = parseEntry(token);
    if (!entry) return { mode: 'none', entries: [], invalid: true };
    entries.push(entry);
  }
  return { mode, entries, invalid: false };
}

export function policyNamesAddress(
  policy: OutboundNetworkPolicy,
  ip: string,
  port: number,
): boolean {
  const family = isIPv4(ip) ? 'ipv4' : isIPv6(ip) ? 'ipv6' : null;
  if (!family) return false;
  return policy.entries.some(
    (entry) =>
      (entry.port === undefined || entry.port === port) && entry.list.check(ip, family),
  );
}
