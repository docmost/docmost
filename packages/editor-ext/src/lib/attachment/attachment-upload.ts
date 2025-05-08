import { type EditorState, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  insertTrailingNode,
  MediaUploadOptions,
  UploadFn,
} from "../media-utils";
import { IAttachment } from "../types";

const uploadKey = new PluginKey("attachment-upload");

export const AttachmentUploadPlugin = ({
  placeholderClass,
}: {
  placeholderClass: string;
}) =>
  new Plugin({
    key: uploadKey,
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr, set) {
        set = set.map(tr.mapping, tr.doc);
        // See if the transaction adds or removes any placeholders
        //@-ts-expect-error - not yet sure what the type I need here
        const action = tr.getMeta(this);
        if (action?.add) {
          const { id, pos, fileName } = action.add;

          const placeholder = document.createElement("div");
          placeholder.setAttribute("class", placeholderClass);

          const uploadingText = document.createElement("span");
          uploadingText.setAttribute("class", "uploading-text");
          uploadingText.textContent = `Uploading ${fileName}`;

          placeholder.appendChild(uploadingText);

          const realPos = pos + 1;
          const deco = Decoration.widget(realPos, placeholder, {
            id,
          });
          set = set.add(tr.doc, [deco]);
        } else if (action?.remove) {
          set = set.remove(
            set.find(
              undefined,
              undefined,
              (spec) => spec.id == action.remove.id,
            ),
          );
        }
        return set;
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });

function findPlaceholder(state: EditorState, id: {}) {
  const decos = uploadKey.getState(state) as DecorationSet;
  const found = decos.find(undefined, undefined, (spec) => spec.id == id);
  return found.length ? found[0]?.from : null;
}

export const handleAttachmentUpload =
  ({ validateFn, onUpload }: MediaUploadOptions): UploadFn =>
  async (file, view, pos, pageId, allowMedia) => {
    const validated = validateFn?.(file, allowMedia);
    // @ts-ignore
    if (!validated) return;
    // A fresh object to act as the ID for this upload
    const id = {};

    // Replace the selection with a placeholder
    const tr = view.state.tr;
    if (!tr.selection.empty) tr.deleteSelection();

    tr.setMeta(uploadKey, {
      add: {
        id,
        pos,
        fileName: file.name,
      },
    });

    insertTrailingNode(tr, pos, view);
    view.dispatch(tr);

    await onUpload(file, pageId).then(
      (attachment: IAttachment) => {
        const { schema } = view.state;

        const pos = findPlaceholder(view.state, id);

        if (pos == null) return;

        if (!attachment) return;

        const node = schema.nodes.attachment?.create({
          url: `/api/files/${attachment.id}/${attachment.fileName}`,
          name: attachment.fileName,
          mime: attachment.mimeType,
          size: attachment.fileSize,
          attachmentId: attachment.id,
        });
        if (!node) return;

        const transaction = view.state.tr
          .replaceWith(pos, pos, node)
          .setMeta(uploadKey, { remove: { id } });
        view.dispatch(transaction);
      },
      () => {
        // Deletes the placeholder on error
        const transaction = view.state.tr
          .delete(pos, pos)
          .setMeta(uploadKey, { remove: { id } });
        view.dispatch(transaction);
      },
    );
  };
