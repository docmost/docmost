import { Editor } from "@tiptap/react";

/**
 * pageEditorAtom is a single global slot that is not cleared on navigation, so
 * it can still hold the editor of a previously open page. Encryption reads the
 * live editor to capture unsaved edits — trusting the wrong one would encrypt
 * another page's content under this page's key. The editor stamps its own
 * pageId into storage on create, so check it before using the instance.
 */
export function editorForPage(
  editor: Editor | null,
  pageId: string,
): Editor | null {
  if (!editor || editor.isDestroyed) return null;
  // @ts-ignore — storage.pageId is stamped by the page editors on create
  return editor.storage?.pageId === pageId ? editor : null;
}
