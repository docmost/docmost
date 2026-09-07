import { Logger } from '@nestjs/common';
import {
  isAlwaysBlockedAddress,
  isHardBlockedAddress,
  isPrivateAddress,
  isPrivateNetworkAddress,
  OutboundUrlError,
  OutboundUrlGuard,
} from './outbound-url.guard';

function guard(
  isCloud: boolean,
  addresses: Array<{ address: string; family: number }>,
  privateNetworks: string = 'none',
) {
  return new OutboundUrlGuard(
    {
      isCloud: () => isCloud,
      getAllowedPrivateNetworks: () => privateNetworks,
    } as any,
    async () => addresses,
  );
}

function family(ip: string): number {
  return ip.includes(':') ? 6 : 4;
}

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1',
    '::1', '::', 'fe80::1', 'fc00::1', 'fd12::1', 'ff02::1', '::ffff:10.0.0.1',
    '0:0:0:0:0:0:0:1', '::ffff:a00:1', '::ffff:7f00:1', '0000:0000:0000:0000:0000:0000:0000:0000',
    '192.0.0.1', '192.0.2.1', '192.88.99.1', '198.18.0.1', '198.51.100.7', '203.0.113.5',
    '::a00:1', '64:ff9b::a00:1', '64:ff9b:1::a00:1', '100::1', '2001::1', '2001:0:a00:1::1', '2001:db8::1', '2002:a00:1::1', 'fec0::1',
  ])('flags %s as private or reserved', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '172.32.0.1', '2606:4700::1111', '::ffff:8.8.8.8', '::ffff:5db8:d822', '::ffff:8.8.8.8', '2001:4860:4860::8888', '100.128.0.1', '198.17.255.255'])(
    'allows public %s',
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    },
  );
});

describe('isAlwaysBlockedAddress / isPrivateNetworkAddress', () => {
  it.each([
    '0.0.0.0', '127.0.0.1', '169.254.169.254', '192.0.0.1', '192.0.2.1',
    '192.88.99.1', '198.18.0.1', '198.51.100.7', '203.0.113.5', '224.0.0.1',
    '::1', '::', '::ffff:127.0.0.1', '::ffff:0:7f00:1', '64:ff9b::a00:1', '64:ff9b:1::a00:1',
    '100::1', '2001::1', '2001:db8::1', '2002:a00:1::1', 'fe80::1', 'fec0::1',
    'ff02::1',
  ])('flags %s as always-blocked but not a private network', (ip) => {
    expect(isAlwaysBlockedAddress(ip)).toBe(true);
    expect(isPrivateNetworkAddress(ip)).toBe(false);
  });

  it.each([
    '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.1', '100.64.0.1',
    'fc00::1', 'fd12::1',
  ])('flags %s as a private network but not always-blocked', (ip) => {
    expect(isPrivateNetworkAddress(ip)).toBe(true);
    expect(isAlwaysBlockedAddress(ip)).toBe(false);
  });

  it.each(['8.8.8.8', '172.32.0.1', '2606:4700::1111', '100.128.0.1'])(
    'allows public %s in both',
    (ip) => {
      expect(isAlwaysBlockedAddress(ip)).toBe(false);
      expect(isPrivateNetworkAddress(ip)).toBe(false);
    },
  );

  it('the two lists together are exactly isPrivateAddress', () => {
    for (const ip of ['10.0.0.5', '127.0.0.1', '8.8.8.8', 'fe80::1', 'fc00::1']) {
      expect(isAlwaysBlockedAddress(ip) || isPrivateNetworkAddress(ip)).toBe(
        isPrivateAddress(ip),
      );
    }
  });
});

describe('OutboundUrlGuard.validate', () => {
  const publicV4 = { address: '93.184.216.34', family: 4 };

  it('rejects http on cloud', async () => {
    await expect(guard(true, [publicV4]).validate('http://siem.example.com/x'))
      .rejects.toThrow(OutboundUrlError);
  });

  it('rejects hosts that resolve to a private range on cloud', async () => {
    await expect(
      guard(true, [publicV4, { address: '10.0.0.5', family: 4 }]).validate('https://siem.example.com'),
    ).rejects.toThrow(/private or reserved/);
  });

  it('rejects the cloud metadata address literal', async () => {
    await expect(guard(true, []).validate('https://169.254.169.254/latest'))
      .rejects.toThrow(/private or reserved/);
  });

  it('allows LAN hosts and http on self-hosted when private networks are allowed', async () => {
    const pinned = await guard(false, [{ address: '10.0.5.20', family: 4 }], 'all')
      .validate('http://splunk.internal:8088/services/collector/event');
    expect(pinned).toEqual({ hostname: 'splunk.internal', address: '10.0.5.20', family: 4 });
  });

  it('pins the first resolved address and keeps the hostname for SNI', async () => {
    const pinned = await guard(true, [{ address: '2606:4700::1111', family: 6 }, publicV4])
      .validate('https://siem.example.com');
    expect(pinned).toEqual({ hostname: 'siem.example.com', address: '2606:4700::1111', family: 6 });
  });

  it('rejects credentials in the URL and unresolvable hosts', async () => {
    await expect(guard(false, [publicV4]).validate('https://user:pw@siem.example.com'))
      .rejects.toThrow(/credentials/);
    await expect(guard(false, []).validate('https://nope.example.com'))
      .rejects.toThrow(/Could not resolve/);
  });

  it('marks resolution failures retryable and configuration failures not', async () => {
    const throwing = new OutboundUrlGuard(
      { isCloud: () => false } as any,
      async () => {
        throw new Error('EAI_AGAIN');
      },
    );

    const dnsError = await throwing
      .validate('https://siem.example.com')
      .catch((e) => e);
    expect(dnsError).toBeInstanceOf(OutboundUrlError);
    expect(dnsError.retryable).toBe(true);

    const emptyError = await guard(false, [])
      .validate('https://nope.example.com')
      .catch((e) => e);
    expect(emptyError.retryable).toBe(true);

    for (const url of [
      'not-a-url',
      'ftp://siem.example.com',
      'https://user:pw@siem.example.com',
    ]) {
      const err = await guard(false, [publicV4])
        .validate(url)
        .catch((e) => e);
      expect(err).toBeInstanceOf(OutboundUrlError);
      expect(err.retryable).toBe(false);
    }

    const privateError = await guard(true, [{ address: '10.0.0.5', family: 4 }])
      .validate('https://siem.example.com')
      .catch((e) => e);
    expect(privateError.retryable).toBe(false);
  });

  const hardBlocked = ['169.254.169.254', '0.0.0.0', 'fe80::1', 'ff02::1'];
  const loopbackOrReserved = ['127.0.0.1', '::1', '::ffff:127.0.0.1', '192.0.2.1'];

  it.each(hardBlocked)(
    'self-hosted refuses %s under every ALLOWED_PRIVATE_NETWORKS value',
    async (ip) => {
      for (const value of ['all', 'none', '169.254.0.0/16', 'all,169.254.0.0/16', 'all,fe80::/10']) {
        await expect(
          guard(false, [{ address: ip, family: family(ip) }], value).validate(
            'http://siem.internal',
          ),
        ).rejects.toThrow(/link-local, metadata or reserved address .* which is never allowed/);
      }
    },
  );

  it.each(loopbackOrReserved)(
    'self-hosted refuses %s unless an entry names it',
    async (ip) => {
      for (const value of ['all', 'none']) {
        await expect(
          guard(false, [{ address: ip, family: family(ip) }], value).validate(
            'http://siem.internal',
          ),
        ).rejects.toThrow(
          /resolves to a loopback or reserved address .* Set ALLOWED_PRIVATE_NETWORKS on the server to allow it/,
        );
      }
    },
  );

  it.each(['10.1.2.3', '192.168.1.10'])(
    'self-hosted refuses private network %s by default',
    async (ip) => {
      await expect(
        guard(false, [{ address: ip, family: 4 }]).validate('http://siem.internal'),
      ).rejects.toThrow(
        /resolves to a private address .* Set ALLOWED_PRIVATE_NETWORKS on the server to allow it/,
      );
    },
  );

  it.each(['10.1.2.3', '192.168.1.10', 'fc00::1', '100.64.0.1'])(
    'all accepts private network %s',
    async (ip) => {
      const pinned = await guard(
        false,
        [{ address: ip, family: family(ip) }],
        'all',
      ).validate('http://siem.internal');
      expect(pinned.address).toBe(ip);
    },
  );

  it('all still refuses loopback, and a loopback entry opts it back in', async () => {
    await expect(
      guard(false, [{ address: '127.0.0.1', family: 4 }], 'all').validate(
        'http://siem.internal',
      ),
    ).rejects.toThrow(/loopback or reserved/);

    const allowed = await guard(
      false,
      [{ address: '127.0.0.1', family: 4 }],
      'all,127.0.0.0/8',
    ).validate('http://siem.internal');
    expect(allowed.address).toBe('127.0.0.1');

    const lan = await guard(
      false,
      [{ address: '10.1.2.3', family: 4 }],
      'all,127.0.0.0/8',
    ).validate('http://siem.internal');
    expect(lan.address).toBe('10.1.2.3');

    await expect(
      guard(false, [{ address: '::1', family: 6 }], 'all,127.0.0.0/8').validate(
        'http://siem.internal',
      ),
    ).rejects.toThrow(/loopback or reserved/);
  });

  it('an entry with a port matches only that port', async () => {
    const policy = 'none,192.168.1.20/32:8088';

    const allowed = await guard(
      false,
      [{ address: '192.168.1.20', family: 4 }],
      policy,
    ).validate('https://192.168.1.20:8088/services/collector/event');
    expect(allowed.address).toBe('192.168.1.20');

    await expect(
      guard(false, [{ address: '192.168.1.20', family: 4 }], policy).validate(
        'https://192.168.1.20',
      ),
    ).rejects.toThrow(/private address/);

    await expect(
      guard(false, [{ address: '192.168.1.21', family: 4 }], policy).validate(
        'https://192.168.1.21:8088',
      ),
    ).rejects.toThrow(/private address/);
  });

  it('a bracketed IPv6 entry with a port accepts only that port', async () => {
    const policy = '[::1/128]:8088';

    const allowed = await guard(
      false,
      [{ address: '::1', family: 6 }],
      policy,
    ).validate('http://[::1]:8088/ingest');
    expect(allowed).toEqual({ hostname: '::1', address: '::1', family: 6 });

    await expect(
      guard(false, [{ address: '::1', family: 6 }], policy).validate('http://[::1]/ingest'),
    ).rejects.toThrow(/loopback or reserved/);
  });

  it('an entry without a port matches every port', async () => {
    for (const url of ['http://127.0.0.1:8088', 'https://127.0.0.1', 'http://127.0.0.1']) {
      const allowed = await guard(
        false,
        [{ address: '127.0.0.1', family: 4 }],
        '127.0.0.0/8',
      ).validate(url);
      expect(allowed.address).toBe('127.0.0.1');
    }
  });

  it('entries without a mode none every private network not named', async () => {
    const allowed = await guard(
      false,
      [{ address: '192.168.1.10', family: 4 }],
      '192.168.1.0/24',
    ).validate('http://siem.internal');
    expect(allowed.address).toBe('192.168.1.10');

    await expect(
      guard(false, [{ address: '10.1.2.3', family: 4 }], '192.168.1.0/24').validate(
        'http://siem.internal',
      ),
    ).rejects.toThrow(/private address/);
  });

  it('an unparseable value denies everything private or reserved and logs once per process', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const g = guard(false, [{ address: '10.1.2.3', family: 4 }], 'all,10.0.0.0/8, not-a-cidr');

    await expect(g.validate('http://siem.internal')).rejects.toThrow(/private address/);
    await expect(g.validate('http://siem.internal')).rejects.toThrow(/private address/);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toMatch(/ALLOWED_PRIVATE_NETWORKS/);
    errorSpy.mockRestore();
  });

  it('cloud ignores ALLOWED_PRIVATE_NETWORKS and always refuses private and reserved ranges', async () => {
    for (const ip of [...hardBlocked, ...loopbackOrReserved, '10.1.2.3', '192.168.1.10']) {
      for (const value of ['all', 'none', '127.0.0.0/8', 'all,10.0.0.0/8']) {
        await expect(
          guard(true, [{ address: ip, family: family(ip) }], value).validate(
            'https://siem.example.com',
          ),
        ).rejects.toThrow(/private or reserved/);
      }
    }
  });

  it('refuses a resolved address that is not an IP address', async () => {
    await expect(
      guard(false, [{ address: 'not-an-ip', family: 4 }], 'all').validate(
        'http://siem.internal',
      ),
    ).rejects.toThrow(/is not an IP address/);
  });

  it('refuses the whole host when any one of its addresses is refused', async () => {
    await expect(
      guard(
        false,
        [publicV4, { address: '10.1.2.3', family: 4 }],
        'none',
      ).validate('http://siem.internal'),
    ).rejects.toThrow(/private address/);

    await expect(
      guard(
        false,
        [publicV4, { address: '127.0.0.1', family: 4 }],
        'all',
      ).validate('http://siem.internal'),
    ).rejects.toThrow(/loopback or reserved/);

    await expect(
      guard(
        false,
        [publicV4, { address: '169.254.169.254', family: 4 }],
        'all',
      ).validate('http://siem.internal'),
    ).rejects.toThrow(/never allowed/);
  });

  it('refuses an IPv4-translated loopback address even when private networks are allowed', async () => {
    await expect(
      guard(false, [{ address: '::ffff:0:7f00:1', family: 6 }], 'all').validate(
        'http://siem.internal',
      ),
    ).rejects.toThrow(/loopback or reserved/);
  });

  it('a public address is allowed in every mode', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    for (const value of ['all', 'none', '', '192.168.1.0/24', 'garbage']) {
      await expect(
        guard(false, [publicV4], value).validate('http://siem.example.com'),
      ).resolves.toMatchObject({ address: publicV4.address });
    }
    await expect(
      guard(true, [publicV4], 'all').validate('https://siem.example.com'),
    ).resolves.toMatchObject({ address: publicV4.address });
    errorSpy.mockRestore();
  });
});

describe('isHardBlockedAddress', () => {
  it.each([
    '0.0.0.0', '169.254.169.254', '224.0.0.1', '255.255.255.255',
    '::', 'fe80::1', 'ff02::1',
  ])('flags %s as hard-blocked', (ip) => {
    expect(isHardBlockedAddress(ip)).toBe(true);
  });

  it.each(['127.0.0.1', '::1', '192.0.2.1', 'fec0::1', '8.8.8.8'])(
    'does not flag %s as hard-blocked (it may still be always-blocked)',
    (ip) => {
      expect(isHardBlockedAddress(ip)).toBe(false);
    },
  );

  it('is a subset of isAlwaysBlockedAddress', () => {
    for (const ip of ['0.0.0.0', '169.254.169.254', 'fe80::1', 'ff02::1']) {
      expect(isAlwaysBlockedAddress(ip)).toBe(true);
    }
  });
});
