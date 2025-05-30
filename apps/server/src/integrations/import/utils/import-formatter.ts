import { getEmbedUrlAndProvider } from '@docmost/editor-ext';
import * as path from 'path';
import { v7 } from 'uuid';
import { InsertableBacklink } from '@docmost/db/types/entity.types';
import { Cheerio, CheerioAPI, load } from 'cheerio';

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
}): Promise<{ html: string; backlinks: InsertableBacklink[] }> {
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

  // remove toc
  $root.find('nav.table_of_contents').remove();
}

export function unwrapFromParagraph($: CheerioAPI, $node: Cheerio<any>) {
  // find the nearest <p> or <a> ancestor
  let $wrapper = $node.closest('p, a');

  while ($wrapper.length) {
    // if the wrapper has only our node inside, replace it entirely
    if ($wrapper.contents().length === 1) {
      $wrapper.replaceWith($node);
    } else {
      // otherwise just move the node to before the wrapper
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
