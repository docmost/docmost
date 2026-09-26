import { markInputRule } from "@tiptap/core";
import { Code } from "@tiptap/extension-code";

// Override TipTap's Code extension to fix the inline code input rule.
// The upstream regex /(^|[^`])`([^`]+)`(?!`)$/ captures the character
// before the opening backtick as part of the match, causing markInputRule
// to delete it. Using a lookbehind avoids including it in the match.
export const TiptapCode = Code.configure({
  HTMLAttributes: {
    spellcheck: false,
  },
}).extend({
  addInputRules() {
    return [
      markInputRule({
        find: /(?:^|(?<=[^`]))`([^`]+)`(?!`)$/,
        type: this.type,
      }),
    ];
  },
  addKeyboardShortcuts() {
    return {
      // Keep the upstream shortcuts (Mod-e toggles inline code).
      ...this.parent?.(),
      Enter: ({ editor }) => {
        const { from, to } = editor.state.selection;
        if (from !== to) return false;
        if (!editor.isActive("code")) return false;

        const $from = editor.state.doc.resolve(from);
        const codeType = editor.state.schema.marks.code;
        const nodeAfter = $from.nodeAfter;

        if (nodeAfter && codeType.isInSet(nodeAfter.marks)) {
          return false;
        }

        return editor.chain().unsetCode().splitBlock().run();
      },
    };
  },
});
