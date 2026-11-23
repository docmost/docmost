import { find } from 'linkifyjs';

const UNSPACED_SCRIPT_CLASS =
  '[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Thai}\\p{Script=Lao}\\p{Script=Khmer}\\p{Script=Myanmar}\\u3000-\\u303F\\uFF00-\\uFFEF]';
const SPACED_SEGMENT = new RegExp(
  `(?:(?!${UNSPACED_SCRIPT_CLASS})[\\s\\S])+`,
  'gu',
);
const LINK_SYNTAX = /[.:/@]/;
const INVISIBLE_CHARACTERS = /[\u00AD\u200B\u2060\uFEFF\u202A-\u202E\u2066-\u2069]/g;
const FALLBACK_LINK =
  /\b[a-z][a-z0-9+.-]*:\/\/\S*|\bwww\.\S+|\b(?:[a-z0-9-]+\.)+xn--[a-z0-9-]+\b\S*|\b(?:\d{1,3}\.){3}\d{1,3}\b\S*/gi;

type Range = { start: number; end: number };

export function collapseBlankLines(text: string): string {
  return text.replace(/\n{2,}/g, '\n\n');
}

// scripts written without spaces make linkify swallow the sentence around a link
function selectLinkSegments(text: string, { start, end }: Range): Range[] {
  const segments = [...text.slice(start, end).matchAll(SPACED_SEGMENT)].map(
    (match) => ({
      start: start + match.index,
      end: start + match.index + match[0].length,
      value: match[0],
    }),
  );
  const links = segments.filter(
    ({ value }) => LINK_SYNTAX.test(value) || find(value).length > 0,
  );
  return links.length ? links : segments.slice(0, 1);
}

export function stripLinks(text: string): string {
  // invisible characters can hide a link from detection
  let current = text.replace(INVISIBLE_CHARACTERS, '');

  for (;;) {
    const found: Range[] = find(current).map(({ start, end }) => ({
      start,
      end,
    }));
    const candidates = found.length
      ? found
      : [...current.matchAll(FALLBACK_LINK)].map((match) => ({
          start: match.index,
          end: match.index + match[0].length,
        }));
    const ranges = candidates.flatMap((range) =>
      selectLinkSegments(current, range),
    );

    if (ranges.length === 0) return current;

    let next = current;
    for (const { start, end } of ranges.reverse()) {
      next = next.slice(0, start) + next.slice(end);
    }

    current = next;
  }
}
