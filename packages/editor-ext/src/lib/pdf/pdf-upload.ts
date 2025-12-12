import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const PDF_UPLOAD_KEY = new PluginKey("pdf-upload");

export interface PdfUploadOptions {
  placeholderClass: string;
}

export const PdfUploadPlugin = ({ placeholderClass }: PdfUploadOptions) =>
  new Plugin({
    key: PDF_UPLOAD_KEY,
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr, set) {
        set = set.map(tr.mapping, tr.doc);
        const action = tr.getMeta(this);
        if (action?.add) {
          const { id, pos, src } = action.add;
          const placeholder = document.createElement("div");
          placeholder.setAttribute("class", "pdf-placeholder");
          
          const embed = document.createElement("embed");
          embed.setAttribute("class", placeholderClass);
          embed.src = src;
          embed.type = "application/pdf";
          embed.style.width = "100%";
          embed.style.height = "400px";

          const span = document.createElement("span");
          span.textContent = "Uploading PDF...";
          
          placeholder.appendChild(embed);
          placeholder.appendChild(span);

          const deco = Decoration.widget(pos + 1, placeholder, { id });
          set = set.add(tr.doc, [deco]);
        } else if (action?.remove) {
          set = set.remove(
            set.find(undefined, undefined, (spec) => spec.id == action.remove.id)
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

function findPlaceholder(state: any, id: any) {
  const decos = PDF_UPLOAD_KEY.getState(state);
  const found = decos.find(undefined, undefined, (spec: any) => spec.id == id);
  return found.length ? found[0].from : null;
}

export const handlePdfUpload =
  ({ validateFn, onUpload }: { validateFn: (file: File) => boolean; onUpload: (file: File, pageId: string) => Promise<any> }) =>
  async (file: File, view: any, pos: number, pageId: string) => {
    if (!validateFn?.(file)) return;

    const id = {};
    const reader = new FileReader();

    reader.readAsDataURL(file);
    reader.onload = () => {
      const transaction = view.state.tr;
      if (!transaction.selection.empty) {
        transaction.deleteSelection();
      }
      transaction.setMeta(PDF_UPLOAD_KEY, {
        add: {
          id,
          pos,
          src: reader.result,
        },
      });
      view.dispatch(transaction);
    };

    reader.onerror = (error) => {
      console.error("Error reading PDF file:", error);
      const transaction = view.state.tr
        .delete(pos, pos)
        .setMeta(PDF_UPLOAD_KEY, { remove: { id } });
      view.dispatch(transaction);
    };

    await onUpload(file, pageId)
      .then((result) => {
        const { schema } = view.state;
        const pos = findPlaceholder(view.state, id);
        if (pos == null || !result) return;

        const node = schema.nodes.pdf?.create({
          src: `/api/files/${result.id}/${result.fileName}`,
          attachmentId: result.id,
          title: result.fileName,
          size: result.fileSize,
        });

        if (!node) return;

        const transaction = view.state.tr
          .replaceWith(pos, pos, node)
          .setMeta(PDF_UPLOAD_KEY, { remove: { id } });
        view.dispatch(transaction);
      })
      .catch(() => {
        const transaction = view.state.tr
          .delete(pos, pos)
          .setMeta(PDF_UPLOAD_KEY, { remove: { id } });
        view.dispatch(transaction);
      });
  };