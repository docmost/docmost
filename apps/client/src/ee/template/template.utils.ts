import { Editor, type JSONContent } from "@tiptap/core";
import { ITemplate } from "@/ee/template/types/template.types";

export function applyTemplateToPage(
  editor: Editor,
  titleEditor: Editor,
  template: ITemplate,
): boolean {
  if (!editor.isEmpty) return false;

  if (titleEditor.isEmpty && template.title) {
    titleEditor.commands.setContent(template.title, { emitUpdate: true });
  }
  editor.commands.setContent(template.content);
  return true;
}

export function withoutUploadPlaceholders(content: JSONContent): JSONContent {
  if (!content.content) return content;
  return {
    ...content,
    content: content.content.map((node) =>
      node.attrs?.placeholder
        ? { type: "paragraph" }
        : withoutUploadPlaceholders(node),
    ),
  };
}
