import { MediaUploadOptions, UploadFn } from "../media-utils";
import { IAttachment } from "../types";
import { generateNodeId } from "../utils";
import { Node } from "@tiptap/pm/model";

const findVideoNodeByPlaceholderId = (
  doc: Node,
  placeholderId: string,
): { node: Node; pos: number } | null => {
  let result: { node: Node; pos: number } | null = null;

  doc.descendants((node, pos) => {
    if (result) return false;

    if (
      node.type.name === "video" &&
      node.attrs.placeholderId === placeholderId
    ) {
      result = { node, pos };
      return false;
    }

    return true;
  });

  return result;
};
const getVideoDimensions = (
  url: string,
): Promise<
  { width: number; height: number; aspectRatio: number } | undefined
> => {
  return new Promise<
    { width: number; height: number; aspectRatio: number } | undefined
  >((resolve) => {
    const video = document.createElement("video");

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const aspectRatio = height > 0 ? width / height : 1;

      resolve({ width, height, aspectRatio });
    };
    video.onerror = () => {
      resolve(undefined);
    };
    video.src = url;
  });
};
const handleVideoUpload =
  ({ validateFn, onUpload }: MediaUploadOptions): UploadFn =>
  async (file, view, pos, pageId) => {
    // check if the file is valid
    const validated = validateFn?.(file);
    // @ts-ignore
    if (!validated) return;

    const objectUrl = URL.createObjectURL(file);
    const videoDimensions = await getVideoDimensions(objectUrl);
    const placeholderId = generateNodeId();
    const aspectRatio = videoDimensions.aspectRatio;
    const initialPlaceholderNode = view.state.schema.nodes.video?.create({
      placeholderId,
      aspectRatio,
    });

    let placeholderShown = false;
    let tr = view.state.tr;

    if (!initialPlaceholderNode) {
      URL.revokeObjectURL(objectUrl);
      return;
    }

    const { parent } = tr.doc.resolve(pos);
    const isEmptyTextBlock = parent.isTextblock && !parent.childCount;

    if (isEmptyTextBlock) {
      // Replace e.g. empty paragraph with the video
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
        findVideoNodeByPlaceholderId(tr.doc, placeholderId) || {};

      //  If the placeholder is not found or attachment is missing, abort the process
      if (currentPos === null || !attachment) return;

      // Update the placeholder node with the actual video data
      tr.setNodeMarkup(currentPos, undefined, {
        src: `/api/files/${attachment.id}/${attachment.fileName}`,
        attachmentId: attachment.id,
        title: attachment.fileName,
        size: attachment.fileSize,
        aspectRatio,
      });
    } catch (error) {
      const { pos: currentPos = null } =
        findVideoNodeByPlaceholderId(tr.doc, placeholderId) || {};

      if (currentPos === null) return;

      // Delete the video placeholder on error
      tr.delete(
        currentPos,
        currentPos + (initialPlaceholderNode.nodeSize ?? 2),
      );
    } finally {
      clearTimeout(displayPlaceholderTimeout);

      const dispatchFinal = () => {
        view.dispatch(tr);
        URL.revokeObjectURL(objectUrl);
      };

      // If the placeholder was shown, delay showing the video to avoid flicker
      if (placeholderShown) {
        setTimeout(() => {
          dispatchFinal();
        }, 100);
      } else {
        dispatchFinal();
      }
    }
  };

export { handleVideoUpload };
