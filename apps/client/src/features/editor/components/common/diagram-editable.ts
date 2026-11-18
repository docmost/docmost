import type { Editor } from "@tiptap/core";
import { getEditorUploadTarget } from "@/features/editor/utils/upload-target";

// A diagram is saved as an attachment of a page or template, so it can only be edited where the editor has one.
export function canEditDiagram(editor: Editor): boolean {
  return editor.isEditable && Boolean(getEditorUploadTarget(editor));
}
