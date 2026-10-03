import { marked } from "marked";
import { calloutExtension } from "./callout.marked";
import { escapeHtml } from "./escape-html";
import { mathBlockExtension } from "./math-block.marked";
import { mathInlineExtension } from "./math-inline.marked";
import {
  footnoteDefExtension,
  footnoteRefExtension,
  renderFootnotesList,
  resetFootnotes,
} from "./footnotes.marked";

marked.use({
  renderer: {
    // The default renderer normalises code to exactly one trailing newline;
    // leading and trailing blank lines are part of the code.
    code({ text, lang, escaped }) {
      const language = (lang || "").match(/^\S*/)?.[0];
      const classAttr = language
        ? ` class="language-${escapeHtml(language)}"`
        : "";
      const code = escaped ? text : escapeHtml(text);
      return `<pre><code${classAttr}>${code}</code></pre>\n`;
    },
    list({ ordered, start, items }) {
      let body = "";
      for (const item of items) {
        body += this.listitem(item);
      }

      if (ordered) {
        const startAttr = start !== 1 ? ` start="${start}"` : "";
        return `<ol${startAttr}>\n${body}</ol>\n`;
      }

      const isTaskList = items.some((item) => item.task);
      const dataType = isTaskList ? ' data-type="taskList"' : "";
      return `<ul${dataType}>\n${body}</ul>\n`;
    },
    listitem({ tokens, task: isTask, checked: isChecked }) {
      const text = this.parser.parse(tokens);
      if (!isTask) {
        return `<li>${text}</li>\n`;
      }
      const checkedAttr = isChecked
        ? 'data-checked="true"'
        : 'data-checked="false"';
      return `<li data-type="taskItem" ${checkedAttr}>${text}</li>\n`;
    },
  },
});

marked.use({
  extensions: [
    calloutExtension,
    mathBlockExtension,
    mathInlineExtension,
    footnoteDefExtension,
    footnoteRefExtension,
  ],
});

marked.setOptions({ breaks: true });

// A leading `---` block is only front matter when every line in it looks like
// YAML (`key: value`, indented continuation, list item, comment or blank) and at least
// one line is a key. Otherwise it is a horizontal rule and must be kept.
const FRONT_MATTER_REGEX = /^\s*---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const YAML_KEY_LINE = /^[\w.-]+[ \t]*:(?:[ \t].*)?$/;
const YAML_OTHER_LINE = /^(?:[ \t]+\S.*|-[ \t].*|#.*|[ \t]*)$/;

function stripFrontMatter(markdown: string): string {
  const match = FRONT_MATTER_REGEX.exec(markdown);
  if (!match) return markdown;

  const lines = match[1].split(/\r?\n/);
  // Exported horizontal rules are always followed by a blank line; real front
  // matter starts with a key straight away.
  const isYaml =
    YAML_KEY_LINE.test(lines[0]) &&
    lines.every(
      (line) => YAML_KEY_LINE.test(line) || YAML_OTHER_LINE.test(line),
    );

  return isYaml ? markdown.slice(match[0].length) : markdown;
}

// Export gives headerless tables an empty GFM header row; drop it so the table
// comes back without one.
const EMPTY_TABLE_HEADER_REGEX =
  /<thead>\s*<tr>\s*(?:<th(?:\s[^>]*)?>\s*<\/th>\s*)+<\/tr>\s*<\/thead>\s*/g;

// marked wraps a lone image/video/audio in <p>; those are block nodes in the
// editor, so the wrapper only produces a stray empty paragraph.
const LONE_MEDIA_PARAGRAPH_REGEX =
  /<p>\s*(<img\b[^>]*>|<(video|audio)\b(?:(?!<\/?p\b)[\s\S])*?<\/\2>)\s*<\/p>/g;

export function markdownToHtml(
  markdownInput: string,
): string | Promise<string> {
  const markdown = stripFrontMatter(markdownInput).trimStart();

  resetFootnotes();
  const html = marked
    .parse(markdown)
    .toString()
    .replace(LONE_MEDIA_PARAGRAPH_REGEX, "$1")
    .replace(EMPTY_TABLE_HEADER_REGEX, "");
  return html + renderFootnotesList();
}
