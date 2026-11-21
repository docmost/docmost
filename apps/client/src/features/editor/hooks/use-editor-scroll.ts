import type { Editor } from "@tiptap/react";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { showTabAtElement } from "@/features/editor/utils/show-tab-at-element";

export function useEditorScroll(editor: Editor | null, visible = true) {
  const { hash } = useLocation();

  useEffect(() => {
    if (!editor || !visible || hash.length < 2) return;
    const id = CSS.escape(hash.slice(1));
    let timer: ReturnType<typeof setTimeout>;

    // A collaborative page can receive its content after the editor mounts.
    function scrollToAnchor(attempt: number) {
      if (editor.isDestroyed) return;
      const target = editor.view.dom.querySelector(`[id="${id}"], [data-id="${id}"]`);
      if (target?.isConnected) {
        showTabAtElement(target);
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (attempt < 50) {
        timer = setTimeout(() => scrollToAnchor(attempt + 1), 200);
      }
    }

    scrollToAnchor(0);
    return () => clearTimeout(timer);
  }, [editor, visible, hash]);
}
