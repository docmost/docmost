import { formatDateLabel } from '@docmost/editor-ext';
import { load, type Cheerio, type CheerioAPI } from 'cheerio';

const dateSelector =
  'time[datetime], span[data-node-type="date"][data-timestamp]';
const selfClosingTimeOrSpan =
  /<(?:time|span)\b(?:[^<>"']|"[^"]*"|'[^']*')*\/>/i;

export function loadImportHtml(html: string): CheerioAPI {
  if (!html.includes('/>') || !selfClosingTimeOrSpan.test(html)) {
    return load(html);
  }

  const $ = load(html, { sourceCodeLocationInfo: true });
  $(dateSelector).each((_, el) => {
    const end = el.sourceCodeLocation?.startTag?.endOffset;
    // HTML treats a self-closing XHTML date as an open tag and nests the following text inside it.
    if (end && html.endsWith('/>', end)) $(el).after($(el).contents());
  });
  return $;
}

export function normalizeImportDates($: CheerioAPI, root: Cheerio<any>): void {
  root.find(dateSelector).each((_, el) => {
    const date = $(el);
    const datetime = date.attr('datetime') ?? '';
    let day = datetime;
    if (el.tagName === 'span') {
      const timestamp = date.attr('data-timestamp')!;
      day = /^-?\d+$/.test(timestamp)
        ? (new Date(Number(timestamp)).toJSON()?.split('T')[0] ?? '')
        : '';
    }

    const label = formatDateLabel(day);
    if (!date.text().trim()) date.text(label || datetime);
    if (!label || date.closest('pre, code').length) {
      date.replaceWith(date.contents());
      return;
    }

    el.tagName = 'time';
    date.attr({ 'data-type': 'date', datetime: day });
  });
}
