import { Cheerio, CheerioAPI } from 'cheerio';

// Maximum indent level supported by the Indent editor extension (see
// packages/editor-ext/src/lib/indent.ts). Values above this clamp down.
const MAX_INDENT_LEVEL = 8;
const MARGIN_LEFT_RE = /margin-left\s*:\s*(-?\d*\.?\d+)\s*px/i;
const MARGIN_LEFT_STRIP_RE = /margin-left\s*:\s*-?\d*\.?\d+\s*px\s*;?/i;

/**
 * Confluence encodes paragraph indent as inline `style="margin-left: Npx"`.
 * The per-level pixel value differs by edition: Cloud uses 30 (max 6 levels),
 * Data Center uses 40 (no upper limit). The HTML-export ZIP path has no
 * edition information available, so we auto-detect the per-level unit from
 * the GCD of all margin-left values in the document. The API converter can
 * pass `pxPerLevel` explicitly when the edition is known.
 *
 * Levels are written to `data-indent` for the TipTap Indent extension to
 * pick up; the margin-left style is stripped from the element so the
 * normalized indent doesn't double up with the editor's own indent padding.
 */
export function applyConfluenceMarginLeftIndent(
  $: CheerioAPI,
  $root: Cheerio<any>,
  options?: { pxPerLevel?: number },
): void {
  const $els = $root.find('p, h1, h2, h3, h4, h5, h6');

  const values: number[] = [];
  $els.each((_, el) => {
    const style = $(el).attr('style');
    if (!style) return;
    const match = MARGIN_LEFT_RE.exec(style);
    if (!match) return;
    const px = parseFloat(match[1]);
    if (Number.isFinite(px) && px > 0) values.push(px);
  });
  if (values.length === 0) return;

  const unit = options?.pxPerLevel ?? detectIndentUnit(values);
  if (!unit || unit <= 0) return;

  $els.each((_, el) => {
    const $el = $(el);
    const style = $el.attr('style');
    if (!style) return;
    const match = MARGIN_LEFT_RE.exec(style);
    if (!match) return;
    const px = parseFloat(match[1]);
    if (!Number.isFinite(px) || px <= 0) return;
    const level = Math.min(
      MAX_INDENT_LEVEL,
      Math.max(1, Math.round(px / unit)),
    );
    $el.attr('data-indent', String(level));
    const remaining = style.replace(MARGIN_LEFT_STRIP_RE, '').trim();
    if (remaining) {
      $el.attr('style', remaining);
    } else {
      $el.removeAttr('style');
    }
  });
}

function detectIndentUnit(values: number[]): number {
  // Confluence emits floats like "30.0"; round to ints for a clean GCD.
  const ints = values.map((v) => Math.round(v)).filter((v) => v > 0);
  if (ints.length === 0) return 0;
  return ints.reduce((a, b) => gcd(a, b));
}

function gcd(a: number, b: number): number {
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}
