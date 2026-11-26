import { isHttpUrl } from "@docmost/editor-ext";
import { useQuery } from "@tanstack/react-query";
import type { NodeViewProps } from "@tiptap/react";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { getLinkPreview } from "@/features/link-preview/services/link-preview-service";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import {
  clearLinkPreviewPending,
  isLinkPreviewPending,
} from "./link-preview-pending";

export const LINK_PREVIEW_STALE_TIME = 60 * 60 * 1000; // mirrors the server's success cache

export function linkPreviewQueryKey(url: string) {
  return ["link-preview", url];
}

export function useLinkPreviewFill({
  editor,
  node,
  getPos,
}: NodeViewProps): { isLoading: boolean } {
  const currentUser = useAtomValue(currentUserAtom);
  const url: string = node.attrs.url;
  // Read once at mount: only the node the conversion made fills, never an older card with the same URL.
  const [pendingUrl] = useState(() =>
    isLinkPreviewPending(editor, url) ? url : null,
  );
  const shouldFill =
    url === pendingUrl &&
    editor.isEditable &&
    Boolean(currentUser?.user) &&
    isHttpUrl(url) &&
    !node.attrs.title;

  const { data, isPending } = useQuery({
    queryKey: linkPreviewQueryKey(url),
    queryFn: async () => {
      const preview = await getLinkPreview({ url });
      // A failure must leave no cached data, so the next conversion asks the server again.
      if (!preview) throw new Error("No link preview");
      return preview;
    },
    enabled: shouldFill,
    staleTime: LINK_PREVIEW_STALE_TIME,
    retry: false,
    refetchOnReconnect: false,
  });
  const settled = shouldFill && !isPending;

  useEffect(() => {
    if (!settled || editor.isDestroyed) return;
    clearLinkPreviewPending(editor, url);
    if (!data) return;

    const pos = getPos();
    const current =
      typeof pos === "number" ? editor.state.doc.nodeAt(pos) : null;
    if (
      current?.type !== node.type ||
      current.attrs.url !== url ||
      current.attrs.title
    ) {
      return;
    }

    // Attribute steps keep a selected mention selected; setNodeMarkup replaces the node.
    const tr = editor.state.tr;
    for (const [key, value] of Object.entries(data)) {
      if (current.attrs[key] !== value) tr.setNodeAttribute(pos, key, value);
    }
    // Kept out of the undo history, so undo after converting returns to the link.
    editor.view.dispatch(tr.setMeta("addToHistory", false));
  }, [settled, data, editor, getPos, node.type, url]);

  return { isLoading: shouldFill && isPending };
}
