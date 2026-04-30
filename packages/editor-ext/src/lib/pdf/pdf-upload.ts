import { MediaUploadOptions, UploadFn } from "../media-utils";
import { IAttachment } from "../types";
import { generateNodeId } from "../utils";
import { Node } from "@tiptap/pm/model";
import { Command } from "@tiptap/core";

const findPdfNodeByPlaceholderId = (
  doc: Node,
  placeholderId: string,
): { node: Node; pos: number } | null => {
  let result: { node: Node; pos: number } | null = null;

  doc.descendants((node, pos) => {
    if (result) return false;

    if (
      node.type.name === "pdf" &&
      node.attrs.placeholder?.id === placeholderId
    ) {
      result = { node, pos };
      return false;
    }

    return true;
  });

  return result;
};

const handlePdfUpload =
  ({ validateFn, onUpload }: MediaUploadOptions): UploadFn =>
  async (file, editor, pos, pageId) => {
    const validated = validateFn?.(file);
    // @ts-ignore
    if (!validated) return;

    const placeholderId = generateNodeId();

    let placeholderInserted = false;

    const insertPlaceholder = (): Command => {
      return ({ tr, state }) => {
        const initialPlaceholderNode = state.schema.nodes.pdf?.create({
          placeholder: {
            id: placeholderId,
            name: file.name,
          },
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

    const replacePlaceholderWithPdf = (attachment: IAttachment): Command => {
      return ({ tr }) => {
        const { pos: currentPos = null } =
          findPdfNodeByPlaceholderId(tr.doc, placeholderId) || {};

        if (currentPos === null || !attachment) return;

        tr.setNodeMarkup(currentPos, undefined, {
          src: `/api/files/${attachment.id}/${attachment.fileName}`,
          name: attachment.fileName,
          attachmentId: attachment.id,
          size: attachment.fileSize,
        });

        return true;
      };
    };

    const removePlaceholder = (): Command => {
      return ({ tr }) => {
        const { pos: currentPos = null } =
          findPdfNodeByPlaceholderId(tr.doc, placeholderId) || {};

        if (currentPos === null) return false;

        tr.delete(currentPos, currentPos + 2);

        return true;
      };
    };

    const insertPlaceholderTimeout = setTimeout(() => {
      editor.commands.command(insertPlaceholder());
      placeholderInserted = true;
    }, 250);

    try {
      const attachment: IAttachment = await onUpload(file, pageId);

      clearTimeout(insertPlaceholderTimeout);

      if (placeholderInserted) {
        setTimeout(() => {
          editor.commands.command(replacePlaceholderWithPdf(attachment));
        }, 100);
      } else {
        editor
          .chain()
          .command(insertPlaceholder())
          .command(replacePlaceholderWithPdf(attachment))
          .run();
      }
    } catch (error) {
      clearTimeout(insertPlaceholderTimeout);
      editor.commands.command(removePlaceholder());
    }
  };

export { handlePdfUpload };
