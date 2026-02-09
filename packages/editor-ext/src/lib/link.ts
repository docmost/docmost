import { mergeAttributes } from "@tiptap/core";
import TiptapLink from "@tiptap/extension-link";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { EditorView } from "@tiptap/pm/view";

export const LinkExtension = TiptapLink.extend({
  inclusive: false,

  parseHTML() {
    return [
      {
        tag: 'a[href]:not([data-type="button"]):not([href *= "javascript:" i])',
        getAttrs: (element) => {
          if (
            element
              .getAttribute("href")
              ?.toLowerCase()
              .startsWith("javascript:")
          ) {
            return false;
          }

          return null;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    if (HTMLAttributes.href?.toLowerCase().startsWith("javascript:")) {
      return [
        "a",
        mergeAttributes(
          this.options.HTMLAttributes,
          { ...HTMLAttributes, href: "" },
          { class: "link" },
        ),
        0,
      ];
    }

    return [
      "a",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "link",
      }),
      0,
    ];
  },

  addProseMirrorPlugins() {
    const { editor } = this;

    return [
      ...(this.parent?.() || []),
      new Plugin({
        props: {
          handleKeyDown: (view: EditorView, event: KeyboardEvent) => {
            const { selection } = editor.state;

            if (event.key === "Escape" && selection.empty !== true) {
              editor.commands.focus(selection.to, { scrollIntoView: false });
            }

            return false;
          },
        },
      }),
      // Fix for Firefox: when the cursor is at the right boundary of a link,
      // Firefox's contenteditable inserts new text *inside* the <a> element.
      // ProseMirror then rejects the mutation because inclusive is false,
      // causing keystrokes to be silently swallowed. Firefox also does not
      // fire handleTextInput in this state, so we intercept at handleKeyDown.
      new Plugin({
        key: new PluginKey("linkBoundaryInput"),
        props: {
          handleKeyDown: (view: EditorView, event: KeyboardEvent) => {
            // Only handle single printable characters
            if (event.key.length !== 1) return false;
            // Don't handle modified keys (shortcuts) or composing (IME)
            if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return false;

            const { state } = view;
            const linkType = state.schema.marks.link;
            if (!linkType) return false;

            // Don't interfere if the user has explicitly set storedMarks
            if (state.storedMarks !== null) return false;

            const { from, to } = state.selection;
            const $from = state.doc.resolve(from);
            const nodeBefore = $from.nodeBefore;
            const nodeAfter = $from.nodeAfter;

            if (!nodeBefore) return false;

            // Check if text before cursor has a link mark
            if (!linkType.isInSet(nodeBefore.marks)) return false;

            // If text after cursor also has the same link mark,
            // we're in the middle of a link — don't interfere
            if (nodeAfter && linkType.isInSet(nodeAfter.marks)) return false;

            // We're at the right boundary of a link mark.
            // Prevent native input and insert text without the link mark.
            event.preventDefault();
            const tr = state.tr.insertText(event.key, from, to);
            tr.removeMark(from, from + event.key.length, linkType);
            view.dispatch(tr.scrollIntoView());
            return true;
          },
        },
      }),
    ];
  },
});
