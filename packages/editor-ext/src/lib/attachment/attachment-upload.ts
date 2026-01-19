import { Node } from "@tiptap/pm/model";
import { MediaUploadOptions, UploadFn } from "../media-utils";
import { IAttachment } from "../types";
import { generateNodeId } from "../utils";
import { Transaction } from "@tiptap/pm/state";

const findAttachmentNodeByPlaceholderId = (
  doc: Node,
  placeholderId: string,
): { node: Node; pos: number } | null => {
  let result: { node: Node; pos: number } | null = null;

  doc.descendants((node, pos) => {
    if (result) return false;
    if (
      node.type.name === "attachment" &&
      node.attrs.placeholderId === placeholderId
    ) {
      result = { node, pos };
      return false;
    }
    return true;
  });

  return result;
};
const handleAttachmentUpload =
  ({ validateFn, onUpload }: MediaUploadOptions): UploadFn =>
  async (file, view, pos, pageId, allowMedia) => {
    const validated = validateFn?.(file, allowMedia);
    // @ts-ignore
    if (!validated) return;

    const placeholderId = generateNodeId();
    const initialPlaceholderNode = view.state.schema.nodes.attachment?.create({
      placeholderId,
      name: file.name,
      size: file.size,
    });

    let tr: Transaction | null = view.state.tr;
    let placeholderShown = false;

    if (!initialPlaceholderNode) return;

    const { parent } = tr.doc.resolve(pos);
    const isEmptyTextBlock = parent.isTextblock && !parent.childCount;

    if (isEmptyTextBlock) {
      tr.replaceRangeWith(pos - 1, pos + 1, initialPlaceholderNode);
    } else {
      tr.insert(pos, initialPlaceholderNode);
    }

    // Only show the placeholder if the upload takes more than 250ms
    const displayPlaceholderTimeout = setTimeout(() => {
      view.dispatch(tr);
      placeholderShown = true;
      tr = null;
    }, 250);

    try {
      const attachment: IAttachment = await onUpload(file, pageId);

      tr = tr ?? view.state.tr;

      const { pos: currentPos = null } =
        findAttachmentNodeByPlaceholderId(tr.doc, placeholderId) || {};

      //  If the placeholder is not found or attachment is missing, abort the process
      if (currentPos === null || !attachment) return;

      // Update the placeholder node with the actual attachment data
      tr.setNodeMarkup(currentPos, undefined, {
        url: `/api/files/${attachment.id}/${attachment.fileName}`,
        name: attachment.fileName,
        mime: attachment.mimeType,
        size: attachment.fileSize,
        attachmentId: attachment.id,
      });
    } catch (error) {
      tr = tr ?? view.state.tr;

      const { pos: currentPos = null } =
        findAttachmentNodeByPlaceholderId(tr.doc, placeholderId) || {};

      if (currentPos === null) return;

      // Delete the placeholder on error
      tr.delete(
        currentPos,
        currentPos + (initialPlaceholderNode.nodeSize ?? 1),
      );
    } finally {
      clearTimeout(displayPlaceholderTimeout);

      // If the placeholder was shown, delay showing the attachment to avoid flicker
      if (placeholderShown) {
        setTimeout(() => {
          view.dispatch(tr);
        }, 100);
      } else {
        view.dispatch(tr);
      }
    }
  };

export { handleAttachmentUpload };
