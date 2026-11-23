import type { Editor } from "@tiptap/react";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { scrollToPageAnchor } from "@/features/editor/utils/scroll-to-page-anchor";

export function useEditorScroll(editor: Editor | null, visible = true) {
  const { hash } = useLocation();

  useEffect(() => {
    if (!editor || !visible || hash.length < 2) return;
    const fragment = hash.slice(1);
    let timer: ReturnType<typeof setTimeout>;

    // A collaborative page can receive its content after the editor mounts.
    function scrollToAnchor(attempt: number) {
      if (editor.isDestroyed) return;
      if (!scrollToPageAnchor(editor.view.dom, fragment) && attempt < 50) {
        timer = setTimeout(() => scrollToAnchor(attempt + 1), 200);
      }
    }

    scrollToAnchor(0);
    return () => clearTimeout(timer);
  }, [editor, visible, hash]);
}
