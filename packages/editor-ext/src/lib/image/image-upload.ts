import { type EditorState, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { insertTrailingNode, MediaUploadOptions, UploadFn } from "../media-utils";
import { IAttachment } from "../types";

const uploadKey = new PluginKey("image-upload");

export const ImageUploadPlugin = ({
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
          const { id, pos, src } = action.add;

          const placeholder = document.createElement("div");
          placeholder.setAttribute("class", "img-placeholder");
          const image = document.createElement("img");
          image.setAttribute("class", placeholderClass);
          image.src = src;
          placeholder.appendChild(image);
          const deco = Decoration.widget(pos + 1, placeholder, {
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

export const handleImageUpload =
  ({ validateFn, onUpload }: MediaUploadOptions): UploadFn =>
  async (file, view, pos, pageId) => {
    // check if the file is an image
    const validated = validateFn?.(file);
    // @ts-ignore
    if (!validated) return;
    // A fresh object to act as the ID for this upload
    const id = {};

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const tr = view.state.tr;
      // Replace the selection with a placeholder
      if (!tr.selection.empty) tr.deleteSelection();

      tr.setMeta(uploadKey, {
        add: {
          id,
          pos,
          src: reader.result,
        },
      });

      insertTrailingNode(tr, pos, view);
      view.dispatch(tr);
    };

    await onUpload(file, pageId).then(
      (attachment: IAttachment) => {
        const { schema } = view.state;

        const pos = findPlaceholder(view.state, id);

        // If the content around the placeholder has been deleted, drop
        // the image
        if (pos == null) return;

        // Otherwise, insert it at the placeholder's position, and remove
        // the placeholder

        if (!attachment) return;

        const node = schema.nodes.image?.create({
          src: `/api/files/${attachment.id}/${attachment.fileName}`,
          attachmentId: attachment.id,
          title: attachment.fileName,
          size: attachment.fileSize,
        });
        if (!node) return;

        const transaction = view.state.tr
          .replaceWith(pos, pos, node)
          .setMeta(uploadKey, { remove: { id } });
        view.dispatch(transaction);
      },
      () => {
        // Deletes the image placeholder on error
        const transaction = view.state.tr
          .delete(pos, pos)
          .setMeta(uploadKey, { remove: { id } });
        view.dispatch(transaction);
      },
    );
  };
