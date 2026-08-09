import { marked, type Token } from 'marked';

interface MarkdownTab {
  label: string;
  text: string;
  forceActive: boolean;
}

interface TabbedToken {
  type: 'tabbed';
  raw: string;
  tabs: MarkdownTab[];
  activeTabIndex: number;
}

const HEADER_RE = /^===([!+])?\s*["'“”‘’]([^"'“”‘’\n]+)["'“”‘’]\s*$/gm;

export const tabsExtension = {
  name: 'tabbed',
  level: 'block',
  start(src: string) {
    return src.search(/^===(?:[!+])?\s*["'“”‘’]/m);
  },
  tokenizer(src: string): TabbedToken | undefined {
    if (src.indexOf('===') === -1) return;

    const headers: Array<{
      index: number;
      raw: string;
      marker: string;
      label: string;
    }> = [];

    HEADER_RE.lastIndex = 0;

    for (let m = HEADER_RE.exec(src); m !== null; m = HEADER_RE.exec(src)) {
      headers.push({
        index: m.index,
        raw: m[0],
        marker: m[1] ?? '',
        label: m[2].trim(),
      });
    }

    if (headers.length < 1 || headers[0].index !== 0) return;

    const tabs: MarkdownTab[] = [];
    let consumed = 0;
    let breakOutOfTabSet = false;

    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];

      if (i > 0 && h.marker === '!') break;

      const headerEnd = h.index + h.raw.length;
      const bodyStart =
        src.charCodeAt(headerEnd) === 10 ? headerEnd + 1 : headerEnd;

      const next = headers[i + 1];
      const bodyLimit = next ? next.index : src.length;
      let bodyEnd = bodyLimit;
      let lineStart = bodyStart;
      
      while (lineStart < bodyLimit) {
        const newlineIndex = src.indexOf('\n', lineStart);
        const lineEnd =
          newlineIndex === -1 || newlineIndex > bodyLimit
            ? bodyLimit
            : newlineIndex;

        const line = src.slice(lineStart, lineEnd);
        const isBlank = line.trim() === '';
        const isIndented = /^( {2,4}|\t)/.test(line);

        if (!isBlank && !isIndented) {
          bodyEnd = lineStart;
          breakOutOfTabSet = true;
          break;
        }

        lineStart = lineEnd < bodyLimit ? lineEnd + 1 : bodyLimit;
      }

      let body = src.slice(bodyStart, bodyEnd).replace(/\n+$/, '');

      if (body.length > 0) {
        body = body
          .split('\n')
          .map((line) => line.replace(/^\s{2,4}/, ''))
          .join('\n');
      }

      tabs.push({
        label: h.label,
        text: body,
        forceActive: h.marker === '+',
      });

      consumed = bodyEnd;

      if (breakOutOfTabSet) break;
    }

    if (tabs.length < 1) return;

    const forcedActiveIndex = tabs.findIndex((t) => t.forceActive);

    return {
      type: 'tabbed',
      raw: src.slice(0, consumed),
      tabs,
      activeTabIndex: Math.max(forcedActiveIndex, 0),
    };
  },
  renderer(token: Token) {
    const tabbedToken = token as TabbedToken;

    const activeTabIndex = Math.max(
      0,
      Math.min(tabbedToken.activeTabIndex ?? 0, tabbedToken.tabs.length - 1),
    );

    const sections = tabbedToken.tabs.map((tab, index) => {
      const label = escapeHtml(tab.label);
      const panel = marked.parse(tab.text || '').toString();
      const isActive = index === activeTabIndex;

      const activeAttrs = isActive
        ? 'data-tab-active="true"'
        : 'data-tab-active="false"';

      return `<div data-type="tab" aria-hidden="true" ${activeAttrs}><div data-type="tabLabel">${label}</div><div data-type="tabPanel" >${panel}</div></div>`;
    });

    return `<div data-type="tabs" data-active-tab="${activeTabIndex}">${sections.join('')}</div>`;
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
