import { isHttpUrl } from "@docmost/editor-ext";
import type { Editor } from "@tiptap/core";
import type { MouseEvent } from "react";

export function formatLinkLocation(url: string): string {
  if (!isHttpUrl(url)) return url;

  const { host, pathname } = new URL(url);
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    // a malformed escape stays encoded
  }
  return `${host}${path}`.replace(/\/+$/, "");
}

export function selectForEditing(
  event: MouseEvent<HTMLElement>,
  editor: Editor,
  getPos: () => number | undefined,
): void {
  if (!editor.isEditable || event.metaKey || event.ctrlKey) return;

  const pos = getPos();
  if (typeof pos !== "number") return;

  event.preventDefault();
  event.stopPropagation();
  editor
    .chain()
    .focus(undefined, { scrollIntoView: false })
    .setNodeSelection(pos)
    .run();
}
