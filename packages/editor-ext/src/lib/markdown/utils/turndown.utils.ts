import * as _TurndownService from '@joplin/turndown';
import * as TurndownPluginGfm from '@joplin/turndown-plugin-gfm';

// CJS/ESM interop: .default exists in Vite, not in NestJS
const TurndownService = (_TurndownService as any).default || _TurndownService;

function sanitizeMdLinkText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/([\[\]!])/g, '\\$1')
    .replace(/[\r\n]+/g, ' ');
}

export function htmlToMarkdown(html: string): string {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    hr: '---',
    bulletListMarker: '-',
    // Turndown skips every rule for elements with no text content, which
    // silently dropped atom nodes such as page breaks and subpages.
    blankReplacement: (_content: string, node: any) => {
      const preserved = preservedReplacement(node);
      if (preserved !== null) return preserved;
      return node.isBlock ? '\n\n' : '';
    },
  });

  const baseEscape = turndownService.escape.bind(turndownService);
  turndownService.escape = (text: string) =>
    // `&amp;` typed as text must not decode to `&`, and a single `~` would
    // otherwise be read back as strikethrough.
    baseEscape(text.replace(/&(?=#?[a-zA-Z0-9]+;)/g, '&amp;')).replace(
      /\\?~/g,
      '\\~',
    );

  turndownService.use([
    TurndownPluginGfm.tables,
    TurndownPluginGfm.strikethrough,
    TurndownPluginGfm.highlightedCodeBlock,
    taskList,
    callout,
    preserveDetail,
    listParagraph,
    orderedListItem,
    mathInline,
    mathBlock,
    iframeEmbed,
    image,
    footnoteRef,
    footnotesList,
    // Docmost-specific rules last: later rules take precedence in turndown.
    preserveHtml,
    preserveInlineMarks,
    attributedTextBlock,
    htmlWrappedBlock,
    nonGfmTable,
    exactCodeBlock,
  ]);
  const htmlWithoutColgroups = html.replace(
    /<colgroup\b[^>]*>[\s\S]*?<\/colgroup>/gi,
    '',
  );
  // Turndown drops empty elements before any rule sees them; mark empty
  // paragraphs so the paragraph rule can keep them.
  const htmlWithMarkedEmptyParagraphs = htmlWithoutColgroups.replace(
    /<p\b([^>]*)><\/p>/g,
    `<p$1><br ${EMPTY_PARAGRAPH_MARKER}=""></p>`,
  );
  return turndownService.turndown(htmlWithMarkedEmptyParagraphs);
}

function listParagraph(turndownService: _TurndownService) {
  turndownService.addRule('paragraph', {
    filter: ['p'],
    replacement: (content: string, node: HTMLInputElement) => {
      if (isEmptyParagraph(node)) {
        return isPreservedEmptyParagraph(node) ? '\n\n<p></p>\n\n' : '\n\n';
      }
      if (node.parentElement?.nodeName === 'LI') {
        // Only the first paragraph hugs the list marker; later ones need a
        // blank line or they merge into it.
        return node.previousElementSibling ? `\n\n${content}\n\n` : content;
      }
      return `\n\n${content}\n\n`;
    },
  });
}

function orderedListItem(turndownService: _TurndownService) {
  turndownService.addRule('orderedListItem', {
    filter: function (node: HTMLInputElement) {
      return node.nodeName === 'LI' && node.getAttribute('data-type') !== 'taskItem';
    },
    replacement: (content: string, node: HTMLInputElement, options: any) => {
      const parent = node.parentNode as HTMLElement;
      if (parent.nodeName !== 'OL' && parent.nodeName !== 'UL') {
        return content;
      }

      let prefix: string;
      if (parent.nodeName === 'OL') {
        const start = parseInt(parent.getAttribute('start') || '1', 10);
        const index = Array.prototype.indexOf.call(parent.children, node);
        prefix = `${start + index}. `;
      } else {
        prefix = `${options.bulletListMarker} `;
      }

      // Continuation lines must be indented by the marker width ("1. " is 3)
      // to stay inside the item.
      content = indentListContent(content, prefix.length);

      return (
        prefix +
        content +
        (node.nextSibling && !/\n$/.test(content) ? '\n' : '')
      );
    },
  });
}

function callout(turndownService: _TurndownService) {
  turndownService.addRule('callout', {
    filter: function (node: HTMLInputElement) {
      return (
        node.nodeName === 'DIV' && node.getAttribute('data-type') === 'callout'
      );
    },
    replacement: function (content: string, node: HTMLInputElement) {
      // `:::type` has no slot for a custom icon; keep the attributes as HTML.
      if (node.getAttribute('data-callout-icon')) {
        return wrapInHtml(node, content);
      }
      const calloutType = node.getAttribute('data-callout-type');
      return `\n\n:::${calloutType}\n${content.trim()}\n:::\n\n`;
    },
  });
}

function taskList(turndownService: _TurndownService) {
  turndownService.addRule('taskListItem', {
    filter: function (node: HTMLInputElement) {
      return (
        node.getAttribute('data-type') === 'taskItem' &&
        node.parentNode.nodeName === 'UL'
      );
    },
    replacement: function (content: string, node: HTMLInputElement) {
      const isChecked = node.getAttribute('data-checked') === 'true';
      const prefix = `- ${isChecked ? '[x]' : '[ ]'} `;
      // Converted content, not textContent: keeps marks, links and nested
      // task lists.
      const body = indentListContent(content, 2);

      return (
        prefix +
        body +
        (node.nextSibling && !/\n$/.test(body) ? '\n' : '')
      );
    },
  });
}

function preserveDetail(turndownService: _TurndownService) {
  turndownService.addRule('preserveDetail', {
    filter: function (node: HTMLInputElement) {
      return node.nodeName === 'DETAILS';
    },
    replacement: function (_content: string, node: HTMLInputElement) {
      const summary = node.querySelector(':scope > summary');
      let detailSummary = '';

      // The summary sits inside an HTML block where markdown is not parsed,
      // so its inline formatting has to stay HTML.
      if (summary) {
        detailSummary = `<summary>${cleanHtml(summary.innerHTML)}</summary>`;
      }
      const open = node.hasAttribute('open') ? ' open' : '';

      const detailsContent = Array.from(node.childNodes)
        .filter((child) => child.nodeName !== 'SUMMARY')
        .map((child) =>
          child.nodeType === 1
            ? turndownService.turndown((child as HTMLElement).outerHTML)
            : child.textContent,
        )
        .join('');

      return `\n<details markdown="1"${open}>\n${detailSummary}\n\n${detailsContent}\n\n</details>\n`;
    },
  });
}

function mathInline(turndownService: _TurndownService) {
  turndownService.addRule('mathInline', {
    filter: function (node: HTMLInputElement) {
      return (
        node.nodeName === 'SPAN' &&
        node.getAttribute('data-type') === 'mathInline'
      );
    },
    // Raw LaTeX: the converted content is markdown-escaped (`\*`, `\_`).
    replacement: function (_content: string, node: HTMLElement) {
      return `$${node.textContent}$`;
    },
  });
}

function mathBlock(turndownService: _TurndownService) {
  turndownService.addRule('mathBlock', {
    filter: function (node: HTMLInputElement) {
      return (
        node.nodeName === 'DIV' &&
        node.getAttribute('data-type') === 'mathBlock'
      );
    },
    replacement: function (_content: string, node: HTMLElement) {
      return `\n$$\n${node.textContent}\n$$\n`;
    },
  });
}

function iframeEmbed(turndownService: _TurndownService) {
  turndownService.addRule('iframeEmbed', {
    filter: function (node: HTMLInputElement) {
      return node.nodeName === 'IFRAME';
    },
    replacement: function (_content: string, node: HTMLInputElement) {
      const src = node.getAttribute('src');
      return '[' + src + '](' + src + ')';
    },
  });
}

function image(turndownService: _TurndownService) {
  turndownService.addRule('image', {
    filter: 'img',
    replacement: function (_content: string, node: HTMLInputElement) {
      const src = node.getAttribute('src') || '';
      if (!src) return '';
      const alt = sanitizeMdLinkText(node.getAttribute('alt') || '');
      const title = node.getAttribute('title') || '';
      const titlePart = title ? ' "' + title.replace(/"/g, '\\"') + '"' : '';
      return '![' + alt + '](' + src + titlePart + ')';
    },
  });
}

function getFootnoteAnchor(node: HTMLElement): HTMLElement | null {
  const child = node.firstElementChild as HTMLElement | null;
  return child?.nodeName === 'A' && child.classList.contains('footnote-ref')
    ? child
    : null;
}

function footnoteRef(turndownService: _TurndownService) {
  turndownService.addRule('footnoteRef', {
    filter: function (node: HTMLInputElement) {
      return node.nodeName === 'SUP' && !!getFootnoteAnchor(node);
    },
    replacement: function (_content: string, node: HTMLInputElement) {
      const anchor = getFootnoteAnchor(node);
      const number =
        anchor.getAttribute('data-reference-number') || anchor.textContent;
      return `[^${number}]`;
    },
  });
}

function footnotesList(turndownService: _TurndownService) {
  turndownService.addRule('footnotesList', {
    filter: function (node: HTMLInputElement) {
      return node.nodeName === 'OL' && node.classList.contains('footnotes');
    },
    replacement: function (_content: string, node: HTMLInputElement) {
      const items = Array.from(node.children).filter(
        (child) => child.nodeName === 'LI',
      );
      const definitions = items.map((li, index) => {
        const number =
          (li.getAttribute('id') || '').replace('fn:', '') ||
          String(index + 1);
        const markdown = turndownService
          .turndown((li as HTMLElement).innerHTML)
          .trim();
        // continuation lines need a 4-space indent to stay in the footnote
        const [first, ...rest] = markdown.split('\n');
        const body = [
          first,
          ...rest.map((line: string) => (line.trim() ? `    ${line}` : line)),
        ].join('\n');
        return `[^${number}]: ${body}`;
      });
      return `\n\n${definitions.join('\n')}\n\n`;
    },
  });
}

// ---------------------------------------------------------------------------
// Lossless fallbacks: anything markdown cannot express is kept as HTML, which
// markdownToHtml passes through and the editor schema parses back.
// ---------------------------------------------------------------------------

function indentListContent(content: string, width: number): string {
  return content
    .replace(/^\n+/, '')
    .replace(/\n+$/, '\n')
    .replace(/\n/gm, '\n' + ' '.repeat(width));
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// HTML kept verbatim in markdown: drop serializer noise and ids regenerated on
// import, and encode newlines so a blank line in the content (e.g. code in a
// table cell) cannot end the CommonMark HTML block early.
function cleanHtml(html: string): string {
  return html
    .replace(/\s+xmlns="[^"]*"/g, '')
    .replace(/\s+dir="auto"/g, '')
    .replace(/(<(?:p|h[1-6])\b[^>]*?)\s+data-id="[^"]*"/g, '$1')
    .replace(/(<h[1-6]\b[^>]*?)\s+id="[^"]*"/g, '$1')
    .replace(/\r?\n/g, '&#10;');
}

function openTag(node: HTMLElement, keep?: string[]): string {
  const attrs = Array.from(node.attributes)
    .filter(
      (attr) =>
        attr.name !== 'xmlns' &&
        !(attr.name === 'dir' && attr.value === 'auto') &&
        (!keep || keep.includes(attr.name)),
    )
    .map((attr) =>
      attr.value === ''
        ? ` ${attr.name}`
        : ` ${attr.name}="${escapeAttribute(attr.value)}"`,
    )
    .join('');
  return `<${node.nodeName.toLowerCase()}${attrs}>`;
}

// Block HTML whose children stay markdown: the blank lines end the opening
// HTML block, so the content in between is parsed as markdown again.
function wrapInHtml(node: HTMLElement, content: string): string {
  const tag = node.nodeName.toLowerCase();
  return `\n\n${openTag(node)}\n\n${content.trim()}\n\n</${tag}>\n\n`;
}

const HTML_BLOCK_TYPES = new Set([
  'attachment',
  'base-embed',
  'drawio',
  'embed',
  'excalidraw',
  'pageBreak',
  'pdf',
  'subpages',
  'transclusionReference',
]);

const HTML_INLINE_TYPES = new Set(['mention', 'status']);

const PORTABLE_IMAGE_ATTRIBUTES = new Set(['src', 'alt', 'title', 'dir', 'xmlns']);

// An image `![alt](src)` can carry without losing anything.
function isPortableImage(node: HTMLElement): boolean {
  return Array.from(node.attributes).every(
    (attr) =>
      PORTABLE_IMAGE_ATTRIBUTES.has(attr.name) ||
      (attr.name === 'data-align' && attr.value === 'center'),
  );
}

function isPreservedBlock(node: HTMLElement): boolean {
  switch (node.nodeName) {
    case 'DIV':
      return (
        HTML_BLOCK_TYPES.has(node.getAttribute('data-type')) ||
        node.hasAttribute('data-youtube-video')
      );
    case 'VIDEO':
    case 'AUDIO':
      return true;
    case 'IMG':
      return !isPortableImage(node);
    default:
      return false;
  }
}

function isPreservedInline(node: HTMLElement): boolean {
  return (
    node.nodeName === 'SPAN' &&
    HTML_INLINE_TYPES.has(node.getAttribute('data-type'))
  );
}

function preservedReplacement(node: HTMLElement): string | null {
  if (isPreservedBlock(node)) return `\n\n${cleanHtml(node.outerHTML)}\n\n`;
  if (isPreservedInline(node)) return cleanHtml(node.outerHTML);
  return null;
}

const EMPTY_PARAGRAPH_MARKER = 'data-docmost-empty-paragraph';

function isEmptyParagraph(node: HTMLElement): boolean {
  const only = node.firstChild as HTMLElement | null;
  return (
    node.childNodes.length === 1 &&
    only?.nodeName === 'BR' &&
    only.hasAttribute(EMPTY_PARAGRAPH_MARKER)
  );
}

// Empty paragraphs are layout the user typed. The last one in a container is
// left out: the editor's trailing node re-adds it.
function isPreservedEmptyParagraph(node: HTMLElement): boolean {
  if (!node.nextElementSibling) return false;
  const parent = node.parentElement?.nodeName;
  return parent !== 'LI' && parent !== 'TD' && parent !== 'TH';
}

function preserveHtml(turndownService: _TurndownService) {
  turndownService.addRule('preserveHtml', {
    filter: (node: HTMLElement) =>
      isPreservedBlock(node) || isPreservedInline(node),
    replacement: (_content: string, node: HTMLElement) =>
      preservedReplacement(node),
  });
}

function isTextColorSpan(node: HTMLElement): boolean {
  return (
    node.nodeName === 'SPAN' &&
    !node.hasAttribute('data-type') &&
    /(^|;)\s*color\s*:/.test(node.getAttribute('style') || '')
  );
}

// Marks with no markdown syntax (underline, highlight, text color, comments)
// and internal links. The content stays markdown inside the inline HTML.
function preserveInlineMarks(turndownService: _TurndownService) {
  turndownService.addRule('preserveInlineMarks', {
    filter: (node: HTMLElement) =>
      node.nodeName === 'U' ||
      node.nodeName === 'MARK' ||
      isTextColorSpan(node) ||
      (node.nodeName === 'SPAN' && node.hasAttribute('data-comment-id')) ||
      (node.nodeName === 'A' && node.getAttribute('data-internal') === 'true'),
    replacement: (content: string, node: HTMLElement) => {
      const keep =
        node.nodeName === 'A' ? ['href', 'title', 'data-internal'] : undefined;
      return `${openTag(node, keep)}${content}</${node.nodeName.toLowerCase()}>`;
    },
  });
}

// Paragraphs and headings with alignment or indentation.
function attributedTextBlock(turndownService: _TurndownService) {
  turndownService.addRule('attributedTextBlock', {
    filter: (node: HTMLElement) =>
      /^(P|H[1-6])$/.test(node.nodeName) &&
      (node.hasAttribute('data-indent') ||
        /text-align/.test(node.getAttribute('style') || '')),
    replacement: (_content: string, node: HTMLElement) =>
      `\n\n${cleanHtml(node.outerHTML)}\n\n`,
  });
}

// Containers with attributes but markdown-expressible children.
function htmlWrappedBlock(turndownService: _TurndownService) {
  turndownService.addRule('htmlWrappedBlock', {
    filter: (node: HTMLElement) =>
      node.nodeName === 'DIV' &&
      ['columns', 'column', 'transclusionSource'].includes(
        node.getAttribute('data-type'),
      ),
    replacement: (content: string, node: HTMLElement) =>
      wrapInHtml(node, content),
  });
}

// GFM tables hold an optional header row (a headerless table gets an empty
// one, dropped again on import) plus single-paragraph cells without spans,
// widths, colours or alignment. Anything richer is kept as an HTML table.
function isGfmTable(table: HTMLElement): boolean {
  const rows = Array.from(table.querySelectorAll('tr'));
  if (!rows.length) return false;

  const hasHeaderRow = Array.from(rows[0].children).every(
    (cell) => cell.nodeName === 'TH',
  );

  return rows.every((row, rowIndex) =>
    Array.from(row.children).every((cell) => {
      const isHeaderCell = cell.nodeName === 'TH';
      if (isHeaderCell !== (rowIndex === 0 && hasHeaderRow)) return false;

      const plainCell = Array.from(cell.attributes).every(
        (attr) =>
          attr.name === 'dir' ||
          ((attr.name === 'colspan' || attr.name === 'rowspan') &&
            attr.value === '1'),
      );
      if (!plainCell) return false;

      const blocks = Array.from(cell.children);
      if (blocks.length !== 1 || blocks[0].nodeName !== 'P') return false;
      const paragraph = blocks[0] as HTMLElement;
      return (
        !paragraph.querySelector('br') &&
        Array.from(paragraph.attributes).every(
          (attr) => attr.name === 'dir' || attr.name === 'data-id',
        )
      );
    }),
  );
}

function nonGfmTable(turndownService: _TurndownService) {
  turndownService.addRule('nonGfmTable', {
    filter: (node: HTMLElement) =>
      node.nodeName === 'TABLE' && !isGfmTable(node),
    replacement: (_content: string, node: HTMLElement) =>
      `\n\n${cleanHtml(node.outerHTML)}\n\n`,
  });
}

// Turndown's fenced code rule trims the code; leading and trailing blank lines
// are content.
function exactCodeBlock(turndownService: _TurndownService) {
  turndownService.addRule('exactCodeBlock', {
    filter: (node: HTMLElement) =>
      node.nodeName === 'PRE' && node.firstElementChild?.nodeName === 'CODE',
    replacement: (_content: string, node: HTMLElement) => {
      const code = node.firstElementChild as HTMLElement;
      const language =
        (code.getAttribute('class') || '').match(/language-(\S+)/)?.[1] ?? '';
      const text = code.textContent ?? '';
      const longestRun = Math.max(
        0,
        ...(text.match(/`+/g) ?? []).map((run) => run.length),
      );
      const fence = '`'.repeat(Math.max(3, longestRun + 1));
      return `\n\n${fence}${language}\n${text}\n${fence}\n\n`;
    },
  });
}
