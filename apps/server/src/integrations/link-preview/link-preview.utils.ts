import { CheerioAPI, load } from 'cheerio';
import { LinkPreview } from './link-preview.types';
import {
  LINK_PREVIEW_DESCRIPTION_MAX_LENGTH,
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
const IMAGE_KEYS = [
  'og:image:secure_url',
  'og:image',
  'og:image:url',
  'twitter:image',
  'twitter:image:src',
];

function cleanText(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined;
  const cleaned = value
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

export function parseLinkPreview(html: string, pageUrl: string): LinkPreview {
  const $ = load(html);
  const base = resolveBase($, pageUrl);

  const title =
    firstText(
      [...readMeta($, TITLE_KEYS), $('title').first().text()],
      LINK_PREVIEW_TITLE_MAX_LENGTH,
    ) ?? buildFallbackTitle(pageUrl);

  const image = firstUrl(
    [...readMeta($, IMAGE_KEYS), $('link[rel="image_src"]').first().attr('href')],
    base,
  );

  return {
    title,
    description: firstText(
      readMeta($, DESCRIPTION_KEYS),
      LINK_PREVIEW_DESCRIPTION_MAX_LENGTH,
    ),
    image,
    icon: pickIcon($, base, pageUrl),
  };
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

export async function readUntilHeadEnd(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
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
      const text = previousTail + Buffer.from(chunk).toString('latin1');
      if (text.toLowerCase().includes(HEAD_END)) break;
      previousTail = text.slice(-(HEAD_END.length - 1));
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return Buffer.concat(chunks);
}
