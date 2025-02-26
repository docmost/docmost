import type { EditorView } from "@tiptap/pm/view";
import { uploadImageAction } from "@/features/editor/components/image/upload-image-action.tsx";
import { uploadVideoAction } from "@/features/editor/components/video/upload-video-action.tsx";
import { uploadAttachmentAction } from "../attachment/upload-attachment-action";
import { createMentionAction } from "@/features/editor/components/link/internal-link-paste.ts";
import { Slice } from "@tiptap/pm/model";
import { INTERNAL_LINK_REGEX } from "@/lib/constants.ts";

export const handlePaste = (
  view: EditorView,
  event: ClipboardEvent,
  pageId: string,
  creatorId?: string,
) => {
  const clipboardData = event.clipboardData.getData("text/plain");

  if (INTERNAL_LINK_REGEX.test(clipboardData)) {
    // we have to do this validation here to allow the default link extension to takeover if needs be
    event.preventDefault();
    const url = clipboardData.trim();
    const { from: pos, empty } = view.state.selection;
    const match = INTERNAL_LINK_REGEX.exec(url);
    const currentPageMatch = INTERNAL_LINK_REGEX.exec(window.location.href);

    // pasted link must be from the same workspace/domain and must not be on a selection
    if (!empty || match[2] !== window.location.host) {
      // allow the default link extension to handle this
      return false;
    }

    // for now, we only support internal links from the same space
    // compare space name
    if (currentPageMatch[4].toLowerCase() !== match[4].toLowerCase()) {
      return false;
    }

    createMentionAction(url, view, pos, creatorId);
    return true;
  }

  if (event.clipboardData?.files.length) {
    event.preventDefault();
    const [file] = Array.from(event.clipboardData.files);
    const pos = view.state.selection.from;

    if (file) {
      uploadImageAction(file, view, pos, pageId);
      uploadVideoAction(file, view, pos, pageId);
      uploadAttachmentAction(file, view, pos, pageId);
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
      uploadAttachmentAction(file, view, coordinates?.pos ?? 0 - 1, pageId);
    }
    return true;
  }
  return false;
};
