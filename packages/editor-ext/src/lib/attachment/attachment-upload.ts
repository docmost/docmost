import { Node } from "@tiptap/pm/model";
import { MediaUploadOptions, UploadFn } from "../media-utils";
import { IAttachment } from "../types";
import { generateNodeId } from "../utils";
import { Command } from "@tiptap/core";

const findAttachmentNodeByPlaceholderId = (
  doc: Node,
  placeholderId: string,
): { node: Node; pos: number } | null => {
  let result: { node: Node; pos: number } | null = null;

  doc.descendants((node, pos) => {
    if (result) return false;
    if (
      node.type.name === "attachment" &&
      node.attrs.placeholder?.id === placeholderId
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
  async (file, editor, pos, pageId, allowMedia) => {
    const validated = validateFn?.(file, allowMedia);
    // @ts-ignore
    if (!validated) return;

    const placeholderId = generateNodeId();

    let placeholderInserted = false;

    const insertPlaceholder = (): Command => {
      return ({ tr, state }) => {
        const initialPlaceholderNode = state.schema.nodes.attachment?.create({
          placeholder: {
            id: placeholderId,
          },
          name: file.name,
          size: file.size,
        });

        if (!initialPlaceholderNode) return false;

        const { parent } = tr.doc.resolve(pos);
        const isEmptyTextBlock = parent.isTextblock && !parent.childCount;

        if (isEmptyTextBlock) {
          tr.replaceRangeWith(pos - 1, pos + 1, initialPlaceholderNode);
        } else {
          tr.insert(pos, initialPlaceholderNode);
        }

        return true;
      };
    };
    const replacePlaceholderWithAttachment = (
      attachment: IAttachment,
    ): Command => {
      return ({ tr }) => {
        const { pos: currentPos = null } =
          findAttachmentNodeByPlaceholderId(tr.doc, placeholderId) || {};

        //  If the placeholder is not found or attachment is missing, abort the process
        if (currentPos === null || !attachment) return false;

        // Update the placeholder node with the actual attachment data
        tr.setNodeMarkup(currentPos, undefined, {
          url: `/api/files/${attachment.id}/${attachment.fileName}`,
          name: attachment.fileName,
          mime: attachment.mimeType,
          size: attachment.fileSize,
          attachmentId: attachment.id,
        });

        return true;
      };
    };
    const removePlaceholder = (): Command => {
      return ({ tr }) => {
        const { pos: currentPos = null } =
          findAttachmentNodeByPlaceholderId(tr.doc, placeholderId) || {};

        if (currentPos === null) return false;

        tr.delete(currentPos, currentPos + 2);

        return true;
      };
    };
    // Only show the placeholder if the upload takes more than 250ms
    const insertPlaceholderTimeout = setTimeout(() => {
      editor.commands.command(insertPlaceholder());
      placeholderInserted = true;
    }, 250);

    try {
      const attachment: IAttachment = await onUpload(file, pageId);

      clearTimeout(insertPlaceholderTimeout);

      if (placeholderInserted) {
        setTimeout(() => {
          editor.commands.command(replacePlaceholderWithAttachment(attachment));
        }, 100);
      } else {
        editor
          .chain()
          .command(insertPlaceholder())
          .command(replacePlaceholderWithAttachment(attachment))
          .run();
      }
    } catch (error) {
      clearTimeout(insertPlaceholderTimeout);

      editor.commands.command(removePlaceholder());
    }
  };

export { handleAttachmentUpload };
