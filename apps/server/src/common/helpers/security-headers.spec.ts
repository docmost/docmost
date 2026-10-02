import {
  resolveFrameHeader,
  resolveFrameHeadersForPath,
  resolveAttachmentCsp,
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

describe('resolveAttachmentCsp', () => {
  it('returns a permissive CSP for PDF files (no default-src)', () => {
    // Regression: PDFs must not have default-src 'self' because the browser
    // built-in PDF viewer uses blob: URLs that violate that directive,
    // causing an empty <iframe> frame (issue #2347).
    const csp = resolveAttachmentCsp('.pdf');
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain('default-src');
  });

  it('returns the strict CSP for image files', () => {
    const csp = resolveAttachmentCsp('.jpg');
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("object-src 'self'");
    expect(csp).toContain("default-src 'self'");
  });

  it('returns the strict CSP for video files', () => {
    expect(resolveAttachmentCsp('.mp4')).toContain("default-src 'self'");
  });

  it('returns the strict CSP for audio files', () => {
    expect(resolveAttachmentCsp('.mp3')).toContain("default-src 'self'");
  });

  it('returns the strict CSP for arbitrary non-PDF extensions', () => {
    expect(resolveAttachmentCsp('.docx')).toContain("default-src 'self'");
    expect(resolveAttachmentCsp('.png')).toContain("default-src 'self'");
    expect(resolveAttachmentCsp('.zip')).toContain("default-src 'self'");
  });

  it('is case-sensitive — uppercase .PDF does not receive the permissive policy', () => {
    // fileExt values from the DB are always lowercase (derived from path.extname).
    // This test documents that assumption; if storage ever changes, this will catch it.
    expect(resolveAttachmentCsp('.PDF')).toContain("default-src 'self'");
  });
});
