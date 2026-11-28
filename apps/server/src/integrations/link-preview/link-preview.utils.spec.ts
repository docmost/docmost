import {
  buildFallbackTitle,
  decodeHtml,
  detectCharset,
  getFileNameTitle,
  getOembedEndpoint,
  isSignInUrl,
  mergeCookies,
  parseLinkPreview,
  parseOembed,
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

  it('leaves the title out when the page has none', () => {
    expect(parseLinkPreview('<html></html>', page).title).toBeUndefined();
  });

  it('drops an og:image declared under 100px and falls back to twitter:image', () => {
    const html = head(`
      <meta property="og:image" content="https://cdn.example.com/logo.png">
      <meta property="og:image:width" content="64">
      <meta property="og:image:height" content="64">
      <meta name="twitter:image" content="https://cdn.example.com/card.png">`);
    expect(parseLinkPreview(html, page).image).toBe('https://cdn.example.com/card.png');
  });

  it('keeps an og:image declared at 100px or more', () => {
    const html = head(`
      <meta property="og:image" content="https://cdn.example.com/og.png">
      <meta property="og:image:width" content="1200">
      <meta property="og:image:height" content="100">`);
    expect(parseLinkPreview(html, page).image).toBe('https://cdn.example.com/og.png');
  });

  it('finds a JSON oEmbed link and resolves it against the page', () => {
    const html = head(`
      <link rel="alternate" type="text/xml+oembed" href="/oembed.xml">
      <link rel="alternate" type="application/json+oembed" href="/oembed?url=x&amp;format=json">`);
    expect(parseLinkPreview(html, page).oembedUrl).toBe(
      'https://example.com/oembed?url=x&format=json',
    );
  });

  it('ignores an XML-only oEmbed link', () => {
    const html = head(`<link rel="alternate" type="text/xml+oembed" href="/oembed.xml">`);
    expect(parseLinkPreview(html, page).oembedUrl).toBeUndefined();
  });

  describe('titles a fragment link with its section', () => {
    const doc = (body: string, title = 'Guide') =>
      `<html><head><title>${title}</title><meta name="description" content="Page desc"></head><body>${body}</body></html>`;

    it('uses the heading with the id and the paragraph after it', () => {
      const html = doc('<h2 id="install">Install</h2><p>Run the installer.</p>');
      expect(parseLinkPreview(html, page, 'install')).toMatchObject({
        title: 'Install - Guide',
        description: 'Run the installer.',
      });
    });

    it('uses the heading inside a section with the id', () => {
      const html = doc('<section id="setup"><h3>Setup</h3><p>Set it up.</p></section>');
      expect(parseLinkPreview(html, page, 'setup')).toMatchObject({
        title: 'Setup - Guide',
        description: 'Set it up.',
      });
    });

    it('uses the heading around a named anchor', () => {
      const html = doc('<h2><a name="faq"></a>FAQ</h2><p>Questions.</p>');
      expect(parseLinkPreview(html, page, 'faq')).toMatchObject({
        title: 'FAQ - Guide',
        description: 'Questions.',
      });
    });

    it('uses the heading just before a user-content anchor', () => {
      const html = doc(
        '<div><h2>Usage</h2><a id="user-content-usage" href="#usage"></a></div><p>Call it.</p>',
      );
      expect(parseLinkPreview(html, page, 'usage')).toMatchObject({
        title: 'Usage - Guide',
        description: 'Call it.',
      });
    });

    it('finds the paragraph after a wrapped heading', () => {
      const html = doc(
        '<div class="mw-heading"><h2 id="History">History</h2><span>[edit]</span></div><figure>x</figure><p>It began in 1995.</p>',
      );
      expect(parseLinkPreview(html, page, 'History')).toMatchObject({
        title: 'History - Guide',
        description: 'It began in 1995.',
      });
    });

    it('skips paragraphs inside a history table', () => {
      const html = doc(
        '<h3 id="read">read()</h3><div><details><table><tr><td><p>Added in v2.</p></td></tr></table></details></div><p>Reads the file.</p>',
      );
      expect(parseLinkPreview(html, page, 'read').description).toBe('Reads the file.');
    });

    it('does not borrow a paragraph from the next section', () => {
      const html = doc(
        '<h2 id="links">Links</h2><ul><li>One</li></ul><div><h2 id="next">Next</h2></div><p>Other text.</p>',
      );
      expect(parseLinkPreview(html, page, 'links').description).toBe('Page desc');
    });

    it('uses a definition term and its description', () => {
      const html = doc(
        '<dl><dt id="os.walk">os.walk(top)<a class="headerlink" href="#os.walk">¶</a></dt><dd><p>Generate the file names.</p></dd></dl>',
      );
      expect(parseLinkPreview(html, page, 'os.walk')).toMatchObject({
        title: 'os.walk(top) - Guide',
        description: 'Generate the file names.',
      });
    });

    it('drops permalink markers but keeps a # that belongs to the text', () => {
      const html = doc('<h2 id="cs">C# notes <a href="#cs">#</a></h2>');
      expect(parseLinkPreview(html, page, 'cs').title).toBe('C# notes - Guide');
    });

    it('decodes the fragment', () => {
      const html = doc('<h2 id="über">Über</h2>');
      expect(parseLinkPreview(html, page, '%C3%BCber').title).toBe('Über - Guide');
    });

    it('keeps the page title and description when nothing matches', () => {
      const html = doc('<h2 id="install">Install</h2>');
      expect(parseLinkPreview(html, page, 'missing')).toMatchObject({
        title: 'Guide',
        description: 'Page desc',
      });
    });

    it('does not repeat a heading the page title already has', () => {
      const html = doc('<h1 id="install">Install</h1>', 'Install - Guide');
      expect(parseLinkPreview(html, page, 'install').title).toBe('Install - Guide');
    });

    it('uses the section alone when the page has no title', () => {
      const html = '<html><body><h2 id="install">Install</h2></body></html>';
      expect(parseLinkPreview(html, page, 'install').title).toBe('Install');
    });

    it('cuts the section to 100 before adding the page title', () => {
      const html = doc(`<h2 id="long">${'a'.repeat(150)}</h2>`);
      expect(parseLinkPreview(html, page, 'long').title).toBe(`${'a'.repeat(100)} - Guide`);
    });
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

    describe('escaped HTML in meta text', () => {
      const description = (content: string) =>
        parseLinkPreview(head(`<meta property="og:description" content="${content}">`), page)
          .description;

      it('drops a link and decodes a double-escaped space', () => {
        expect(
          description(
            'From the album,&amp;nbsp;featured in &lt;a href=&quot;https://x.test/ad&quot;&gt;this ad&lt;/a&gt;.',
          ),
        ).toBe('From the album, featured in this ad.');
      });

      it('joins inline tags without adding spaces', () => {
        expect(description('Hello &lt;b&gt;world&lt;/b&gt;!')).toBe('Hello world!');
      });

      it('turns block tags and line breaks into spaces', () => {
        expect(description('&lt;p&gt;One&lt;/p&gt;&lt;p&gt;Two&lt;br /&gt;Three&lt;/p&gt;')).toBe(
          'One Two Three',
        );
      });

      it('keeps a tag named in prose', () => {
        expect(description('The &lt;a&gt; HTML element creates a link.')).toBe(
          'The <a> HTML element creates a link.',
        );
        expect(parseLinkPreview(head('<title>&lt;a&gt;: The Anchor element</title>'), page).title).toBe(
          '<a>: The Anchor element',
        );
      });

      it('keeps comparisons that look nothing like tags', () => {
        expect(description('Use a &lt; b when b &gt; 0')).toBe('Use a < b when b > 0');
      });

      it('decodes a double-escaped title', () => {
        const html = head('<meta property="og:title" content="Tom &amp;amp; Jerry &amp;#8211; Pilot">');
        expect(parseLinkPreview(html, page).title).toBe('Tom & Jerry – Pilot');
      });

      it('stays fast on a long unclosed tag', () => {
        const start = Date.now();
        description(`&lt;a ${'='.repeat(200_000)}`);
        expect(Date.now() - start).toBeLessThan(1000);
      });
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

describe('parseOembed', () => {
  it('reads the title, thumbnail and provider icon, never the html', () => {
    expect(
      parseOembed(
        {
          title: ' A  video ',
          thumbnail_url: 'https://i.ytimg.com/vi/x/hqdefault.jpg',
          provider_url: 'https://www.youtube.com/',
          html: '<iframe src="https://www.youtube.com/embed/x"></iframe>',
        },
        'https://youtu.be/x',
      ),
    ).toEqual({
      title: 'A video',
      image: 'https://i.ytimg.com/vi/x/hqdefault.jpg',
      icon: 'https://www.youtube.com/favicon.ico',
    });
  });

  it('uses the page origin for the icon without a provider URL', () => {
    expect(parseOembed({ title: 'T' }, page).icon).toBe('https://example.com/favicon.ico');
  });

  it('drops a thumbnail declared under 100px', () => {
    expect(
      parseOembed(
        { title: 'T', thumbnail_url: 'https://cdn.example.com/t.jpg', thumbnail_width: 80, thumbnail_height: 80 },
        page,
      ).image,
    ).toBeUndefined();
  });

  it('ignores fields that are not strings and unsafe thumbnails', () => {
    expect(parseOembed({ title: 5, thumbnail_url: 'javascript:alert(1)' }, page)).toEqual({
      icon: 'https://example.com/favicon.ico',
    });
    expect(parseOembed(null, page)).toEqual({});
    expect(parseOembed('text', page)).toEqual({});
  });

  it('cuts a long title to 300', () => {
    expect(parseOembed({ title: 'c'.repeat(400) }, page).title).toHaveLength(300);
  });

  it('decodes an escaped title', () => {
    expect(parseOembed({ title: 'Q&amp;A &lt;b&gt;live&lt;/b&gt;' }, page).title).toBe('Q&A live');
  });
});

describe('getOembedEndpoint', () => {
  it.each([
    ['https://www.youtube.com/watch?v=abc', 'https://www.youtube.com/oembed'],
    ['https://youtu.be/abc', 'https://www.youtube.com/oembed'],
    ['https://m.youtube.com/watch?v=abc', 'https://www.youtube.com/oembed'],
    ['https://vimeo.com/76979871', 'https://vimeo.com/api/oembed.json'],
    ['https://www.nytimes.com/2026/01/01/us/story.html', 'https://www.nytimes.com/svc/oembed/json/'],
  ])('asks the provider endpoint for %s', (url, endpoint) => {
    const result = new URL(getOembedEndpoint(url)!);
    expect(`${result.origin}${result.pathname}`).toBe(endpoint);
    expect(result.searchParams.get('url')).toBe(url);
  });

  it.each([
    'https://example.com/watch?v=abc',
    'https://notyoutube.com/watch?v=abc',
    'https://youtube.com.example.net/watch?v=abc',
  ])('has no endpoint for %s', (url) => {
    expect(getOembedEndpoint(url)).toBeUndefined();
  });
});


describe('mergeCookies', () => {
  it('keeps the name and value of each Set-Cookie', () => {
    expect(mergeCookies(undefined, ['a=1; Path=/', 'b=2; HttpOnly'])).toBe('a=1; b=2');
  });

  it('replaces a cookie that is set again', () => {
    expect(mergeCookies('a=1; b=2', ['a=3; Secure'])).toBe('a=3; b=2');
  });

  it('has no header when nothing usable is set', () => {
    expect(mergeCookies(undefined, [])).toBeUndefined();
    expect(mergeCookies(undefined, ['no-equals-sign', '=nameless'])).toBeUndefined();
  });
});
