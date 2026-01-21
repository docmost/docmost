import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    columnGroup: {
      insertColumns: (attributes?: { widths?: number[] }) => ReturnType;
      updateColumnLayout: (widths: number[]) => ReturnType;
    };
  }
}

export const ColumnGroup = Node.create({
  name: "columnGroup",

  group: "block",

  content: "column+",

  isolating: true,

  draggable: true,

  parseHTML() {
    return [
      {
        tag: 'section[data-type="columns"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "section",
      mergeAttributes(HTMLAttributes, { "data-type": "columns" }),
      0,
    ];
  },

  addCommands() {
    return {
      insertColumns:
        (attributes?: { widths?: number[] }) =>
        ({ commands }) => {
          const widths = attributes?.widths || [50, 50];
          const content = widths.map((width) => ({
            type: "column",
            attrs: { width },
            content: [
              {
                type: "paragraph",
              },
            ],
          }));

          return commands.insertContent({
            type: this.name,
            attrs: attributes,
            content,
          });
        },

      updateColumnLayout:
        (widths: number[]) =>
        ({ state, dispatch }) => {
          const { selection } = state;
          let columnGroupPos = -1;
          let columnGroupNode: any = null;

          state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
            if (node.type.name === this.name) {
              columnGroupPos = pos;
              columnGroupNode = node;
              return false;
            }
          });

          if (columnGroupPos === -1) {
            return false;
          }

          if (dispatch) {
            const tr = state.tr;
            columnGroupNode.content.forEach(
              (column: any, offset: number, index: number) => {
                if (widths[index] !== undefined) {
                  const pos = columnGroupPos + 1 + offset;
                  tr.setNodeMarkup(pos, undefined, {
                    ...column.attrs,
                    width: widths[index],
                  });
                }
              },
            );
            dispatch(tr);
          }

          return true;
        },
    };
  },
});
