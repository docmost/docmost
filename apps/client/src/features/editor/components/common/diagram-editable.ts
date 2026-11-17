import type { Editor } from "@tiptap/core";

// A diagram is saved as an attachment of a page, so it can only be edited where the editor has one.
export function canEditDiagram(editor: Editor): boolean {
  // @ts-ignore
  return editor.isEditable && Boolean(editor.storage?.pageId);
}
