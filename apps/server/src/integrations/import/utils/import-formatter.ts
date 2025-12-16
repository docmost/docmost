import { getEmbedUrlAndProvider } from '@docmost/editor-ext';
import * as path from 'path';
import { v7 } from 'uuid';
import { InsertableBacklink } from '@docmost/db/types/entity.types';
import { Cheerio, CheerioAPI, load } from 'cheerio';

// Check if text contains Unicode characters (for emojis/icons)
function isUnicodeCharacter(text: string): boolean {
  return text.length > 0 && text.codePointAt(0)! > 127; // Non-ASCII characters
}

export async function formatImportHtml(opts: {
  html: string;
  currentFilePath: string;
  filePathToPageMetaMap: Map<
    string,
    { id: string; title: string; slugId: string }
  >;
  creatorId: string;
  sourcePageId: string;
  workspaceId: string;
  pageDir?: string;
  attachmentCandidates?: string[];
}): Promise<{
  html: string;
  backlinks: InsertableBacklink[];
  pageIcon?: string;
}> {
  const {
    html,
    currentFilePath,
    filePathToPageMetaMap,
    creatorId,
    sourcePageId,
    workspaceId,
  } = opts;
  const $: CheerioAPI = load(html);
  const $root: Cheerio<any> = $.root();

  let pageIcon: string | null = null;
  // extract notion page icon
  const headerIconSpan = $root.find('header .page-header-icon .icon');

  if (headerIconSpan.length > 0) {
    const iconText = headerIconSpan.text().trim();
    if (iconText && isUnicodeCharacter(iconText)) {
      pageIcon = iconText;
    }
  }

  notionFormatter($, $root);
  defaultHtmlFormatter($, $root);

  const backlinks = await rewriteInternalLinksToMentionHtml(
    $,
    $root,
    currentFilePath,
    filePathToPageMetaMap,
    creatorId,
    sourcePageId,
    workspaceId,
  );

  return {
    html: $root.html() || '',
    backlinks,
    pageIcon: pageIcon || undefined,
  };
}

export function defaultHtmlFormatter($: CheerioAPI, $root: Cheerio<any>) {
  $root.find('a[href]').each((_, el) => {
    const $el = $(el);
    const url = $el.attr('href')!;
    const { provider } = getEmbedUrlAndProvider(url);
    if (provider === 'iframe') return;

    const embed = `<div data-type=\"embed\" data-src=\"${url}\" data-provider=\"${provider}\" data-align=\"center\" data-width=\"640\" data-height=\"480\"></div>`;
    $el.replaceWith(embed);
  });

  $root.find('iframe[src]').each((_, el) => {
    const $el = $(el);
    const url = $el.attr('src')!;
    const { provider } = getEmbedUrlAndProvider(url);

    const embed = `<div data-type=\"embed\" data-src=\"${url}\" data-provider=\"${provider}\" data-align=\"center\" data-width=\"640\" data-height=\"480\"></div>`;
    $el.replaceWith(embed);
  });
}

const TEXT_COLORS = [
  { name: 'Blue', color: '#2563EB' },
  { name: 'Green', color: '#008A00' },
  { name: 'Purple', color: '#9333EA' },
  { name: 'Red', color: '#E00000' },
  { name: 'Yellow', color: '#EAB308' },
  { name: 'Orange', color: '#FFA500' },
  { name: 'Pink', color: '#BA4081' },
  { name: 'Gray', color: '#A8A29E' },
  { name: 'Brown', color: '#92400E' },
];

const HIGHLIGHT_COLORS = [
  { name: 'Blue', color: '#98d8f2' },
  { name: 'Green', color: '#7edb6c' },
  { name: 'Purple', color: '#e0d6ed' },
  { name: 'Red', color: '#ffc6c2' },
  { name: 'Yellow', color: '#faf594' },
  { name: 'Orange', color: '#f5c8a9' },
  { name: 'Pink', color: '#f5cfe0' },
  { name: 'Gray', color: '#dfdfd7' },
  { name: 'Brown', color: '#d7c4b7' },
];

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

interface Rgba extends Rgb {
  a: number;
}

function parseColor(input: string): Rgba | null {
  input = input.trim();

  // Hex
  if (input.startsWith('#')) {
    const hex = input.substring(1);
    // Support 3, 4, 6, 8 digits
    if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex)) return null;

    let r, g, b, a = 255;

    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 4) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
      a = parseInt(hex[3] + hex[3], 16); // 0-255
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else if (hex.length === 8) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
      a = parseInt(hex.substring(6, 8), 16);
    } else {
      return null;
    }
    return { r, g, b, a: a / 255 };
  }

  // RGB/RGBA (Modern & Legacy)
  // Matches: rgba(255, 255, 255, 0.5) OR rgba(255 255 255 / 0.5)
  // Handles percentages: rgb(100%, 0%, 0%)
  const rgbMatch = input.match(
    /^rgba?\(\s*([\d.]+%?)[,\s]+([\d.]+%?)[,\s]+([\d.]+%?)(?:[,\s/]+([\d.]+%?))?\s*\)$/i,
  );

  if (rgbMatch) {
    const clamp = (val: number, max: number) => Math.min(Math.max(val, 0), max);
    const parseValue = (val: string, max: number) => {
      if (val.endsWith('%')) {
        return clamp((parseFloat(val) / 100) * max, max);
      }
      return clamp(parseFloat(val), max);
    };

    return {
      r: Math.round(parseValue(rgbMatch[1], 255)),
      g: Math.round(parseValue(rgbMatch[2], 255)),
      b: Math.round(parseValue(rgbMatch[3], 255)),
      a: rgbMatch[4] !== undefined ? parseValue(rgbMatch[4], 1) : 1,
    };
  }

  // HSL/HSLA (Modern & Legacy)
  const hslMatch = input.match(
    /^hsla?\(\s*([\d.]+(?:deg|rad|grad|turn)?)[,\s]+([\d.]+%?)[,\s]+([\d.]+%?)(?:[,\s/]+([\d.]+%?))?\s*\)$/i,
  );

  if (hslMatch) {
    let h = parseFloat(hslMatch[1]);
    if (hslMatch[1].endsWith('rad')) h = h * (180 / Math.PI);
    else if (hslMatch[1].endsWith('grad')) h = h * 0.9;
    else if (hslMatch[1].endsWith('turn')) h = h * 360;
    // else degrees

    // Normalize h to 0-1
    h = (h % 360) / 360;
    if (h < 0) h += 1;

    const parseHslComponent = (val: string) => {
      if (val.endsWith('%')) return Math.min(Math.max(parseFloat(val) / 100, 0), 1);
      return Math.min(Math.max(parseFloat(val), 0), 1);
    };

    const s = parseHslComponent(hslMatch[2]);
    const l = parseHslComponent(hslMatch[3]);
    let a = 1;
    if (hslMatch[4]) {
      if (hslMatch[4].endsWith('%')) {
        a = Math.min(Math.max(parseFloat(hslMatch[4]) / 100, 0), 1);
      } else {
        a = Math.min(Math.max(parseFloat(hslMatch[4]), 0), 1);
      }
    }

    const rgb = hslToRgb(h, s, l);
    return { ...rgb, a };
  }

  return null;
}

function rgbToHsl(r: number, g: number, b: number): Hsl {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s, l };
}

function getDistanceHsl(c1: Hsl, c2: Hsl): number {
  let hDiff = Math.abs(c1.h - c2.h);
  if (hDiff > 180) hDiff = 360 - hDiff;

  // Normalized Hue distance (0-1)
  const hDist = hDiff / 180;
  const sDist = Math.abs(c1.s - c2.s);
  const lDist = Math.abs(c1.l - c2.l);

  // Weights
  // this is done especially for notions color palette which is more hue focused
  const wH = 4;
  const wS = 0.5; // Lower weight for saturation
  const wL = 0.5; // Lower weight for lightness

  return Math.sqrt(
    wH * Math.pow(hDist, 2) + wS * Math.pow(sDist, 2) + wL * Math.pow(lDist, 2),
  );
}

function blendWithWhite(color: Rgba): Rgb {
  const alpha = Math.max(0, Math.min(1, color.a));
  return {
    r: Math.round(color.r * alpha + 255 * (1 - alpha)),
    g: Math.round(color.g * alpha + 255 * (1 - alpha)),
    b: Math.round(color.b * alpha + 255 * (1 - alpha)),
  };
}

function findClosestColor(
  targetColor: string,
  palette: { name: string; color: string }[],
): string | null {
  const targetRgba = parseColor(targetColor);
  if (!targetRgba) return null;

  // Blend with white to handle transparency (avoid mapping transparent darks to black)
  const targetRgb = blendWithWhite(targetRgba);
  const targetHsl = rgbToHsl(targetRgb.r, targetRgb.g, targetRgb.b);

  let minDistance = Infinity;
  let closestColor: string | null = null;

  for (const item of palette) {
    const itemRgba = parseColor(item.color);
    if (!itemRgba) continue;

    const itemHsl = rgbToHsl(itemRgba.r, itemRgba.g, itemRgba.b);

    let distance = getDistanceHsl(targetHsl, itemHsl);

    // Penalty for mapping colored source to grayscale target
    if (targetHsl.s > 0.15 && itemHsl.s < 0.1) {
      distance += 1.0;
    }

    if (distance < minDistance) {
      minDistance = distance;
      closestColor = item.color;
    }
  }

  return closestColor;
}

function parseNotionStyles(
  $: CheerioAPI,
): Map<string, { type: 'text' | 'highlight'; color: string }> {
  const styleMap = new Map<
    string,
    { type: 'text' | 'highlight'; color: string }
  >();
  const styleContent = $('style').text();

  // Regex to extract classes and their colors
  // Capture ANY content between colon and closing brace/semicolon to support various formats (hex8, hsl, var, etc)
  const colorRegex =
    /\.([a-zA-Z0-9_-]+)\s*\{[^}]*?(?:color|fill):\s*([^;}]+)[^}]*?\}/g;
  const bgRegex =
    /\.([a-zA-Z0-9_-]+)\s*\{[^}]*?background(?:-color)?:\s*([^;}]+)[^}]*?\}/g;

  let match = null;
  while ((match = colorRegex.exec(styleContent)) !== null) {
    const className = match[1];
    const colorValue = match[2].replace(/!important/i, '').trim();
    const closest = findClosestColor(colorValue, TEXT_COLORS) || colorValue;
    if (closest) {
      styleMap.set(className, { type: 'text', color: closest });
    }
  }

  while ((match = bgRegex.exec(styleContent)) !== null) {
    const className = match[1];
    const colorValue = match[2].replace(/!important/i, '').trim();
    const closest =
      findClosestColor(colorValue, HIGHLIGHT_COLORS) || colorValue;
    if (closest) {
      styleMap.set(className, { type: 'highlight', color: closest });
    }
  }

  return styleMap;
}

const escapeSelector = (name: string) =>
  name.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');

export function notionFormatter($: CheerioAPI, $root: Cheerio<any>) {
  // Parse styles first
  const styleMap = parseNotionStyles($);

  // Apply colors
  styleMap.forEach((style, className) => {
    // Select elements with this class (including block-level ones)
    const selector = `.${escapeSelector(className)}`;
    const $elements = $root.find(selector);

    $elements.each((_, el) => {
      const $el = $(el);
      const tagName = el.tagName.toLowerCase();

      // Helper to create wrapper
      const createWrapper = () =>
        style.type === 'text'
          ? $('<span>').css('color', style.color)
          : $('<mark>').css('background-color', style.color);

      // LISTS (ul, ol)
      if (tagName === 'ul' || tagName === 'ol') {
        $el.children('li').each((_, li) => {
          const $li = $(li);
          const $details = $li.children('details');

          if ($details.length > 0) {
            // Toggle Block (details)
            // Apply to summary and content div
            const $summary = $details.children('summary');
            const $content = $details.children('div');

            if ($summary.length)
              $summary.contents().wrapAll(createWrapper());
            if ($content.length) {
              $content.contents().each((_, child) => {
                const $child = $(child);
                // If text node or inline element, wrap it
                if (
                  child.nodeType === 3 || // Text
                  ['span', 'strong', 'em', 'u', 's', 'a', 'code', 'mark'].includes(
                    (child as any).tagName?.toLowerCase() || '',
                  )
                ) {
                  if (child.nodeType === 3 && !$child.text().trim()) return;
                  $child.wrap(createWrapper());
                } else {
                  // Block elements inside toggle
                  const tag = (child as any).tagName?.toLowerCase();
                  if (tag === 'ul' || tag === 'ol') {
                    $child.children('li').each((__, nestedLi) => {
                      const $nestedLi = $(nestedLi);
                      // Handle nested details in list
                      if ($nestedLi.children('details').length) {
                        // Recurse or let standard generic handler do it?
                        // The standard handler runs on class selector. Here we are forcing color down.
                        // We must manually apply it.
                        $nestedLi.children('details').children('summary').contents().wrapAll(createWrapper());
                        // Support one level deep of content coloring for now or use recursion
                        // (For safety, we just allow the summary to be colored, deeper blocks might lose color but better than breaking)
                      } else {
                        $nestedLi
                          .contents()
                          .filter((___, node: any) => !['ul', 'ol', 'details'].includes(node.tagName?.toLowerCase()))
                          .wrapAll(createWrapper());
                      }
                    });
                  } else if (
                    ['p', 'h1', 'h2', 'h3', 'div', 'nav', 'blockquote'].includes(tag || '')
                  ) {
                    $child.contents().wrapAll(createWrapper());
                  }
                }
              });
            }
          } else {
            // Normal List Item
            // Wrap contents, excluding nested lists
            const $contents = $li.contents().filter((_, node) => {
              const nodeTag = (node as any).tagName?.toLowerCase();
              return nodeTag !== 'ul' && nodeTag !== 'ol';
            });

            if ($contents.length > 0) {
              $contents.wrapAll(createWrapper());
            }
          }
        });
        $el.removeClass(className);
        return;
      }

      // BLOCK-LEVEL ELEMENTS (h1, p, div, etc - except lists)
      if (
        ['h1', 'h2', 'h3', 'p', 'div', 'nav', 'blockquote'].includes(tagName)
      ) {
        $el.contents().wrapAll(createWrapper());
        $el.removeClass(className);
        return;
      }

      // INLINE ELEMENTS (span, mark) (and others not caught above)
      if (style.type === 'text') {
        if (tagName === 'mark') {
          // Change mark to span for text color
          const $span = $('<span>')
            .css('color', style.color)
            .html($el.html());
          $el.replaceWith($span);
        } else {
          $el.css('color', style.color);
          $el.removeClass(className);
        }
      } else {
        // Highlight
        if (tagName === 'span') {
          // Change span to mark for background color
          const $mark = $('<mark>')
            .css('background-color', style.color)
            .html($el.html());
          $el.replaceWith($mark);
        } else {
          $el.css('background-color', style.color);
          $el.removeClass(className);
        }
      }
    });
  });

  // remove page header icon and cover image
  $root.find('.page-header-icon').remove();
  $root.find('.page-cover-image').remove();

  // remove empty description paragraphs
  $root.find('p.page-description').each((_, el) => {
    if (!$(el).text().trim()) $(el).remove();
  });

  // block math → mathBlock
  $root.find('figure.equation').each((_: any, fig: any) => {
    const $fig = $(fig);
    const tex = $fig
      .find('annotation[encoding="application/x-tex"]')
      .text()
      .trim();
    const $math = $('<div>')
      .attr('data-type', 'mathBlock')
      .attr('data-katex', 'true')
      .text(tex);
    $fig.replaceWith($math);
  });

  // inline math → mathInline
  $root.find('span.notion-text-equation-token').each((_, tok) => {
    const $tok = $(tok);
    const $prev = $tok.prev('style');
    if ($prev.length) $prev.remove();
    const tex = $tok
      .find('annotation[encoding="application/x-tex"]')
      .text()
      .trim();
    const $inline = $('<span>')
      .attr('data-type', 'mathInline')
      .attr('data-katex', 'true')
      .text(tex);
    $tok.replaceWith($inline);
  });

  // callouts
  $root
    .find('figure.callout')
    .get()
    .reverse()
    .forEach((fig) => {
      const $fig = $(fig);
      const $divs = $fig.children('div');
      let $content: Cheerio<any>;
      let icon: string | undefined;

      // if there is only one div, it's the content
      // if there are 2 divs, the first is the icon and the second is the content
      if ($divs.length === 1) {
        $content = $divs.eq(0);
      } else {
        const $iconDiv = $divs.eq(0);
        if ($iconDiv.text().trim()) {
          icon = $iconDiv.text().trim();
        }
        $content = $divs.eq(1);
      }

      if (!$content.length) return;
      const $wrapper = $('<div>')
        .attr('data-type', 'callout')
        .attr('data-callout-type', 'info');

      if (icon) {
        $wrapper.attr('data-callout-icon', icon);
      }


      $content.contents().each((_, child) => {
        const $child = $(child);
        // Unwrap divs (often used for display:contents wrappers in Notion exports)
        // Check if it is a tag and is a div
        if (
          (child as any).type === 'tag' &&
          (child as any).tagName?.toLowerCase() === 'div'
        ) {
          // @ts-ignore
          $child.contents().each((__, subChild) => $wrapper.append(subChild));
        } else {
          $wrapper.append(child);
        }
      });
      $fig.replaceWith($wrapper);
    });

  // to-do lists
  $root.find('ul.to-do-list').each((_, list) => {
    const $old = $(list);
    const $new = $('<ul>').attr('data-type', 'taskList');
    $old.find('li').each((_, li) => {
      const $li = $(li);
      const isChecked = $li.find('.checkbox.checkbox-on').length > 0;
      const text =
        $li
          .find('span.to-do-children-unchecked, span.to-do-children-checked')
          .first()
          .text()
          .trim() || '';
      const $taskItem = $('<li>')
        .attr('data-type', 'taskItem')
        .attr('data-checked', String(isChecked));
      const $label = $('<label>');
      const $input = $('<input>').attr('type', 'checkbox');
      if (isChecked) $input.attr('checked', '');
      $label.append($input, $('<span>'));
      const $container = $('<div>').append($('<p>').text(text));
      $taskItem.append($label, $container);
      $new.append($taskItem);
    });
    $old.replaceWith($new);
  });

  // toggle blocks
  $root
    .find('details')
    .get()
    .reverse()
    .forEach((det) => {
      const $det = $(det);

      const hasDetailsContent =
        $det.children('div[data-type="detailsContent"]').length > 0;
      if (!hasDetailsContent) {
        let $summary: Cheerio<any> = $det.children('summary').first();

        if (!$summary.length) {
          $summary = $('<summary>').text('Toggle');
          $det.prepend($summary);
        } else {
          $det.prepend($summary);
        }

        const $contentWrapper = $('<div>').attr('data-type', 'detailsContent');
        $det
          .children()
          .filter((_, child) => child.tagName?.toLowerCase() !== 'summary')
          .each((_, child) => {
            $contentWrapper.append($(child));
          });

        if ($contentWrapper.children().length === 0) {
          $contentWrapper.append($('<p>'));
        }

        $det.append($contentWrapper);
      }

      const $li = $det.closest('li');
      if ($li.length) {
        $li.before($det);
        if (!$li.children().length) $li.remove();
      }
      const $ul = $det.closest('ul.toggle');
      if ($ul.length) {
        $ul.before($det);
        if (!$ul.children().length) $ul.remove();
      }
    });


  // bookmarks
  $root
    .find('figure')
    .filter((_, fig) => $(fig).find('a.bookmark.source').length > 0)
    .get()
    .reverse()
    .forEach((fig) => {
      const $fig = $(fig);
      const $link = $fig.find('a.bookmark.source').first();
      if (!$link.length) return;

      const href = $link.attr('href')!;
      const title = $link.find('.bookmark-title').text().trim() || href;

      const $newAnchor = $('<a>')
        .addClass('bookmark source')
        .attr('href', href)
        .append($('<div>').addClass('bookmark-info').text(title));

      $fig.replaceWith($newAnchor);
    });

  // remove user icons
  $root.find('span.user img.user-icon').remove();

  // remove toc
  $root.find('nav.table_of_contents').remove();
}

export function unwrapFromParagraph($: CheerioAPI, $node: Cheerio<any>) {
  // Keep track of processed wrappers to avoid infinite loops
  const processedWrappers = new Set<any>();

  let $wrapper = $node.closest('p, a');
  while ($wrapper.length) {
    const wrapperElement = $wrapper.get(0);

    // If we've already processed this wrapper, break to avoid infinite loop
    if (processedWrappers.has(wrapperElement)) {
      break;
    }

    processedWrappers.add(wrapperElement);

    // Check if the wrapper contains only whitespace and our target node
    const hasOnlyTargetNode =
      $wrapper.contents().filter((_, el) => {
        const $el = $(el);
        // Skip whitespace-only text nodes. NodeType 3 = text node
        if (el.nodeType === 3 && !$el.text().trim()) {
          return false;
        }
        // Return true if this is not our target node
        return !$el.is($node) && !$node.is($el);
      }).length === 0;

    if (hasOnlyTargetNode) {
      // Replace the wrapper entirely with our node
      $wrapper.replaceWith($node);
    } else {
      // Move the node to before the wrapper, preserving other content
      $wrapper.before($node);
    }

    // look again for any new wrapper around $node
    $wrapper = $node.closest('p, a');
  }
}

export async function rewriteInternalLinksToMentionHtml(
  $: CheerioAPI,
  $root: Cheerio<any>,
  currentFilePath: string,
  filePathToPageMetaMap: Map<
    string,
    { id: string; title: string; slugId: string }
  >,
  creatorId: string,
  sourcePageId: string,
  workspaceId: string,
): Promise<InsertableBacklink[]> {
  const normalize = (p: string) => p.replace(/\\/g, '/');
  const backlinks: InsertableBacklink[] = [];

  $root.find('a[href]').each((_, el) => {
    const $a = $(el);
    const raw = $a.attr('href')!;
    if (raw.startsWith('http') || raw.startsWith('/api/')) return;
    const resolved = normalize(
      path.join(path.dirname(currentFilePath), decodeURIComponent(raw)),
    );
    const meta = filePathToPageMetaMap.get(resolved);
    if (!meta) return;
    const mentionId = v7();
    const $mention = $('<span>')
      .attr({
        'data-type': 'mention',
        'data-id': mentionId,
        'data-entity-type': 'page',
        'data-entity-id': meta.id,
        'data-label': meta.title,
        'data-slug-id': meta.slugId,
        'data-creator-id': creatorId,
      })
      .text(meta.title);
    $a.replaceWith($mention);
    backlinks.push({ sourcePageId, targetPageId: meta.id, workspaceId });
  });

  return backlinks;
}
