import type { Editor } from "@tiptap/core";
import type { UploadTarget } from "@docmost/editor-ext";

export function getEditorUploadTarget(editor: Editor): UploadTarget | null {
  const storage = editor.storage as {
    pageId?: string;
    templateId?: string;
  };
  if (storage?.pageId) return { pageId: storage.pageId };
  if (storage?.templateId) return { templateId: storage.templateId };
  return null;
}
