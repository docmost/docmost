import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import {
  newColumnContent,
  newColumnLayoutContent,
  findParentNodeByType,
} from "./utils";

export interface ColummnContainerOptions {
  view: any;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    columnLayout: {
      clSetColumnAttr: (
        xsAttr: number,
        mdAttr: number,
        lgAttr: number
      ) => ReturnType;
      clGetColumnAttr: () => any;
      clAddColumnBefore: () => ReturnType;
      clAddColumnAfter: () => ReturnType;
      clAddColumnAt: (position: number) => ReturnType;
      clAddColumnLayout: (...texts: string[]) => ReturnType;
      clDeleteColumn: () => ReturnType;
      clDeleteColumnLayout: () => ReturnType;
    };
  }
}

export const ColumnContainer = Node.create<ColummnContainerOptions>({
  name: "columnContainer",
  group: "block",
  content: "columnItem+",
  draggable: false,

  addOptions() {
    return {
      view: null,
    };
  },

  addAttributes() {
    return {
      class: {
        default: null,
      },
      style: {
        default: null,
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
      mergeAttributes({ "data-type": this.name }, HTMLAttributes),
      0,
    ];
  },

  addCommands() {
    return {
      clGetColumnAttr:
        () =>
        ({ editor, state, commands, dispatch }) => {
          const parent = findParentNodeByType(editor, "column");
          if (!parent) return false;

          const node = parent.node;

          return node.attrs;
        },
      clSetColumnAttr:
        (xsAttr, mdAttr, lgAttr) =>
        ({ editor, state, commands, dispatch }) => {
          const parent = findParentNodeByType(editor, "column");
          if (!parent) return false;

          const position = parent.pos;

          const tr = state.tr
            .setNodeAttribute(position, "xs", xsAttr)
            .setNodeAttribute(position, "md", mdAttr)
            .setNodeAttribute(position, "lg", lgAttr);
          if (dispatch) dispatch(tr);
          commands.focus();

          return true;
        },
      clAddColumnBefore:
        () =>
        ({ editor, commands }) => {
          const parent = findParentNodeByType(editor, "column");
          if (!parent) return false;

          const position = parent.pos;

          return commands.insertContentAt(position, newColumnContent);
        },
      clAddColumnAfter:
        () =>
        ({ editor, commands }) => {
          const parent = findParentNodeByType(editor, "column");
          if (!parent) return false;

          const position = parent.pos + parent.node.nodeSize;

          return commands.insertContentAt(position, newColumnContent);
        },
      clAddColumnAt:
        (position: number) =>
        ({ commands }) => {
          return commands.insertContentAt(position, newColumnContent);
        },
      clAddColumnLayout:
        (...texts) =>
        ({ commands }) => {
          return commands.insertContent(newColumnLayoutContent(...texts));
        },
      clDeleteColumn:
        () =>
        ({ editor, state, dispatch }) => {
          const parentColumn = findParentNodeByType(editor, "column");
          if (!parentColumn) return false;
          const parentColumnContainer = findParentNodeByType(
            editor,
            "columnContainer"
          );
          if (!parentColumnContainer) return false;

          if (parentColumnContainer.node.childCount <= 1) {
            return editor.commands.clDeleteColumnLayout()
          }

          const from = parentColumn.pos;
          const to = parentColumn.pos + parentColumn.node.nodeSize ;

          const tr = state.tr.delete(from, to);
          if (dispatch) dispatch(tr);

          return true;
        },

      clDeleteColumnLayout:
        () =>
        ({ editor, state, dispatch }) => {
          const parent = findParentNodeByType(editor, "columnContainer");
          if (!parent) return false;

          const from = parent.pos;
          const to = parent.pos + parent.node.nodeSize;

          const tr = state.tr.delete(from, to);
          if (dispatch) dispatch(tr);

          return true;
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(this.options.view);
  },
});
