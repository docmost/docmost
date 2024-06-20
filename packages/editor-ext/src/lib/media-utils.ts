import type { EditorView } from "@tiptap/pm/view";

export type UploadFn = (
  file: File,
  view: EditorView,
  pos: number,
  pageId: string,
) => void;

export const handleMediaPaste = (
  view: EditorView,
  event: ClipboardEvent,
  uploadFn: UploadFn,
  pageId: string,
) => {
  if (event.clipboardData?.files.length) {
    event.preventDefault();
    const [file] = Array.from(event.clipboardData.files);
    const pos = view.state.selection.from;

    if (file) uploadFn(file, view, pos, pageId);
    return true;
  }
  return false;
};

export const handleMediaDrop = (
  view: EditorView,
  event: DragEvent,
  moved: boolean,
  uploadFn: UploadFn,
  pageId: string,
) => {
  if (!moved && event.dataTransfer?.files.length) {
    event.preventDefault();
    const [file] = Array.from(event.dataTransfer.files);
    const coordinates = view.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    });
    // here we deduct 1 from the pos or else the image will create an extra node
    if (file) uploadFn(file, view, coordinates?.pos ?? 0 - 1, pageId);
    return true;
  }
  return false;
};

export interface MediaUploadOptions {
  validateFn?: (file: File) => void;
  onUpload: (file: File, pageId: string) => Promise<any>;
}
