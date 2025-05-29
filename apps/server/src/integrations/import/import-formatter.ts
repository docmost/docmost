import {
  Window,
  HTMLAnchorElement,
  HTMLIFrameElement,
  Element as HDElement,
} from 'happy-dom';
import { getEmbedUrlAndProvider } from '@docmost/editor-ext';
import * as path from 'path';
import { v7 } from 'uuid';
import { InsertableBacklink } from '@docmost/db/types/entity.types';

export function formatImportHtml(html: string) {
  const pmHtml = notionFormatter(html);
  return defaultHtmlFormatter(pmHtml);
}

export function defaultHtmlFormatter(html: string): string {
  const window = new Window();
  const doc = window.document;
  doc.body.innerHTML = html;

  // embed providers
  const anchors = Array.from(doc.getElementsByTagName('a'));
  for (const node of anchors) {
    const url = (node as HTMLAnchorElement).href;
    if (!url) continue;

    const embedProvider = getEmbedUrlAndProvider(url);
    // we only want to embed valid matches
    if (embedProvider.provider === 'iframe') continue;

    const embed = doc.createElement('div');
    embed.setAttribute('data-type', 'embed');
    embed.setAttribute('data-src', url);
    embed.setAttribute('data-provider', embedProvider.provider);
    embed.setAttribute('data-align', 'center');
    embed.setAttribute('data-width', '640');
    embed.setAttribute('data-height', '480');

    node.replaceWith(embed);
  }

  // embed providers
  const iframes = Array.from(doc.getElementsByTagName('iframe'));
  for (const iframe of iframes) {
    const url = (iframe as HTMLIFrameElement).src;
    if (!url) continue;

    const embedProvider = getEmbedUrlAndProvider(url);
    const embed = doc.createElement('div');
    embed.setAttribute('data-type', 'embed');
    embed.setAttribute('data-src', url);
    embed.setAttribute('data-provider', embedProvider.provider);
    embed.setAttribute('data-align', 'center');
    embed.setAttribute('data-width', '640');
    embed.setAttribute('data-height', '480');

    iframe.replaceWith(embed);
  }

  return doc.body.innerHTML;
}

export function notionFormatter(html: string): string {
  const window = new Window();
  const doc = window.document;
  doc.body.innerHTML = html;

  // remove empty description paragraph
  doc.querySelectorAll('p.page-description').forEach((p) => {
    if (p.textContent?.trim() === '') {
      p.remove();
    }
  });

  // Block math
  for (const fig of Array.from(doc.querySelectorAll('figure.equation'))) {
    // get TeX source from the MathML <annotation>
    const annotation = fig.querySelector(
      'annotation[encoding="application/x-tex"]',
    );
    const tex = annotation?.textContent?.trim() ?? '';

    const mathBlock = doc.createElement('div');
    mathBlock.setAttribute('data-type', 'mathBlock');
    mathBlock.setAttribute('data-katex', 'true');
    mathBlock.textContent = tex;

    fig.replaceWith(mathBlock);
  }

  // Inline math
  for (const token of Array.from(
    doc.querySelectorAll('span.notion-text-equation-token'),
  )) {
    // remove the preceding <style> if it’s that KaTeX import
    const prev = token.previousElementSibling;
    if (prev?.tagName === 'STYLE') prev.remove();

    const annotation = token.querySelector(
      'annotation[encoding="application/x-tex"]',
    );
    const tex = annotation?.textContent?.trim() ?? '';

    const mathInline = doc.createElement('span');
    mathInline.setAttribute('data-type', 'mathInline');
    mathInline.setAttribute('data-katex', 'true');
    mathInline.textContent = tex;
    token.replaceWith(mathInline);
  }

  // Callouts
  const figs = Array.from(doc.querySelectorAll('figure.callout')).reverse();

  for (const fig of figs) {
    // find the content <div> (always the 2nd child in a Notion callout)
    const contentDiv = fig.querySelector(
      'div:nth-of-type(2)',
    ) as unknown as HTMLElement | null;
    if (!contentDiv) continue;

    // pull out every block inside (tables, p, nested callouts, lists…)
    const blocks = Array.from(contentDiv.childNodes);

    const wrapper = fig.ownerDocument.createElement('div');
    wrapper.setAttribute('data-type', 'callout');
    wrapper.setAttribute('data-callout-type', 'info');

    // move each real node into the wrapper (preserves nested structure)
    // @ts-ignore
    wrapper.append(...blocks);
    fig.replaceWith(wrapper);
  }

  // Todolist
  const todoLists = Array.from(doc.querySelectorAll('ul.to-do-list'));

  for (const oldList of todoLists) {
    const newList = doc.createElement('ul');
    newList.setAttribute('data-type', 'taskList');

    // for each old <li>, create a <li data-type="taskItem" data-checked="…">
    for (const li of oldList.querySelectorAll('li')) {
      const isChecked = li.querySelector('.checkbox.checkbox-on') != null;
      const textSpan = li.querySelector(
        'span.to-do-children-unchecked, span.to-do-children-checked',
      );
      const text = textSpan?.textContent?.trim() ?? '';

      // <li data-type="taskItem" data-checked="true|false">
      const taskItem = doc.createElement('li');
      taskItem.setAttribute('data-type', 'taskItem');
      taskItem.setAttribute('data-checked', String(isChecked));

      //  <label><input type="checkbox" [checked]><span></span></label>
      const label = doc.createElement('label');
      const input = doc.createElement('input');
      input.type = 'checkbox';
      if (isChecked) input.checked = true;
      const spacer = doc.createElement('span');
      label.append(input, spacer);

      const container = doc.createElement('div');
      const p = doc.createElement('p');
      p.textContent = text;
      container.appendChild(p);

      taskItem.append(label, container);
      newList.appendChild(taskItem);
    }

    oldList.replaceWith(newList);
  }

  // Fix toggle blocks
  const detailsList = Array.from(
    doc.querySelectorAll('ul.toggle details'),
  ).reverse();

  // unwrap from ul and li tags
  for (const details of detailsList) {
    const li = details.closest('li');
    if (li) {
      li.parentNode!.insertBefore(details, li);
      if (li.childNodes.length === 0) li.remove();
    }

    const ul = details.closest('ul.toggle');
    if (ul) {
      ul.parentNode!.insertBefore(details, ul);
      if (ul.childNodes.length === 0) ul.remove();
    }
  }
  return doc.body.innerHTML;
}

export function unwrapFromParagraph(node: HDElement) {
  let wrapper = node.closest('p, a') as HDElement | null;

  while (wrapper) {
    if (wrapper.childNodes.length === 1) {
      // e.g. <p><node/></p> or <a><node/></a> → <node/>
      wrapper.replaceWith(node);
    } else {
      wrapper.parentNode!.insertBefore(node, wrapper);
    }
    wrapper = node.closest('p, a') as HDElement | null;
  }
}

export async function rewriteInternalLinksToMentionHtml(
  html: string,
  currentFilePath: string,
  filePathToPageMetaMap: Map<
    string,
    { id: string; title: string; slugId: string }
  >,
  creatorId: string,
  sourcePageId: string,
  workspaceId: string,
): Promise<{ html: string; backlinks: InsertableBacklink[] }> {
  const window = new Window();
  const doc = window.document;
  doc.body.innerHTML = html;

  // normalize helper
  const normalize = (p: string) => p.replace(/\\/g, '/');

  const backlinks: InsertableBacklink[] = [];

  for (const a of Array.from(doc.getElementsByTagName('a'))) {
    const rawHref = a.getAttribute('href');
    if (!rawHref) continue;

    // skip absolute/external URLs
    if (rawHref.startsWith('http') || rawHref.startsWith('/api/')) {
      continue;
    }

    const decodedRef = decodeURIComponent(rawHref);
    const parentDir = path.dirname(currentFilePath);
    const joined = path.join(parentDir, decodedRef);
    const resolved = normalize(joined);

    const pageMeta = filePathToPageMetaMap.get(resolved);
    if (!pageMeta) {
      continue;
    }

    const mentionEl = doc.createElement('span') as HDElement;
    mentionEl.setAttribute('data-type', 'mention');
    mentionEl.setAttribute('data-id', v7());
    mentionEl.setAttribute('data-entity-type', 'page');
    mentionEl.setAttribute('data-entity-id', pageMeta.id);
    mentionEl.setAttribute('data-label', pageMeta.title);
    mentionEl.setAttribute('data-slug-id', pageMeta.slugId);
    mentionEl.setAttribute('data-creator-id', creatorId);
    mentionEl.textContent = pageMeta.title;

    a.replaceWith(mentionEl);

    backlinks.push({
      sourcePageId,
      targetPageId: pageMeta.id,
      workspaceId: workspaceId,
    });
  }

  return { html: doc.body.innerHTML, backlinks };
}
