import { getEmbedUrlAndProvider } from '@docmost/editor-ext';
import { Logger } from '@nestjs/common';
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

export function notionFormatter($: CheerioAPI, $root: Cheerio<any>) {
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
      const $content = $fig.find('div').eq(1);
      if (!$content.length) return;
      const $wrapper = $('<div>')
        .attr('data-type', 'callout')
        .attr('data-callout-type', 'info');
      // @ts-ignore
      $content.children().each((_, child) => $wrapper.append(child));
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
    .find('ul.toggle details')
    .get()
    .reverse()
    .forEach((det) => {
      const $det = $(det);
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
    let decodedRaw = raw;
    try {
      decodedRaw = decodeURIComponent(raw);
    } catch (err) {
      Logger.warn(
        `URI malformed in page ${currentFilePath}: ${raw}. Falling back to raw path.`,
        'ImportFormatter',
      );
    }

    const resolved = normalize(
      path.join(path.dirname(currentFilePath), decodedRaw),
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
