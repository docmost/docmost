import { CheerioAPI, load } from 'cheerio';
import { LinkPreview, LinkPreviewPage } from './link-preview.types';
import {
  LINK_PREVIEW_DESCRIPTION_MAX_LENGTH,
  LINK_PREVIEW_MIN_IMAGE_SIZE,
  LINK_PREVIEW_OEMBED_PROVIDERS,
  LINK_PREVIEW_SECTION_TITLE_MAX_LENGTH,
  LINK_PREVIEW_SIGN_IN_HOST_SUFFIXES,
  LINK_PREVIEW_SIGN_IN_HOSTS,
  LINK_PREVIEW_SIGN_IN_PATH_SEGMENTS,
  LINK_PREVIEW_TITLE_MAX_LENGTH,
  LINK_PREVIEW_URL_MAX_LENGTH,
} from './link-preview.constants';

const MAX_ICON_SIZE = 64;
const DEFAULT_ICON_SIZE = 16;
const CHARSET_SCAN_BYTES = 1024;

const TITLE_KEYS = ['og:title', 'twitter:title'];
const DESCRIPTION_KEYS = [
  'og:description',
  'twitter:description',
  'description',
];
const OG_IMAGE_KEYS = ['og:image:secure_url', 'og:image', 'og:image:url'];
const TWITTER_IMAGE_KEYS = ['twitter:image', 'twitter:image:src'];
const OEMBED_LINK_TYPES = ['application/json+oembed', 'text/json+oembed'];
const HEADINGS = 'h1, h2, h3, h4, h5, h6';

// A tag with attributes, a closing tag or a self-closing tag means the text carries markup.
const MARKUP = /<[a-z][a-z0-9-]*\s[^<>=]*=[^<>]*>|<\/[a-z][a-z0-9-]*\s*>|<[a-z][a-z0-9-]*\s*\/>/i;
const TAG = /<\/?([a-z][a-z0-9-]*)(?:\s[^<>]*)?\/?>/gi;
const INLINE_TAGS = new Set([
  'a', 'abbr', 'b', 'code', 'em', 'i', 'mark', 's', 'small', 'span', 'strong', 'sub', 'sup', 'u',
]);
const ENTITY = /&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);/i;

// Some sites escape HTML into their meta text: decode it, then drop the tags; a bare "<a>" named in prose stays.
function stripMarkup(value: string): string {
  const text = ENTITY.test(value)
    ? load(value.replace(/</g, '&lt;'), null, false).text()
    : value;
  return MARKUP.test(text)
    ? text.replace(TAG, (_, name: string) =>
        INLINE_TAGS.has(name.toLowerCase()) ? '' : ' ',
      )
    : text;
}

function cleanText(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined;
  const cleaned = stripMarkup(value)
    .replace(/[\u0000-\u0008\u000e-\u001f\u007f-\u009f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return undefined;
  let result = '';
  let count = 0;
  for (const char of cleaned) {
    if (count++ === maxLength) break;
    result += char;
  }
  return result;
}

function firstText(values: string[], maxLength: number): string | undefined {
  for (const value of values) {
    const text = cleanText(value, maxLength);
    if (text) return text;
  }
  return undefined;
}

function firstUrl(values: (string | undefined)[], base: string): string | undefined {
  for (const value of values) {
    const url = toHttpUrl(value, base);
    if (url) return url;
  }
  return undefined;
}

function toHttpUrl(value: string | undefined, base: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim(), base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    if (url.href.length > LINK_PREVIEW_URL_MAX_LENGTH) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

function readMeta($: CheerioAPI, keys: string[]): string[] {
  return keys.flatMap((key) =>
    $('meta')
      .filter((_, el) => {
        const attrs = el.attribs ?? {};
        return [attrs.property, attrs.name].some(
          (v) => v?.trim().toLowerCase() === key,
        );
      })
      .map((_, el) => el.attribs.content)
      .get()
      .filter(Boolean),
  );
}

function resolveBase($: CheerioAPI, pageUrl: string): string {
  return toHttpUrl($('base[href]').first().attr('href'), pageUrl) ?? pageUrl;
}

function largestSize(sizes: string | undefined): number {
  const widths = (sizes ?? '')
    .split(/\s+/)
    .map((s) => /^(\d+)x\d+$/i.exec(s)?.[1])
    .filter(Boolean)
    .map(Number);
  return widths.length ? Math.max(...widths) : DEFAULT_ICON_SIZE;
}

function pickIcon($: CheerioAPI, base: string, pageUrl: string): string {
  const candidates = $('link[rel][href]')
    .filter((_, el) =>
      el.attribs.rel.toLowerCase().split(/\s+/).includes('icon'),
    )
    .map((_, el) => ({
      href: toHttpUrl(el.attribs.href, base),
      type: el.attribs.type?.toLowerCase(),
      size: largestSize(el.attribs.sizes),
    }))
    .get()
    .filter((c) => c.href);

  const svg = candidates.find(
    (c) => c.type === 'image/svg+xml' || new URL(c.href).pathname.toLowerCase().endsWith('.svg'),
  );
  if (svg) return svg.href;

  const best = candidates
    .filter((c) => c.size <= MAX_ICON_SIZE)
    .reduce<(typeof candidates)[number] | undefined>(
      (acc, c) => (!acc || c.size > acc.size ? c : acc),
      undefined,
    );
  if (best) return best.href;

  const smallestLarger = candidates
    .filter((c) => c.size > MAX_ICON_SIZE)
    .reduce<(typeof candidates)[number] | undefined>(
      (acc, c) => (!acc || c.size < acc.size ? c : acc),
      undefined,
    );
  if (smallestLarger) return smallestLarger.href;

  const apple = $('link[rel][href]')
    .filter((_, el) =>
      ['apple-touch-icon', 'apple-touch-icon-precomposed'].includes(
        el.attribs.rel.toLowerCase().trim(),
      ),
    )
    .map((_, el) => toHttpUrl(el.attribs.href, base))
    .get()
    .find(Boolean);
  if (apple) return apple;

  return `${new URL(pageUrl).origin}/favicon.ico`;
}

function isTiny(...sizes: unknown[]): boolean {
  return sizes.some((size) => {
    if (typeof size !== 'number' && typeof size !== 'string') return false;
    const value = Number(size);
    return value > 0 && value < LINK_PREVIEW_MIN_IMAGE_SIZE;
  });
}

function findSection(
  $: CheerioAPI,
  fragment: string,
): { title?: string; description?: string } {
  const target = [fragment, `user-content-${fragment}`]
    .map((id) =>
      $('[id], a[name]')
        .filter((_, el) => (el.attribs.id ?? el.attribs.name) === id)
        .first(),
    )
    .find((el) => el.length > 0);
  if (!target) return {};

  const heading = target.is(`${HEADINGS}, dt`)
    ? target
    : [
        target.find(HEADINGS).first(),
        target.closest(HEADINGS),
        target.prev(HEADINGS),
      ].find((el) => el.length > 0);
  // The first paragraph after el, climbing out of wrappers, never past the next heading.
  const paragraphAfter = (el: NonNullable<typeof heading>) => {
    for (let node = el, depth = 0; node.length && depth < 3; node = node.parent(), depth++) {
      for (const sibling of node.nextAll().toArray()) {
        const next = $(sibling);
        if (next.is('p')) return next;
        if (next.is(HEADINGS) || next.find(HEADINGS).length) return undefined;
        // Collapsed history and metadata tables are not the section's text.
        const inner = next
          .find('p')
          .filter((_, p) => !$(p).closest('table, details').length)
          .first();
        if (inner.length) return inner;
      }
    }
    return undefined;
  };
  const inside = target.find('p').first();
  const paragraph = target.is('dt')
    ? target.next('dd')
    : inside.length
      ? inside
      : paragraphAfter(heading ?? target);

  // Permalink anchors such as "#" or "¶" are not part of the heading.
  const label = heading?.clone();
  label
    ?.find('a[href^="#"]')
    .filter((_, a) => Array.from($(a).text().trim()).length <= 1)
    .remove();

  return {
    title: cleanText(
      label?.text().replace(/[¶§]/g, ''),
      LINK_PREVIEW_SECTION_TITLE_MAX_LENGTH,
    ),
    description: cleanText(paragraph?.text(), LINK_PREVIEW_DESCRIPTION_MAX_LENGTH),
  };
}

export function parseLinkPreview(
  html: string,
  pageUrl: string,
  fragment?: string,
): LinkPreviewPage {
  const $ = load(html);
  const base = resolveBase($, pageUrl);

  const pageTitle = firstText(
    [...readMeta($, TITLE_KEYS), $('title').first().text()],
    LINK_PREVIEW_TITLE_MAX_LENGTH,
  );
  const section = fragment ? findSection($, safeDecode(fragment)) : {};
  const title =
    section.title && !pageTitle?.includes(section.title)
      ? cleanText(
          pageTitle ? `${section.title} - ${pageTitle}` : section.title,
          LINK_PREVIEW_TITLE_MAX_LENGTH,
        )
      : pageTitle;

  const ogImageIsTiny = isTiny(
    readMeta($, ['og:image:width'])[0],
    readMeta($, ['og:image:height'])[0],
  );
  const image = firstUrl(
    [
      ...(ogImageIsTiny ? [] : readMeta($, OG_IMAGE_KEYS)),
      ...readMeta($, TWITTER_IMAGE_KEYS),
      $('link[rel="image_src"]').first().attr('href'),
    ],
    base,
  );

  const oembedUrl = firstUrl(
    $('link[type][href]')
      .filter((_, el) =>
        OEMBED_LINK_TYPES.includes(el.attribs.type.trim().toLowerCase()),
      )
      .map((_, el) => el.attribs.href)
      .get(),
    base,
  );

  return {
    title,
    description:
      section.description ??
      firstText(readMeta($, DESCRIPTION_KEYS), LINK_PREVIEW_DESCRIPTION_MAX_LENGTH),
    image,
    icon: pickIcon($, base, pageUrl),
    oembedUrl,
  };
}

// Only plain fields are read: the html field is never used.
export function parseOembed(data: unknown, pageUrl: string): Partial<LinkPreview> {
  if (!data || typeof data !== 'object') return {};
  const fields = data as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === 'string' ? value : undefined);
  const provider = toHttpUrl(text(fields.provider_url), pageUrl) ?? pageUrl;

  return {
    title: cleanText(text(fields.title), LINK_PREVIEW_TITLE_MAX_LENGTH),
    image: isTiny(fields.thumbnail_width, fields.thumbnail_height)
      ? undefined
      : toHttpUrl(text(fields.thumbnail_url), pageUrl),
    icon: `${new URL(provider).origin}/favicon.ico`,
  };
}

export function getOembedEndpoint(url: string): string | undefined {
  const host = new URL(url).hostname.toLowerCase().replace(/\.$/, '');
  const provider = LINK_PREVIEW_OEMBED_PROVIDERS.find(({ hosts }) =>
    hosts.some((h) => host === h || host.endsWith(`.${h}`)),
  );
  if (!provider) return undefined;

  const endpoint = new URL(provider.endpoint);
  endpoint.searchParams.set('url', url);
  return endpoint.href;
}

export function mergeCookies(
  header: string | undefined,
  setCookies: string[],
): string | undefined {
  const jar = new Map<string, string>();
  const pairs = [
    ...(header ? header.split('; ') : []),
    ...setCookies.map((cookie) => cookie.split(';')[0]),
  ];
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    const name = pair.slice(0, eq).trim();
    if (eq > 0 && name) jar.set(name, pair.slice(eq + 1).trim());
  }
  return jar.size
    ? Array.from(jar, ([name, value]) => `${name}=${value}`).join('; ')
    : undefined;
}

export function detectCharset(
  contentType: string | null,
  head: Uint8Array,
): string {
  const fromHeader = /charset\s*=\s*["']?([^\s;"']+)/i.exec(contentType ?? '');
  const fromMeta = fromHeader
    ? null
    : /<meta[^>]+charset\s*=\s*["']?([^\s"'\/>;]+)/i.exec(
        new TextDecoder('latin1').decode(head.subarray(0, CHARSET_SCAN_BYTES)),
      );
  const label = (fromHeader ?? fromMeta)?.[1]?.toLowerCase();
  if (!label) return 'utf-8';
  try {
    new TextDecoder(label);
    return label;
  } catch {
    return 'utf-8';
  }
}

export function decodeHtml(
  bytes: Uint8Array,
  contentType: string | null,
): string {
  return new TextDecoder(detectCharset(contentType, bytes)).decode(bytes);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function cleanTitle(value: string, fallback: string): string {
  return (
    cleanText(value, LINK_PREVIEW_TITLE_MAX_LENGTH) ??
    Array.from(fallback).slice(0, LINK_PREVIEW_TITLE_MAX_LENGTH).join('')
  );
}

export function buildFallbackTitle(url: string): string {
  try {
    const { host, pathname } = new URL(url);
    const cleaned = cleanText(
      `${host}${safeDecode(pathname)}`,
      LINK_PREVIEW_TITLE_MAX_LENGTH,
    )?.replace(/\/+$/, '');
    return cleaned || cleanTitle(url, url);
  } catch {
    return cleanTitle(url, url);
  }
}

export function getFileNameTitle(url: string): string {
  try {
    const last = new URL(url).pathname.split('/').filter(Boolean).pop();
    const title = last
      ? cleanText(safeDecode(last), LINK_PREVIEW_TITLE_MAX_LENGTH)
      : undefined;
    if (title) return title;
  } catch {
    // fall through
  }
  return buildFallbackTitle(url);
}

export function isSignInUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (
    LINK_PREVIEW_SIGN_IN_HOSTS.includes(host) ||
    LINK_PREVIEW_SIGN_IN_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) {
    return true;
  }
  return parsed.pathname
    .split('/')
    .filter(Boolean)
    .some((segment) =>
      LINK_PREVIEW_SIGN_IN_PATH_SEGMENTS.includes(
        safeDecode(segment).toLowerCase().split(/[.;]/)[0],
      ),
    );
}

const HEAD_END = '</head';

export async function readBody(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  untilHeadEnd: boolean,
): Promise<Uint8Array> {
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let previousTail = '';
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, maxBytes - total);
      chunks.push(chunk);
      total += chunk.length;
      if (!untilHeadEnd) continue;
      const text = previousTail + Buffer.from(chunk).toString('latin1');
      if (text.toLowerCase().includes(HEAD_END)) break;
      previousTail = text.slice(-(HEAD_END.length - 1));
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return Buffer.concat(chunks);
}
