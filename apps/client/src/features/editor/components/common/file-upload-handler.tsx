import type { EditorView } from "@tiptap/pm/view";
import { uploadImageAction } from "@/features/editor/components/image/upload-image-action.tsx";
import { uploadVideoAction } from "@/features/editor/components/video/upload-video-action.tsx";

export const handleFilePaste = (
  view: EditorView,
  event: ClipboardEvent,
  pageId: string,
) => {
  if (event.clipboardData?.files.length) {
    event.preventDefault();
    const [file] = Array.from(event.clipboardData.files);
    const pos = view.state.selection.from;

    if (file) {
      uploadImageAction(file, view, pos, pageId);
      uploadVideoAction(file, view, pos, pageId);
    }
    return true;
  }
  return false;
};

export const handleFileDrop = (
  view: EditorView,
  event: DragEvent,
  moved: boolean,
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
    if (file) {
      uploadImageAction(file, view, coordinates?.pos ?? 0 - 1, pageId);
      uploadVideoAction(file, view, coordinates?.pos ?? 0 - 1, pageId);
    }
    return true;
  }
  return false;
};
