import type { EditorView } from "@tiptap/pm/view";
import { Transaction } from "@tiptap/pm/state";

export type UploadFn = (
  file: File,
  view: EditorView,
  pos: number,
  pageId: string,
  // only applicable to file attachments
  allowMedia?: boolean,
) => void;

export interface MediaUploadOptions {
  validateFn?: (file: File, allowMedia?: boolean) => void;
  onUpload: (file: File, pageId: string) => Promise<any>;
}

export function insertTrailingNode(
  tr: Transaction,
  pos: number,
  view: EditorView,
) {
  // create trailing node after decoration
  // if decoration is at the last node
  const currentDocSize = view.state.doc.content.size;
  if (pos + 1 === currentDocSize) {
    tr.insert(currentDocSize, view.state.schema.nodes.paragraph.create());
  }
}
