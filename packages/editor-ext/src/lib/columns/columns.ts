import { Node, mergeAttributes, findParentNode } from "@tiptap/core";
import { Fragment, Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type ColumnsLayout =
  | "two_equal"
  | "two_left_sidebar"
  | "two_right_sidebar"
  | "three_equal"
  | "three_left_wide"
  | "three_right_wide"
  | "three_with_sidebars"
  | "four_equal"
  | "five_equal";

export interface ColumnsOptions {
  HTMLAttributes: Record<string, any>;
}

export type WidthMode = "normal" | "wide";

export interface ColumnsAttributes {
  layout?: ColumnsLayout;
  widthMode?: WidthMode;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    columns: {
      insertColumns: (attributes?: ColumnsAttributes) => ReturnType;
      setColumnsWidthMode: (widthMode: WidthMode) => ReturnType;
      setColumnCount: (count: number) => ReturnType;
      setColumnsLayout: (layout: ColumnsLayout) => ReturnType;
    };
  }
}

function columnCountFromLayout(layout: string): number {
  if (layout.startsWith("five")) return 5;
  if (layout.startsWith("four")) return 4;
  if (layout.startsWith("three")) return 3;
  return 2;
}

function defaultLayoutForCount(count: number): ColumnsLayout {
  if (count === 3) return "three_equal";
  if (count === 4) return "four_equal";
  if (count === 5) return "five_equal";
  return "two_equal";
}

export const Columns = Node.create<ColumnsOptions>({
  name: "columns",
  group: "block",
  content: "column+",
  defining: true,
  isolating: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      layout: {
        default: "two_equal",
        parseHTML: (element) => element.getAttribute("data-layout"),
        renderHTML: (attributes: ColumnsAttributes) => ({
          "data-layout": attributes.layout,
        }),
      },
      widthMode: {
        default: "normal",
        parseHTML: (element) =>
          element.getAttribute("data-width-mode") || "normal",
        renderHTML: (attributes: ColumnsAttributes) => {
          if (!attributes.widthMode || attributes.widthMode === "normal")
            return {};
          return { "data-width-mode": attributes.widthMode };
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

  addCommands() {
    return {
      insertColumns:
        (attributes) =>
        ({ tr, state, dispatch }) => {
          const layout = attributes?.layout || "two_equal";
          const count = columnCountFromLayout(layout);

          const columnType = state.schema.nodes.column;
          const paraType = state.schema.nodes.paragraph;
          const children = Array.from({ length: count }, () =>
            columnType.create(null, paraType.create()),
          );
          const columnsNode = this.type.create(
            attributes,
            Fragment.from(children),
          );

          const stepsBefore = tr.steps.length;
          tr.replaceSelectionWith(columnsNode);

          if (tr.steps.length > stepsBefore) {
            const stepMap = tr.steps[tr.steps.length - 1].getMap();
            let insertStart = 0;
            stepMap.forEach((_from, _to, newFrom) => {
              insertStart = newFrom;
            });
            tr.setSelection(
              TextSelection.near(tr.doc.resolve(insertStart + 1), 1),
            );
          }

          if (dispatch) dispatch(tr);
          return true;
        },

      setColumnsWidthMode:
        (widthMode) =>
        ({ commands }) =>
          commands.updateAttributes("columns", { widthMode }),

      setColumnCount:
        (count: number) =>
        ({ tr, state }) => {
          const predicate = (node: PMNode) => node.type.name === "columns";
          const parent = findParentNode(predicate)(state.selection);
          if (!parent) return false;

          const { node: columnsNode, pos: parentPos } = parent;
          const currentCount = columnsNode.childCount;
          if (count === currentCount || count < 2 || count > 5) return false;

          const columnType = state.schema.nodes.column;
          const paraType = state.schema.nodes.paragraph;
          const newChildren: PMNode[] = [];

          if (count > currentCount) {
            for (let i = 0; i < currentCount; i++) {
              newChildren.push(columnsNode.child(i));
            }
            for (let i = currentCount; i < count; i++) {
              newChildren.push(columnType.create(null, paraType.create()));
            }
          } else {
            for (let i = 0; i < count - 1; i++) {
              newChildren.push(columnsNode.child(i));
            }
            let mergedContent = columnsNode.child(count - 1).content;
            for (let j = count; j < currentCount; j++) {
              const col = columnsNode.child(j);
              const nonEmpty: PMNode[] = [];
              col.content.forEach((child) => {
                if (
                  child.type.name !== "paragraph" ||
                  child.content.size > 0
                ) {
                  nonEmpty.push(child);
                }
              });
              if (nonEmpty.length > 0) {
                mergedContent = mergedContent.append(
                  Fragment.from(nonEmpty),
                );
              }
            }
            newChildren.push(columnType.create(null, mergedContent));
          }

          const newLayout = defaultLayoutForCount(count);
          const newNode = columnsNode.type.create(
            { ...columnsNode.attrs, layout: newLayout },
            Fragment.from(newChildren),
          );
          tr.replaceWith(parentPos, parentPos + columnsNode.nodeSize, newNode);
          tr.setSelection(
            TextSelection.near(tr.doc.resolve(parentPos + 1), 1),
          );
          return true;
        },

      setColumnsLayout:
        (layout) =>
        ({ commands }) =>
          commands.updateAttributes("columns", { layout }),
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("columnsFocus"),
        props: {
          decorations: (state) => {
            const parent = findParentNode(
              (node) => node.type.name === "columns",
            )(state.selection);
            if (!parent) return DecorationSet.empty;
            return DecorationSet.create(state.doc, [
              Decoration.node(
                parent.pos,
                parent.pos + parent.node.nodeSize,
                { class: "has-focus" },
              ),
            ]);
          },
        },
      }),
    ];
  },
});
