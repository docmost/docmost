import { useEffect, useRef } from "react";
import type { useEditor } from "@tiptap/react";

interface UseSearchNavigationParamsProps {
  editor: ReturnType<typeof useEditor>;
  isSynced: boolean;
  pageId: string;
  searchParams: URLSearchParams;
  showStatic: boolean;
}

export function useSearchNavigationParams({
  editor,
  isSynced,
  pageId,
  searchParams,
  showStatic,
}: UseSearchNavigationParamsProps) {
  const appliedSearchKeyRef = useRef<string | null>(null);
  const searchKey = `${pageId}:${searchParams.toString()}`;

  useEffect(() => {
    const searchQueries = searchParams.getAll("q");
    if (!searchQueries.length) {
      appliedSearchKeyRef.current = null;
      return;
    }

    if (
      !editor ||
      editor.isDestroyed ||
      !editor.view.dom.isConnected ||
      appliedSearchKeyRef.current === searchKey
    ) {
      return;
    }

    const match = searchParams.get("m");
    appliedSearchKeyRef.current = searchKey;

    document.dispatchEvent(
      new CustomEvent("openSearchNavigationDialog", {
        detail: { searchTerms: searchQueries, wholeWord: match === "whole" },
      }),
    );
  }, [editor, isSynced, searchKey, searchParams, showStatic]);
}
