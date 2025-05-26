import { Window } from 'happy-dom';
import { cleanUrlString } from './file.utils';
import { getEmbedUrlAndProvider } from '@docmost/editor-ext';

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
  for (const a of anchors) {
    const href = cleanUrlString(a.getAttribute('href')) ?? '';
    if (!href) continue;

    const embedProvider = getEmbedUrlAndProvider(href);

    if (embedProvider) {
      const embed = doc.createElement('div');
      embed.setAttribute('data-type', 'embed');
      embed.setAttribute('data-src', href);
      embed.setAttribute('data-provider', embedProvider.provider);
      embed.setAttribute('data-align', 'center');
      embed.setAttribute('data-width', '640');
      embed.setAttribute('data-height', '480');

      a.replaceWith(embed);
    }
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
