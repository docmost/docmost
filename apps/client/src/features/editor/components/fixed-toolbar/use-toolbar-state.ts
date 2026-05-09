import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";

export interface ToolbarState {
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrike: boolean;
  isCode: boolean;
  isSubscript: boolean;
  isSuperscript: boolean;
  isBulletList: boolean;
  isOrderedList: boolean;
  isTaskList: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

// Undo/redo come from either StarterKit's history or the Yjs collaboration
// history extension. During the brief moment a page is rendered with the
// static editor (mainExtensions only, undoRedo disabled), neither is loaded
// and editor.can().undo/redo is undefined.
function safeCan(editor: Editor, command: "undo" | "redo"): boolean {
  const can = editor.can() as Record<string, unknown>;
  const fn = can[command];
  return typeof fn === "function" ? (fn as () => boolean)() : false;
}

export function useToolbarState(editor: Editor | null): ToolbarState | null {
  return useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) return null;
      return {
        isBold: ctx.editor.isActive("bold"),
        isItalic: ctx.editor.isActive("italic"),
        isUnderline: ctx.editor.isActive("underline"),
        isStrike: ctx.editor.isActive("strike"),
        isCode: ctx.editor.isActive("code"),
        isSubscript: ctx.editor.isActive("subscript"),
        isSuperscript: ctx.editor.isActive("superscript"),
        isBulletList: ctx.editor.isActive("bulletList"),
        isOrderedList: ctx.editor.isActive("orderedList"),
        isTaskList: ctx.editor.isActive("taskList"),
        canUndo: safeCan(ctx.editor, "undo"),
        canRedo: safeCan(ctx.editor, "redo"),
      };
    },
  });
}
