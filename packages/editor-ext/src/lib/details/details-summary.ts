import { Node, defaultBlockAt, mergeAttributes } from "@tiptap/core";
import { Selection } from "@tiptap/pm/state";

export interface DetailsSummaryOptions {
  HTMLAttributes: Record<string, any>;
}

export const DetailsSummary = Node.create<DetailsSummaryOptions>({
  name: "detailsSummary",
  group: "block",
  content: "inline*",
  defining: true,
  isolating: true,
  selectable: false,
  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },
  parseHTML() {
    return [
      {
        tag: "summary",
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "summary",
      mergeAttributes(
        { "data-type": this.name },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      0,
    ];
  },
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const state = editor.state;
        const selection = state.selection;
        if (selection.$anchor.parent.type.name !== this.name) {
          return false;
        }
        if (selection.$anchor.parentOffset !== 0) {
          return false;
        }
        return editor.chain().unsetDetails().focus().run();
      },
      Enter: ({ editor }) => {
        const view = editor.view;
        const state = editor.state;

        const head = state.selection.$head;
        if (head.parent.type.name !== this.name) {
          return false;
        }

        const hasOffset =
          // @ts-ignore
          view.domAtPos(head.after() + 1).node.offsetParent !== null;
        const findNode = hasOffset
          ? state.doc.nodeAt(head.after())
          : head.node(-2);
        if (!findNode) {
          return false;
        }

        const indexAfter = hasOffset ? 0 : head.indexAfter(-1);
        const nodeType = defaultBlockAt(findNode.contentMatchAt(indexAfter));
        if (
          !nodeType ||
          !findNode.canReplaceWith(indexAfter, indexAfter, nodeType)
        ) {
          return false;
        }

        const defaultNode = nodeType.createAndFill();
        if (!defaultNode) {
          return false;
        }

        const tr = state.tr;
        const after = hasOffset ? head.after() + 1 : head.after(-1);
        tr.replaceWith(after, after, defaultNode);
        tr.setSelection(Selection.near(tr.doc.resolve(after), 1));

        tr.scrollIntoView();
        view.dispatch(tr);

        return true;
      },
    };
  },
});
