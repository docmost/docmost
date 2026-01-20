import { imageDimensionsFromStream } from "image-dimensions";
import { MediaUploadOptions, UploadFn } from "../media-utils";
import { IAttachment } from "../types";
import { generateNodeId } from "../utils";
import { Node } from "@tiptap/pm/model";
import { Command } from "@tiptap/core";

const findImageNodeByPlaceholderId = (
  doc: Node,
  placeholderId: string,
): { node: Node; pos: number } | null => {
  let result: { node: Node; pos: number } | null = null;

  doc.descendants((node, pos) => {
    if (result) return false;
    if (
      node.type.name === "image" &&
      node.attrs.placeholder?.id === placeholderId
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
  async (file, editor, pos, pageId) => {
    // check if the file is an image
    const validated = validateFn?.(file);
    // @ts-ignore
    if (!validated) return;

    const objectUrl = URL.createObjectURL(file);
    const imageDimensions = await imageDimensionsFromStream(file.stream());
    const placeholderId = generateNodeId();
    const aspectRatio = imageDimensions
      ? imageDimensions.width / imageDimensions.height
      : undefined;

    let placeholderInserted = false;

    editor.storage.shared.imagePreviews =
      editor.storage.shared.imagePreviews || {};
    editor.storage.shared.imagePreviews[placeholderId] = objectUrl;

    const insertPlaceholder = (): Command => {
      return ({ tr, state }) => {
        const initialPlaceholderNode = state.schema.nodes.image?.create({
          placeholder: {
            id: placeholderId,
            name: file.name,
          },
          aspectRatio,
        });

        if (!initialPlaceholderNode) return false;

        const { parent } = tr.doc.resolve(pos);
        const isEmptyTextBlock = parent.isTextblock && !parent.childCount;

        if (isEmptyTextBlock) {
          // Replace e.g. empty paragraph with the image
          tr.replaceRangeWith(pos - 1, pos + 1, initialPlaceholderNode);
        } else {
          tr.insert(pos, initialPlaceholderNode);
        }

        return true;
      };
    };
    const replacePlaceholderWithImage = (attachment: IAttachment): Command => {
      return ({ tr }) => {
        const { pos: currentPos = null } =
          findImageNodeByPlaceholderId(tr.doc, placeholderId) || {};

        //  If the placeholder is not found or attachment is missing, abort the process
        if (currentPos === null || !attachment) return false;

        // Update the placeholder node with the actual image data
        tr.setNodeMarkup(currentPos, undefined, {
          src: `/api/files/${attachment.id}/${attachment.fileName}`,
          attachmentId: attachment.id,
          size: attachment.fileSize,
          aspectRatio,
        });

        return true;
      };
    };
    const removePlaceholder = (): Command => {
      return ({ tr }) => {
        const { pos: currentPos = null } =
          findImageNodeByPlaceholderId(tr.doc, placeholderId) || {};

        if (currentPos === null) return false;

        // Remove the placeholder node
        tr.delete(currentPos, currentPos + 2);

        return true;
      };
    };
    // Only show the placeholder if the upload takes more than 250ms
    const insertPlaceholderTimeout = setTimeout(() => {
      editor.commands.command(insertPlaceholder());
      placeholderInserted = true;
    }, 250);
    const disposePreviewFile = () => {
      URL.revokeObjectURL(objectUrl);

      if (editor.storage.shared.imagePreviews) {
        delete editor.storage.shared.imagePreviews[placeholderId];
      }
    };

    try {
      const attachment: IAttachment = await onUpload(file, pageId);

      clearTimeout(insertPlaceholderTimeout);

      if (placeholderInserted) {
        setTimeout(() => {
          editor.commands.command(replacePlaceholderWithImage(attachment));
          disposePreviewFile();
        }, 100);
      } else {
        editor
          .chain()
          .command(insertPlaceholder())
          .command(replacePlaceholderWithImage(attachment))
          .run();
        disposePreviewFile();
      }
    } catch (error) {
      clearTimeout(insertPlaceholderTimeout);

      editor.commands.command(removePlaceholder());
      disposePreviewFile();
    }
  };

export { handleImageUpload };
