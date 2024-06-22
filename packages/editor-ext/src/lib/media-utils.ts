import type { EditorView } from "@tiptap/pm/view";

export type UploadFn = (
  file: File,
  view: EditorView,
  pos: number,
  pageId: string,
) => void;

export interface MediaUploadOptions {
  validateFn?: (file: File) => void;
  onUpload: (file: File, pageId: string) => Promise<any>;
}
