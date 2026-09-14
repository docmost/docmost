import {
  parseOutboundNetworkPolicy,
  policyNamesAddress,
} from './outbound-network-policy';

describe('parseOutboundNetworkPolicy', () => {
  it('parses a bare mode', () => {
    expect(parseOutboundNetworkPolicy('all')).toMatchObject({
      mode: 'all',
      entries: [],
      invalid: false,
    });
    expect(parseOutboundNetworkPolicy('none')).toMatchObject({
      mode: 'none',
      entries: [],
      invalid: false,
    });
  });

  it('treats an empty value as none with no entries', () => {
    for (const raw of ['', '   ', ',,']) {
      expect(parseOutboundNetworkPolicy(raw)).toMatchObject({
        mode: 'none',
        entries: [],
        invalid: false,
      });
    }
  });

  it('ignores case and surrounding whitespace on the mode', () => {
    expect(parseOutboundNetworkPolicy('  ALL ')).toMatchObject({
      mode: 'all',
      invalid: false,
    });
  });

  it('parses a mode followed by entries', () => {
    const policy = parseOutboundNetworkPolicy('all,127.0.0.0/8,::1/128');

    expect(policy.mode).toBe('all');
    expect(policy.entries).toHaveLength(2);
    expect(policyNamesAddress(policy, '127.0.0.1', 80)).toBe(true);
    expect(policyNamesAddress(policy, '127.0.0.1', 8088)).toBe(true);
    expect(policyNamesAddress(policy, '::1', 443)).toBe(true);
    expect(policyNamesAddress(policy, '10.1.2.3', 443)).toBe(false);
  });

  it('parses an entry with a port and matches only that port', () => {
    const policy = parseOutboundNetworkPolicy('none,192.168.1.20/32:8088');

    expect(policy.mode).toBe('none');
    expect(policyNamesAddress(policy, '192.168.1.20', 8088)).toBe(true);
    expect(policyNamesAddress(policy, '192.168.1.20', 443)).toBe(false);
    expect(policyNamesAddress(policy, '192.168.1.21', 8088)).toBe(false);
  });

  it('parses a bracketed IPv6 entry with a port', () => {
    const policy = parseOutboundNetworkPolicy('[::1/128]:8088');

    expect(policy.mode).toBe('none');
    expect(policyNamesAddress(policy, '::1', 8088)).toBe(true);
    expect(policyNamesAddress(policy, '::1', 80)).toBe(false);
  });

  it('treats entries without a mode as none plus those entries', () => {
    const policy = parseOutboundNetworkPolicy('10.0.0.0/8');

    expect(policy.mode).toBe('none');
    expect(policy.invalid).toBe(false);
    expect(policyNamesAddress(policy, '10.1.2.3', 443)).toBe(true);
    expect(policyNamesAddress(policy, '192.168.1.1', 443)).toBe(false);
  });

  it.each([
    'not-a-cidr',
    'all,not-a-cidr',
    'all,10.0.0.0/8,nonsense',
    '10.0.0.0/33',
    '10.0.0.0',
    '::1/129',
    '::1/128:8088',
    '10.0.0.0/8:0',
    '10.0.0.0/8:70000',
    '[::1/128]:notaport',
    '0.0.0.0/0',
    '::/0',
    'all,0.0.0.0/0',
    '[::/0]:8088',
    '192.168.1.20/24',
    '10.1.0.0/8',
    '172.16.0.1/12',
    'fc00::1/7',
    '[::1/127]',
    '2001:db8::1/32:8088',
  ])('fails closed on %s', (raw) => {
    expect(parseOutboundNetworkPolicy(raw)).toMatchObject({
      mode: 'none',
      entries: [],
      invalid: true,
    });
  });

  it.each([
    '10.0.0.0/8',
    '172.16.0.0/12',
    '100.64.0.0/10',
    '192.168.1.20/32',
    'fc00::/7',
    'fe80::/10',
    '::1/128',
  ])('accepts %s, whose address sits on its prefix boundary', (raw) => {
    expect(parseOutboundNetworkPolicy(raw)).toMatchObject({
      entries: [expect.anything()],
      invalid: false,
    });
  });

  it('accepts a bracketed IPv6 entry without a port as the unbracketed form', () => {
    const bracketed = parseOutboundNetworkPolicy('[::1/128]');
    const bare = parseOutboundNetworkPolicy('::1/128');

    expect(bracketed).toMatchObject({ mode: 'none', invalid: false });
    for (const port of [80, 443, 8088]) {
      expect(policyNamesAddress(bracketed, '::1', port)).toBe(
        policyNamesAddress(bare, '::1', port),
      );
      expect(policyNamesAddress(bracketed, '::1', port)).toBe(true);
    }
  });

  it('never names an address when the value is unparseable or the address is not an IP', () => {
    const policy = parseOutboundNetworkPolicy('all,10.0.0.0/8');

    expect(policyNamesAddress(policy, 'siem.internal', 443)).toBe(false);
    expect(policyNamesAddress(parseOutboundNetworkPolicy('garbage'), '10.1.2.3', 443)).toBe(false);
  });

  it('matches an IPv4-mapped IPv6 address against an IPv4 entry', () => {
    const policy = parseOutboundNetworkPolicy('127.0.0.0/8');

    expect(policyNamesAddress(policy, '::ffff:127.0.0.1', 80)).toBe(true);
  });
});
