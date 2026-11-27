import type { Editor } from "@tiptap/core";

// Emits update: media node views show or hide their resize handles on it.
export function syncEditable(editor: Editor, editable: boolean) {
  if (editor.isEditable !== editable) editor.setEditable(editable);
}
