import { useLayoutEffect, useReducer } from "react";
import { Editor } from "@tiptap/react";

// Unmount cleanups of EditorContent and the bubble menus each reconfigure the
// editor and redraw the whole document; destroying first turns them into no-ops.
export function useDestroyEditorBeforeChildren(editor: Editor | null) {
  const [, rerender] = useReducer((count: number) => count + 1, 0);

  useLayoutEffect(() => {
    if (!editor) return;
    // React also runs the cleanup when a Suspense fallback hides the subtree;
    // once revealed, a render lets useEditor replace the destroyed editor.
    if (editor.isDestroyed) {
      rerender();
      return;
    }
    return () => editor.destroy();
  }, [editor]);
}
