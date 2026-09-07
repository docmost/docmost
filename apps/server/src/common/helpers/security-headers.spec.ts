import {
  resolveFrameHeader,
  resolveFrameHeadersForPath,
  SecurityHeader,
} from './security-headers';

describe('resolveFrameHeader', () => {
  it('denies framing with X-Frame-Options when embedding is off', () => {
    expect(resolveFrameHeader(false, [])).toEqual({
      name: 'X-Frame-Options',
      value: 'SAMEORIGIN',
    });
  });

  it('returns null when embedding is on but no origins are configured', () => {
    expect(resolveFrameHeader(true, [])).toBeNull();
  });

  it('emits a frame-ancestors CSP for the allowed origins', () => {
    expect(resolveFrameHeader(true, ['https://a.example', 'https://b.example']))
      .toEqual({
        name: 'Content-Security-Policy',
        value: "frame-ancestors 'self' https://a.example https://b.example",
      });
  });
});

describe('resolveFrameHeadersForPath', () => {
  const configured: SecurityHeader = {
    name: 'Content-Security-Policy',
    value: "frame-ancestors 'self' https://a.example",
  };

  it.each(['/oauth/consent', '/oauth/consent/nested'])(
    'force-denies %s regardless of configured header',
    (path) => {
      expect(resolveFrameHeadersForPath(path, configured)).toEqual([
        { name: 'X-Frame-Options', value: 'DENY' },
        { name: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
      ]);
    },
  );

  it('force-denies consent even when the global header is absent', () => {
    expect(resolveFrameHeadersForPath('/oauth/consent', null)).toEqual([
      { name: 'X-Frame-Options', value: 'DENY' },
      { name: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
    ]);
  });

  it('does not match an unrelated path that merely contains the prefix', () => {
    expect(
      resolveFrameHeadersForPath('/oauth/consenting-adults', configured),
    ).toEqual([configured]);
  });

  it('passes the configured header through for other paths', () => {
    expect(resolveFrameHeadersForPath('/home', configured)).toEqual([
      configured,
    ]);
  });

  it('returns nothing for other paths when no header is configured', () => {
    expect(resolveFrameHeadersForPath('/home', null)).toEqual([]);
  });
});
