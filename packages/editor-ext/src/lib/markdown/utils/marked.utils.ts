import { marked } from "marked";
import { calloutExtension } from "./callout.marked";
import { mathBlockExtension } from "./math-block.marked";
import { mathInlineExtension } from "./math-inline.marked";

marked.use({
  renderer: {
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
  extensions: [calloutExtension, mathBlockExtension, mathInlineExtension],
});

marked.setOptions({ breaks: true });

export function markdownToHtml(
  markdownInput: string,
): string | Promise<string> {
  const YAML_FONT_MATTER_REGEX = /^\s*---[\s\S]*?---\s*/;

  const markdown = markdownInput
    .replace(YAML_FONT_MATTER_REGEX, "")
    .trimStart();

  return marked.parse(markdown).toString();
}
