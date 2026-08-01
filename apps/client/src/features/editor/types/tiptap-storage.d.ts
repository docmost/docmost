import "@tiptap/core";

/**
 * Fields this app hangs off `editor.storage` to reach the active editor from
 * code that has no React context — the page id every editor is bound to, and
 * the encrypted editor's save handle used by a history restore.
 */
declare module "@tiptap/core" {
  interface Storage {
    pageId?: string;
    /** encrypted pages only: flush the Y.Doc and ask for a history snapshot */
    persistEncrypted?: () => Promise<void>;
  }
}
