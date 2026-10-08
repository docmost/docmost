import { Token, marked } from 'marked';
import { generateNodeId } from '../../utils';

interface FootnoteRefToken {
  type: 'footnoteRef';
  label: string;
  raw: string;
}

interface FootnoteDefToken {
  type: 'footnoteDef';
  label: string;
  text: string;
  raw: string;
}

// Parse-scoped state: markdownToHtml resets before the top-level parse and
// appends the collected list after it. Nested marked.parse calls (callout,
// footnote definitions) share this state, so hooks cannot be used here.
let footnoteRefs: { label: string; id: string; number: number }[] = [];
let footnoteDefs = new Map<string, string>();

export function resetFootnotes() {
  footnoteRefs = [];
  footnoteDefs = new Map();
}

export function renderFootnotesList(): string {
  if (!footnoteRefs.length) return '';
  const items = footnoteRefs.map(({ label, id, number }) => {
    const body = footnoteDefs.get(label) || '<p></p>';
    return `<li id="fn:${number}" data-id="${id}">${body}</li>`;
  });
  return `<ol class="footnotes">\n${items.join('\n')}\n</ol>\n`;
}

export const footnoteRefExtension = {
  name: 'footnoteRef',
  level: 'inline',
  start(src: string) {
    return src.indexOf('[^');
  },
  tokenizer(src: string): FootnoteRefToken | undefined {
    const match = /^\[\^([^\]\s]+)\]/.exec(src);
    if (match) {
      return {
        type: 'footnoteRef',
        raw: match[0],
        label: match[1].toLowerCase(),
      };
    }
  },
  renderer(token: Token) {
    const refToken = token as FootnoteRefToken;
    const number = footnoteRefs.length + 1;
    const id = generateNodeId();
    footnoteRefs.push({ label: refToken.label, id, number });
    return `<sup id="fnref:${number}"><a class="footnote-ref" data-id="${id}" data-reference-number="${number}" href="#fn:${number}">${number}</a></sup>`;
  },
};

export const footnoteDefExtension = {
  name: 'footnoteDef',
  level: 'block',
  start(src: string) {
    return src.match(/^\[\^[^\]\s]+\]:/m)?.index ?? -1;
  },
  tokenizer(src: string): FootnoteDefToken | undefined {
    const firstLine = /^\[\^([^\]\s]+)\]:[ \t]*/.exec(src);
    if (!firstLine) return undefined;

    const lines = src.split('\n');
    const contentLines = [lines[0].slice(firstLine[0].length)];
    let consumed = 1;
    while (consumed < lines.length) {
      const line = lines[consumed];
      if (/^[ \t]{2,}\S/.test(line)) {
        contentLines.push(line.replace(/^[ \t]{1,4}/, ''));
        consumed += 1;
      } else if (
        /^[ \t]*$/.test(line) &&
        consumed + 1 < lines.length &&
        /^[ \t]{2,}\S/.test(lines[consumed + 1])
      ) {
        contentLines.push('');
        consumed += 1;
      } else {
        break;
      }
    }

    const raw =
      lines.slice(0, consumed).join('\n') +
      (consumed < lines.length ? '\n' : '');
    return {
      type: 'footnoteDef',
      raw,
      label: firstLine[1].toLowerCase(),
      text: contentLines.join('\n').trim(),
    };
  },
  renderer(token: Token) {
    const defToken = token as FootnoteDefToken;
    const body = defToken.text
      ? marked.parse(defToken.text).toString()
      : '<p></p>';
    footnoteDefs.set(defToken.label, body);
    return '';
  },
};
