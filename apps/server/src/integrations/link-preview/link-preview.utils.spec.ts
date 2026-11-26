import {
  buildFallbackTitle,
  decodeHtml,
  detectCharset,
  getFileNameTitle,
  isSignInUrl,
  parseLinkPreview,
} from './link-preview.utils';

const page = 'https://example.com/docs/page';
const head = (inner: string) => `<html><head>${inner}</head><body></body></html>`;

describe('parseLinkPreview', () => {
  it('prefers Open Graph over Twitter and the title tag', () => {
    const html = head(`
      <title>Title tag</title>
      <meta name="twitter:title" content="Twitter title">
      <meta property="og:title" content="OG title">
      <meta name="twitter:description" content="Twitter desc">
      <meta property="og:description" content="OG desc">
      <meta name="description" content="Plain desc">
      <meta name="twitter:image" content="https://cdn.example.com/t.png">
      <meta property="og:image" content="https://cdn.example.com/og.png">`);
    expect(parseLinkPreview(html, page)).toMatchObject({
      title: 'OG title',
      description: 'OG desc',
      image: 'https://cdn.example.com/og.png',
    });
  });

  it('falls back to Twitter tags', () => {
    const html = head(`
      <title>Title tag</title>
      <meta name="twitter:title" content="Twitter title">
      <meta name="twitter:description" content="Twitter desc">
      <meta name="twitter:image:src" content="https://cdn.example.com/t.png">`);
    expect(parseLinkPreview(html, page)).toMatchObject({
      title: 'Twitter title',
      description: 'Twitter desc',
      image: 'https://cdn.example.com/t.png',
    });
  });

  it('falls back to the title tag', () => {
    const html = head(`<title>Title tag</title><meta name="description" content="Plain desc">`);
    expect(parseLinkPreview(html, page)).toMatchObject({
      title: 'Title tag',
      description: 'Plain desc',
    });
  });

  it('reads og tags written with name instead of property', () => {
    const html = head(`<meta name="og:title" content="Named OG">`);
    expect(parseLinkPreview(html, page).title).toBe('Named OG');
  });

  it('falls back to host and path without a title', () => {
    expect(parseLinkPreview('<html></html>', 'https://example.com/docs/').title).toBe('example.com/docs');
    expect(parseLinkPreview('<html></html>', 'https://example.com').title).toBe('example.com');
  });

  it('resolves relative images against <base href>', () => {
    const html = head(`<base href="https://cdn.example.com/assets/"><meta property="og:image" content="img/a.png">`);
    expect(parseLinkPreview(html, page).image).toBe('https://cdn.example.com/assets/img/a.png');
  });

  it('resolves relative images against the page URL', () => {
    const html = head(`<meta property="og:image" content="/img/a.png">`);
    expect(parseLinkPreview(html, page).image).toBe('https://example.com/img/a.png');
  });

  it('drops a javascript: image', () => {
    const html = head(`<meta property="og:image" content="javascript:alert(1)">`);
    expect(parseLinkPreview(html, page).image).toBeUndefined();
  });

  it('falls through when a tier cleans to empty', () => {
    const html = head(`<meta property="og:title" content="\u0001"><meta name="twitter:title" content="Twitter title">`);
    expect(parseLinkPreview(html, page).title).toBe('Twitter title');
  });

  it('falls through from an invalid og:image:secure_url to og:image', () => {
    const html = head(`<meta property="og:image:secure_url" content="javascript:x"><meta property="og:image" content="https://cdn.example.com/og.png">`);
    expect(parseLinkPreview(html, page).image).toBe('https://cdn.example.com/og.png');
  });

  describe('picks icons in order', () => {
    it('prefers an SVG over sizes', () => {
      const html = head(`
        <link rel="icon" sizes="32x32" href="/i32.png">
        <link rel="icon" type="image/svg+xml" href="/i.svg">`);
      expect(parseLinkPreview(html, page).icon).toBe('https://example.com/i.svg');
    });

    it('prefers 32x32 over 16x16 and over 128x128', () => {
      const html = head(`
        <link rel="icon" sizes="16x16" href="/i16.png">
        <link rel="icon" sizes="128x128" href="/i128.png">
        <link rel="shortcut icon" sizes="32x32" href="/i32.png">`);
      expect(parseLinkPreview(html, page).icon).toBe('https://example.com/i32.png');
    });

    it('uses the smallest larger icon when none is 64 or less', () => {
      const html = head(`
        <link rel="icon" sizes="512x512" href="/i512.png">
        <link rel="icon" sizes="192x192" href="/i192.png">`);
      expect(parseLinkPreview(html, page).icon).toBe('https://example.com/i192.png');
    });

    it('uses apple-touch-icon when there is no icon link', () => {
      const html = head(`<link rel="apple-touch-icon" href="/apple.png">`);
      expect(parseLinkPreview(html, page).icon).toBe('https://example.com/apple.png');
    });

    it('uses /favicon.ico when nothing is declared', () => {
      expect(parseLinkPreview('<html></html>', page).icon).toBe('https://example.com/favicon.ico');
    });
  });

  describe('cleans text', () => {
    it('collapses whitespace and decodes entities', () => {
      const html = head(`<title>  A &amp; B\n\t C </title>`);
      expect(parseLinkPreview(html, page).title).toBe('A & B C');
    });

    it('strips control characters without doubling spaces', () => {
      const html = head(`<title>a \u0001 b</title>`);
      expect(parseLinkPreview(html, page).title).toBe('a b');
    });

    it('does not split an emoji at the cut boundary', () => {
      const html = head(`<title>${'a'.repeat(299)}😀bbb</title>`);
      const title = parseLinkPreview(html, page).title;
      expect(Array.from(title)).toHaveLength(300);
      expect(title.endsWith('😀')).toBe(true);
    });

    it('cuts a long description to 500', () => {
      const html = head(`<meta name="description" content="${'a'.repeat(5000)}">`);
      expect(parseLinkPreview(html, page).description).toHaveLength(500);
    });

    it('cuts a long title to 300', () => {
      const html = head(`<title>${'b'.repeat(400)}</title>`);
      expect(parseLinkPreview(html, page).title).toHaveLength(300);
    });
  });
});

describe('detectCharset', () => {
  const bytes = (s: string) => new TextEncoder().encode(s);

  it('reads the Content-Type charset', () => {
    expect(detectCharset('text/html; charset=Shift_JIS', new Uint8Array())).toBe('shift_jis');
  });

  it('reads <meta charset>', () => {
    expect(detectCharset('text/html', bytes('<meta charset="windows-1252">'))).toBe('windows-1252');
  });

  it('reads http-equiv content', () => {
    const head = '<meta http-equiv="Content-Type" content="text/html; charset=euc-kr">';
    expect(detectCharset(null, bytes(head))).toBe('euc-kr');
  });

  it('falls back to utf-8 for an unknown label', () => {
    expect(detectCharset('text/html; charset=x-nope', new Uint8Array())).toBe('utf-8');
  });
});

describe('decodeHtml', () => {
  it('decodes windows-1252', () => {
    expect(decodeHtml(new Uint8Array([0x93, 0x71, 0x94]), 'text/html; charset=windows-1252')).toBe('“q”');
  });

  it('decodes shift_jis', () => {
    expect(decodeHtml(new Uint8Array([0x93, 0xfa, 0x96, 0x7b]), 'text/html; charset=shift_jis')).toBe('日本');
  });
});

describe('getFileNameTitle', () => {
  it('uses the decoded last path segment', () => {
    expect(getFileNameTitle('https://example.com/files/Q3%20Report.pdf')).toBe('Q3 Report.pdf');
  });

  it('falls back to host for a bare origin', () => {
    expect(getFileNameTitle('https://example.com/')).toBe('example.com');
  });
});

describe('buildFallbackTitle', () => {
  it('drops the trailing slash', () => {
    expect(buildFallbackTitle('https://example.com/docs/')).toBe('example.com/docs');
  });
});

describe('fallback title cleaning', () => {
  it('has no newline for an encoded one', () => {
    expect(buildFallbackTitle('https://example.com/a%0Ab')).not.toMatch(/\n/);
    expect(getFileNameTitle('https://example.com/a%0Ab.pdf')).not.toMatch(/\n/);
  });

  it('falls back to the host and path when the last segment cleans to nothing', () => {
    expect(getFileNameTitle('https://example.com/docs/%20')).toBe('example.com/docs');
  });

  it('caps the last-resort fallback at 300 code points', () => {
    expect(buildFallbackTitle(' '.repeat(400))).toHaveLength(300);
  });

  it('cuts a long file name to 300', () => {
    const url = `https://example.com/${'x'.repeat(2000)}.pdf`;
    expect(getFileNameTitle(url)).toHaveLength(300);
    expect(buildFallbackTitle(url)).toHaveLength(300);
  });
});

describe('isSignInUrl', () => {
  it.each([
    'https://accounts.google.com/ServiceLogin?continue=x',
    'https://acme.okta.com/app/x',
    'https://jira.acme.com/login.jsp',
    'https://gitlab.com/users/sign_in',
    'https://accounts.google.com./x',
    'https://acme.okta.com./app/x',
    'https://jira.acme.com/login;jsessionid=x',
  ])('is true for %s', (url) => {
    expect(isSignInUrl(url)).toBe(true);
  });

  it.each([
    'https://example.com/authors/jane',
    'https://example.com/blog/sso-explained',
    'https://www.youtube.com/watch?v=x',
  ])('is false for %s', (url) => {
    expect(isSignInUrl(url)).toBe(false);
  });
});
