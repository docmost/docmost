import { uploadImageAction } from "@/features/editor/components/image/upload-image-action.tsx";
import { uploadVideoAction } from "@/features/editor/components/video/upload-video-action.tsx";
import { uploadAttachmentAction } from "../attachment/upload-attachment-action";
import { createMentionAction } from "@/features/editor/components/link/internal-link-paste.ts";
import { INTERNAL_LINK_REGEX } from "@/lib/constants.ts";
import { Editor } from "@tiptap/core";
import {
  getAttachmentInfo,
  uploadFile,
} from "@/features/page/services/page-service.ts";

const ATTACHMENT_NODE_TYPES = [
  "image",
  "video",
  "attachment",
  "excalidraw",
  "drawio",
];

const ATTACHMENT_URL_RE = /\/api\/files\/([0-9a-f-]+)\//;

export const handlePaste = (
  editor: Editor,
  event: ClipboardEvent,
  pageId: string,
  creatorId?: string,
) => {
  const clipboardData = event.clipboardData.getData("text/plain");

  if (INTERNAL_LINK_REGEX.test(clipboardData)) {
    // we have to do this validation here to allow the default link extension to takeover if needs be
    event.preventDefault();
    const url = clipboardData.trim();
    const { from: pos, empty } = editor.state.selection;
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

    const anchorId = match[6] ? match[6].split("#")[0] : undefined;
    const urlWithoutAnchor = anchorId
      ? url.substring(0, url.indexOf("#"))
      : url;
    createMentionAction(
      urlWithoutAnchor,
      editor.view,
      pos,
      creatorId,
      anchorId,
    );
    return true;
  }

  if (event.clipboardData?.files.length) {
    event.preventDefault();
    for (const file of event.clipboardData.files) {
      const pos = editor.state.selection.from;
      uploadImageAction(file, editor, pos, pageId);
      uploadVideoAction(file, editor, pos, pageId);
      uploadAttachmentAction(file, editor, pos, pageId);
    }
    return true;
  }

  const htmlData = event.clipboardData?.getData("text/html");
  if (htmlData && ATTACHMENT_URL_RE.test(htmlData)) {
    const pasteFrom = editor.state.selection.from;
    setTimeout(() => {
      reuploadPastedAttachments(editor, pageId, pasteFrom);
    }, 0);
  }

  return false;
};

async function reuploadPastedAttachments(
  editor: Editor,
  pageId: string,
  pasteFrom: number,
) {
  const pasteEnd = editor.state.selection.from;
  if (pasteEnd <= pasteFrom) return;

  type PastedNode = {
    pos: number;
    attachmentId: string;
    nodeTypeName: string;
    src?: string;
    url?: string;
    fileName?: string;
  };

  const pastedNodes: PastedNode[] = [];
  const seenAttachmentIds = new Set<string>();

  editor.state.doc.nodesBetween(pasteFrom, pasteEnd, (node, pos) => {
    if (!ATTACHMENT_NODE_TYPES.includes(node.type.name)) return;
    const attachmentId = node.attrs.attachmentId;
    if (!attachmentId) return;

    const src = node.attrs.src || node.attrs.url || "";
    const match = ATTACHMENT_URL_RE.exec(src);
    if (!match) return;

    const fileName =
      node.attrs.name || src.split("/").pop() || "file";

    pastedNodes.push({
      pos,
      attachmentId,
      nodeTypeName: node.type.name,
      src: node.attrs.src,
      url: node.attrs.url,
      fileName,
    });
    seenAttachmentIds.add(attachmentId);
  });

  if (pastedNodes.length === 0) return;

  const attachmentPageMap = new Map<string, string | null>();
  await Promise.all(
    [...seenAttachmentIds].map(async (id) => {
      try {
        const info = await getAttachmentInfo(id);
        attachmentPageMap.set(id, info.pageId);
      } catch {
        attachmentPageMap.set(id, null);
      }
    }),
  );

  const nodesToReupload = pastedNodes.filter((n) => {
    const ownerPageId = attachmentPageMap.get(n.attachmentId);
    return ownerPageId !== null && ownerPageId !== pageId;
  });

  if (nodesToReupload.length === 0) return;

  const uniqueNodes = new Map<string, (typeof nodesToReupload)[0]>();
  for (const node of nodesToReupload) {
    if (!uniqueNodes.has(node.attachmentId)) {
      uniqueNodes.set(node.attachmentId, node);
    }
  }

  const reuploadResults = new Map<
    string,
    { id: string; fileName: string; fileSize: number; mimeType: string }
  >();

  await Promise.all(
    [...uniqueNodes.values()].map(async (node) => {
      const fileUrl = node.src || node.url;
      if (!fileUrl) return;

      try {
        const response = await fetch(fileUrl, { credentials: "include" });
        if (!response.ok) return;
        const blob = await response.blob();
        const file = new File([blob], node.fileName, { type: blob.type });
        const newAttachment = await uploadFile(file, pageId);
        reuploadResults.set(node.attachmentId, {
          id: newAttachment.id,
          fileName: newAttachment.fileName,
          fileSize: newAttachment.fileSize,
          mimeType: newAttachment.mimeType,
        });
      } catch {
        // keep original reference on failure
      }
    }),
  );

  if (reuploadResults.size === 0) return;

  editor.chain().command(({ tr }) => {
    const sorted = [...nodesToReupload].sort((a, b) => b.pos - a.pos);

    for (const pastedNode of sorted) {
      const result = reuploadResults.get(pastedNode.attachmentId);
      if (!result) continue;

      const node = tr.doc.nodeAt(pastedNode.pos);
      if (!node || node.attrs.attachmentId !== pastedNode.attachmentId)
        continue;

      const newAttrs = { ...node.attrs };
      newAttrs.attachmentId = result.id;

      if (newAttrs.src) {
        newAttrs.src = `/api/files/${result.id}/${result.fileName}`;
      }
      if (newAttrs.url) {
        newAttrs.url = `/api/files/${result.id}/${result.fileName}`;
      }
      if (pastedNode.nodeTypeName === "attachment") {
        newAttrs.name = result.fileName;
        newAttrs.mime = result.mimeType;
        newAttrs.size = result.fileSize;
      }

      tr.setNodeMarkup(pastedNode.pos, undefined, newAttrs);
    }

    return true;
  }).run();
}

export const handleFileDrop = (
  editor: Editor,
  event: DragEvent,
  moved: boolean,
  pageId: string,
) => {
  if (!moved && event.dataTransfer?.files.length) {
    event.preventDefault();

    for (const file of event.dataTransfer.files) {
      const coordinates = editor.view.posAtCoords({
        left: event.clientX,
        top: event.clientY,
      });

      uploadImageAction(file, editor, coordinates?.pos ?? 0 - 1, pageId);
      uploadVideoAction(file, editor, coordinates?.pos ?? 0 - 1, pageId);
      uploadAttachmentAction(file, editor, coordinates?.pos ?? 0 - 1, pageId);
    }
    return true;
  }
  return false;
};
