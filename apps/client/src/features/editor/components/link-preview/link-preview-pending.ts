import type { Editor } from "@tiptap/core";

// A mark left behind when an undo or delete unmounts the view mid-fetch stops counting after this.
export const LINK_PREVIEW_PENDING_TTL_MS = 30_000;

// URLs this client converted and still owes a preview, with when they were marked; no other view may fetch or write one.
const pendingUrls = new WeakMap<Editor, Map<string, number>>();

export function markLinkPreviewPending(editor: Editor, url: string): void {
  const urls = pendingUrls.get(editor) ?? new Map<string, number>();
  urls.set(url, Date.now());
  pendingUrls.set(editor, urls);
}

export function isLinkPreviewPending(editor: Editor, url: string): boolean {
  const markedAt = pendingUrls.get(editor)?.get(url);
  return (
    markedAt !== undefined &&
    Date.now() - markedAt < LINK_PREVIEW_PENDING_TTL_MS
  );
}

export function clearLinkPreviewPending(editor: Editor, url: string): void {
  pendingUrls.get(editor)?.delete(url);
}
