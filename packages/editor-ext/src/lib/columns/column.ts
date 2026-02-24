import { Node, mergeAttributes, findParentNode } from "@tiptap/core";
import { TextSelection } from "prosemirror-state";

export interface ColumnOptions {
  HTMLAttributes: Record<string, any>;
}

export interface ColumnAttributes {
  width?: number | null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    column: {
      setColumnWidth: (width: number | null) => ReturnType;
    };
  }
}

export const Column = Node.create<ColumnOptions>({
  name: "column",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  selectable: false,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      width: {
        default: null,
        parseHTML: (element) => {
          const value = element.getAttribute("data-width");
          return value ? parseFloat(value) : null;
        },
        renderHTML: (attributes: ColumnAttributes) => {
          if (!attributes.width) return {};
          return {
            "data-width": attributes.width,
            style: `flex: ${attributes.width}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `div[data-type="${this.name}"]`,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        { "data-type": this.name },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      0,
    ];
  },

  addKeyboardShortcuts() {
    const jumpToColumn = (direction: 1 | -1) => () => {
      const { state, dispatch } = this.editor.view;

      const columns = findParentNode(
        (node) => node.type.name === "columns",
      )(state.selection);
      if (!columns) return false;

      const column = findParentNode(
        (node) => node.type.name === "column",
      )(state.selection);
      if (!column) return false;

      let currentIndex = -1;
      columns.node.forEach((_child, offset, index) => {
        if (columns.pos + 1 + offset === column.pos) {
          currentIndex = index;
        }
      });

      const targetIndex = currentIndex + direction;
      if (targetIndex < 0 || targetIndex >= columns.node.childCount) {
        return true;
      }

      let offset = 0;
      for (let j = 0; j < targetIndex; j++) {
        offset += columns.node.child(j).nodeSize;
      }

      const targetPos = columns.pos + 1 + offset + 1 + 1;
      if (dispatch) {
        dispatch(
          state.tr.setSelection(TextSelection.create(state.doc, targetPos)),
        );
      }
      return true;
    };

    return {
      Tab: jumpToColumn(1),
      "Shift-Tab": jumpToColumn(-1),
    };
  },

  addCommands() {
    return {
      setColumnWidth:
        (width) =>
        ({ commands }) =>
          commands.updateAttributes("column", { width }),
    };
  },
});
