import { marked } from "marked";
import { calloutExtension } from "./callout.marked";
import { mathBlockExtension } from "./math-block.marked";
import { mathInlineExtension } from "./math-inline.marked";
import { typstBlockExtension } from "./typst-block.marked";

marked.use({
  renderer: {
    // @ts-ignore
    list(body: string, isOrdered: boolean, start: number) {
      if (isOrdered) {
        const startAttr = start !== 1 ? ` start="${start}"` : "";
        return `<ol ${startAttr}>\n${body}</ol>\n`;
      }

      const dataType = body.includes(`<input`) ? ' data-type="taskList"' : "";
      return `<ul${dataType}>\n${body}</ul>\n`;
    },
    // @ts-ignore
    listitem({ text, raw, task: isTask, checked: isChecked }): string {
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
    typstBlockExtension,
  ],
});

/**
 * Converts Markdown text to HTML.
 *
 * The function removes an optional leading YAML front matter block, trims leading whitespace,
 * parses the remaining Markdown with line-breaks enabled, and returns the resulting HTML.
 *
 * @param markdownInput - Markdown source text; may include a leading YAML front matter section delimited by `---`.
 * @returns The generated HTML string produced from the parsed Markdown.
 */
export function markdownToHtml(
  markdownInput: string,
): string | Promise<string> {
  const YAML_FONT_MATTER_REGEX = /^\s*---[\s\S]*?---\s*/;

  const markdown = markdownInput
    .replace(YAML_FONT_MATTER_REGEX, "")
    .trimStart();

  return marked
    .options({ breaks: true })
    .parse(markdown)
    .toString();
}
