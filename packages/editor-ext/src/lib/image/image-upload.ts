import { imageDimensionsFromData } from "image-dimensions";
import { MediaUploadOptions, UploadFn } from "../media-utils";
import { IAttachment } from "../types";
import { generateNodeId } from "../utils";
import { Node } from "@tiptap/pm/model";

const findImageNodeByPlaceholderId = (
  doc: Node,
  placeholderId: string,
): { node: Node; pos: number } | null => {
  let result: { node: Node; pos: number } | null = null;

  doc.descendants((node, pos) => {
    if (result) return false;
    if (
      node.type.name === "image" &&
      node.attrs.placeholderId === placeholderId
    ) {
      result = { node, pos };
      return false;
    }
    return true;
  });

  return result;
};
const handleImageUpload =
  ({ validateFn, onUpload }: MediaUploadOptions): UploadFn =>
  async (file, view, pos, pageId) => {
    // check if the file is an image
    const validated = validateFn?.(file);
    // @ts-ignore
    if (!validated) return;

    const imageDimensions = imageDimensionsFromData(await file.bytes());
    const placeholderId = generateNodeId();
    const aspectRatio = imageDimensions
      ? imageDimensions.width / imageDimensions.height
      : undefined;
    const initialPlaceholderNode = view.state.schema.nodes.image?.create({
      placeholderId,
      aspectRatio,
    });

    let placeholderShown = false;
    let tr = view.state.tr;

    if (!initialPlaceholderNode) return;

    const { parent } = tr.doc.resolve(pos);
    const isEmptyTextBlock = parent.isTextblock && !parent.childCount;

    if (isEmptyTextBlock) {
      // Replace e.g. empty paragraph with the image
      tr.replaceRangeWith(pos - 1, pos + 1, initialPlaceholderNode);
    } else {
      tr.insert(pos, initialPlaceholderNode);
    }

    // Only show the placeholder if the upload takes more than 250ms
    const displayPlaceholderTimeout = setTimeout(() => {
      view.dispatch(tr);
      placeholderShown = true;
      tr = view.state.tr;
    }, 250);

    try {
      const attachment: IAttachment = await onUpload(file, pageId);
      const { pos: currentPos = null } =
        findImageNodeByPlaceholderId(tr.doc, placeholderId) || {};

      //  If the placeholder is not found or attachment is missing, abort the process
      if (currentPos === null || !attachment) return;

      // Update the placeholder node with the actual image data
      tr.setNodeMarkup(currentPos, undefined, {
        src: `/api/files/${attachment.id}/${attachment.fileName}`,
        attachmentId: attachment.id,
        title: attachment.fileName,
        size: attachment.fileSize,
        aspectRatio,
      });
    } catch (error) {
      const { pos: currentPos = null } =
        findImageNodeByPlaceholderId(tr.doc, placeholderId) || {};

      if (currentPos === null) return;

      // Delete the image placeholder on error
      tr.delete(currentPos, currentPos + 2);
    } finally {
      clearTimeout(displayPlaceholderTimeout);

      // If the placeholder was shown, delay showing the image to avoid flicker
      if (placeholderShown) {
        setTimeout(() => {
          view.dispatch(tr);
        }, 100);
      } else {
        view.dispatch(tr);
      }
    }
  };

export { handleImageUpload };
