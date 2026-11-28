import { uploadImageAction } from "@/features/editor/components/image/upload-image-action.tsx";
import { uploadVideoAction } from "@/features/editor/components/video/upload-video-action.tsx";
import { uploadAttachmentAction } from "../attachment/upload-attachment-action";
import { uploadPdfAction } from "../pdf/upload-pdf-action";
import { createMentionAction } from "@/features/editor/components/link/internal-link-paste.ts";
import { INTERNAL_LINK_REGEX } from "@/lib/constants.ts";
import { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { find } from "linkifyjs";
import {
  isHttpUrl,
  matchIntegrationLink,
  type UploadTarget,
} from "@docmost/editor-ext";
import { linkPasteMenuKey } from "@/features/editor/extensions/link-paste-menu";
import { isLinkPreviewDisabled } from "@/lib/config";
import { integrationPasteMenuKey } from "@/features/editor/extensions/integration-paste-menu";
import { canPlaceIntegrationCard } from "@/features/editor/components/integration-link/integration-display";
import { queryClient } from "@/main.tsx";
import { Integration } from "@/features/integration/types/integration.types";
import type { DiagramType, IAttachment } from "@/features/attachments/types/attachment.types";
import {
  getAttachmentInfo,
  uploadFile,
} from "@/features/page/services/page-service.ts";

const ATTACHMENT_NODE_TYPES = [
  "image",
  "video",
  "audio",
  "pdf",
  "attachment",
  "excalidraw",
  "drawio",
];

const ATTACHMENT_URL_RE = /\/files\/[0-9a-f-]+\//;

// copied cards and mentions paste back as nodes
const INTEGRATION_NODE_HTML_RE = /data-type="integration(Card|Mention)"/;
// any Docmost node HTML (cards, mentions, file nodes) pastes back as nodes
const NODE_HTML_MARKER = 'data-type="';

// Reads the cache the page editor prefetches; a cold cache pastes an ordinary link.
function matchInstalledIntegrationLink(url: string) {
  const installed =
    queryClient.getQueryData<Integration[]>(["installed-integrations"]) ?? [];
  const unfurlHosts = Object.fromEntries(
    installed
      .filter((integration) => integration.unfurlHosts)
      .map((integration) => [integration.type, integration.unfurlHosts]),
  );
  const match = matchIntegrationLink(url, unfurlHosts);
  return match && installed.some((i) => i.type === match.provider)
    ? match
    : null;
}

export const handlePaste = (
  editor: Editor,
  event: ClipboardEvent,
  uploadTarget: UploadTarget,
  creatorId?: string,
) => {
  const clipboardData = event.clipboardData.getData("text/plain");

  const integrationMatch = matchInstalledIntegrationLink(clipboardData.trim());
  if (
    integrationMatch &&
    !INTEGRATION_NODE_HTML_RE.test(event.clipboardData.getData("text/html")) &&
    editor.state.selection.empty &&
    editor.state.selection.$from.parent.type.name === "paragraph" &&
    !editor.isActive("code")
  ) {
    const pastedUrl = clipboardData.trim();
    const { $from } = editor.state.selection;

    if (canPlaceIntegrationCard(editor, $from.pos)) {
      event.preventDefault();
      editor
        .chain()
        .focus()
        .setIntegrationCard({
          url: pastedUrl,
          provider: integrationMatch.provider,
        })
        // Set the meta in this transaction (BubbleMenu ignores meta-only ones) and find the node by changed range, not url.
        .command(({ tr }) => {
          let start: number | null = null;
          let end: number | null = null;
          tr.mapping.maps.forEach((map, index) => {
            const rest = tr.mapping.slice(index + 1);
            map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
              const mappedStart = rest.map(newStart, -1);
              const mappedEnd = rest.map(newEnd, 1);
              start =
                start === null ? mappedStart : Math.min(start, mappedStart);
              end = end === null ? mappedEnd : Math.max(end, mappedEnd);
            });
          });
          if (start === null || end === null) return true;

          let pastedPos: number | null = null;
          tr.doc.nodesBetween(
            start,
            Math.min(end, tr.doc.content.size),
            (node, pos) => {
              if (node.type.name === "integrationCard") {
                pastedPos = pos;
              }
            },
          );
          if (pastedPos !== null) {
            tr.setMeta(integrationPasteMenuKey, {
              pos: pastedPos,
              joinBefore: $from.parentOffset > 0,
              joinAfter: $from.parentOffset < $from.parent.content.size,
            });
          }
          return true;
        })
        .run();
      return true;
    }

    // Containers such as footnotes only hold paragraphs, but a mention still fits.
    const mentionType = editor.schema.nodes.integrationMention;
    if (
      mentionType &&
      $from.parent.canReplaceWith($from.index(), $from.index(), mentionType)
    ) {
      event.preventDefault();
      editor
        .chain()
        .focus()
        .setIntegrationMention({
          url: pastedUrl,
          provider: integrationMatch.provider,
        })
        .run();
      return true;
    }
  }

  // A query, such as a base's ?view=, still links to the same page.
  const pageLink = clipboardData.replace(/\?[^#]*/, "");
  const { from: pos, empty } = editor.state.selection;
  const url = pageLink.trim();
  const match = INTERNAL_LINK_REGEX.test(pageLink)
    ? INTERNAL_LINK_REGEX.exec(url)
    : null;

  // a /p/ link on another host is an ordinary link, handled below
  if (match && (!empty || match[2] === window.location.host)) {
    // we have to do this validation here to allow the default link extension to takeover if needs be
    event.preventDefault();

    // pasted link must not be on a selection
    if (!empty) {
      // allow the default link extension to handle this
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

  const pastedUrl = clipboardData.trim();
  const linkType = editor.schema.marks.link;
  const { $from } = editor.state.selection;
  if (
    linkType &&
    !integrationMatch &&
    empty &&
    isHttpUrl(pastedUrl) &&
    // a trailing period or comma stays plain text, as in the default paste
    find(pastedUrl).some((link) => link.isLink && link.value === pastedUrl) &&
    !event.clipboardData.files?.length &&
    !event.clipboardData.getData("text/html").includes(NODE_HTML_MARKER) &&
    INTERNAL_LINK_REGEX.exec(pastedUrl)?.[2] !== window.location.host &&
    $from.parent.isTextblock &&
    $from.parent.type.allowsMarkType(linkType) &&
    !editor.isActive("code")
  ) {
    event.preventDefault();
    const { tr } = editor.state;
    const from = tr.selection.from;
    const to = from + pastedUrl.length;
    tr.insertText(pastedUrl, from)
      .addMark(from, to, linkType.create({ href: pastedUrl }))
      .setSelection(TextSelection.create(tr.doc, to))
      .scrollIntoView();
    if (!isLinkPreviewDisabled()) {
      tr.setMeta(linkPasteMenuKey, { from, to, url: pastedUrl });
    }
    editor.view.dispatch(tr);
    return true;
  }

  const htmlData = event.clipboardData?.getData("text/html");
  const hasHtmlTable = htmlData && /<table[\s>]/i.test(htmlData);

  if (event.clipboardData?.files.length && !hasHtmlTable) {
    event.preventDefault();
    for (const file of event.clipboardData.files) {
      const pos = editor.state.selection.from;
      uploadImageAction(file, editor, pos, uploadTarget);
      uploadVideoAction(file, editor, pos, uploadTarget);
      uploadPdfAction(file, editor, pos, uploadTarget);
      uploadAttachmentAction(file, editor, pos, uploadTarget);
    }
    return true;
  }

  if (htmlData && ATTACHMENT_URL_RE.test(htmlData)) {
    const docBeforePaste = editor.state.doc;
    setTimeout(() => {
      reuploadPastedAttachments(editor, uploadTarget, docBeforePaste);
    }, 0);
  }

  return false;
};

async function reuploadPastedAttachments(
  editor: Editor,
  uploadTarget: UploadTarget,
  docBeforePaste: ProseMirrorNode,
) {
  const doc = editor.state.doc;
  const pasteFrom = docBeforePaste.content.findDiffStart(doc.content);
  if (pasteFrom === null) return;
  const diffEnd = docBeforePaste.content.findDiffEnd(doc.content);
  const pasteEnd = Math.max(
    diffEnd?.b ?? pasteFrom,
    pasteFrom + doc.content.size - docBeforePaste.content.size,
  );
  if (pasteEnd <= pasteFrom) return;

  type PastedNode = {
    pos: number;
    attachmentId: string;
  };

  const pastedNodes: PastedNode[] = [];
  const files = new Map<string, { name?: string; diagramType?: DiagramType }>();

  editor.state.doc.nodesBetween(pasteFrom, pasteEnd, (node, pos) => {
    if (!ATTACHMENT_NODE_TYPES.includes(node.type.name)) return;
    const attachmentId = node.attrs.attachmentId;
    if (!attachmentId) return;

    const src = node.attrs.src || node.attrs.url || "";
    if (!ATTACHMENT_URL_RE.test(src)) return;

    pastedNodes.push({ pos, attachmentId });
    const type = node.type.name;
    const diagramType = type === "drawio" || type === "excalidraw" ? type : undefined;
    const file = files.get(attachmentId);
    if (!file) {
      files.set(attachmentId, { diagramType, name: node.attrs.name });
    } else if (file.diagramType !== diagramType) {
      // Keep a shared copy immutable when the paste also uses it as an ordinary file.
      file.diagramType = undefined;
    }
  });

  if (pastedNodes.length === 0) return;

  const copies = new Map<string, IAttachment>();
  await Promise.all(
    Array.from(files, async ([id, file]) => {
      try {
        const source = await getAttachmentInfo(id);
        const sameOwner =
          "pageId" in uploadTarget
            ? source.pageId === uploadTarget.pageId
            : source.templateId === uploadTarget.templateId;
        if (sameOwner) return;

        const url = `/api/files/${id}/${encodeURIComponent(source.fileName)}`;
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) return;
        const blob = await response.blob();
        const upload = new File([blob], file.name || source.fileName, {
          type: blob.type,
        });
        const copy = file.diagramType
          ? await uploadFile(upload, uploadTarget, { type: file.diagramType })
          : await uploadFile(upload, uploadTarget);
        copies.set(id, copy);
      } catch {
        // keep original reference on failure
      }
    }),
  );

  if (copies.size === 0) return;
  if (editor.isDestroyed) return;

  editor.chain().command(({ tr }) => {
    const sorted = pastedNodes.sort((a, b) => b.pos - a.pos);

    for (const pastedNode of sorted) {
      const result = copies.get(pastedNode.attachmentId);
      if (!result) continue;

      const node = tr.doc.nodeAt(pastedNode.pos);
      if (!node || node.attrs.attachmentId !== pastedNode.attachmentId)
        continue;

      const newAttrs = { ...node.attrs };
      newAttrs.attachmentId = result.id;

      const url = `/api/files/${result.id}/${encodeURIComponent(result.fileName)}`;
      if (newAttrs.src) newAttrs.src = url;
      if (newAttrs.url) newAttrs.url = url;
      if (node.type.name === "drawio" || node.type.name === "excalidraw") {
        newAttrs.title = result.fileName;
      }
      if (node.type.name === "attachment") {
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
  uploadTarget: UploadTarget,
) => {
  if (!moved && event.dataTransfer?.files.length) {
    event.preventDefault();

    for (const file of event.dataTransfer.files) {
      const coordinates = editor.view.posAtCoords({
        left: event.clientX,
        top: event.clientY,
      });

      uploadImageAction(file, editor, coordinates?.pos ?? 0 - 1, uploadTarget);
      uploadVideoAction(file, editor, coordinates?.pos ?? 0 - 1, uploadTarget);
      uploadPdfAction(file, editor, coordinates?.pos ?? 0 - 1, uploadTarget);
      uploadAttachmentAction(file, editor, coordinates?.pos ?? 0 - 1, uploadTarget);
    }
    return true;
  }
  return false;
};
