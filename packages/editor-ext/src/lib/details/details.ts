import {
  Node,
  findChildren,
  findParentNode,
  mergeAttributes,
  wrappingInputRule,
} from "@tiptap/core";
import { icon, setAttributes } from "../utils";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    details: {
      setDetails: () => ReturnType;
      unsetDetails: () => ReturnType;
      toggleDetails: () => ReturnType;
    };
  }
}

export interface DetailsOptions {
  HTMLAttributes: Record<string, any>;
}

export const Details = Node.create<DetailsOptions>({
  name: "details",
  group: "block",
  content: "detailsSummary detailsContent",
  defining: true,
  isolating: true,
  // @ts-ignore
  allowGapCursor: false,
  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      open: {
        default: false,
        parseHTML: (e) => e.getAttribute("open"),
        renderHTML: (a) => (a.open ? { open: "" } : {}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "details",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "details",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("div");
      const btn = document.createElement("button");
      const ico = document.createElement("div");
      const div = document.createElement("div");

      for (const [key, value] of Object.entries(
        mergeAttributes(this.options.HTMLAttributes),
      )) {
        if (value !== undefined && value !== null) {
          dom.setAttribute(key, value);
        }
      }

      dom.setAttribute("data-type", this.name);
      btn.setAttribute("data-type", `${this.name}Button`);
      div.setAttribute("data-type", `${this.name}Container`);

      if (editor.isEditable) {
        if (node.attrs.open) {
          dom.setAttribute("open", "true");
        } else {
          dom.removeAttribute("open");
        }
      }

      ico.innerHTML = icon("right-line");
      btn.addEventListener("click", () => {
        const open = !dom.hasAttribute("open");

        if (!editor.isEditable) {
          // In readonly mode,  toggle the 'open' attribute without updating the document state.
          if (open) {
            dom.setAttribute("open", "true");
          } else {
            dom.removeAttribute("open");
          }
          return;
        }

        setAttributes(editor, getPos, { ...node.attrs, open });
      });

      btn.append(ico);
      dom.append(btn);
      dom.append(div);
      return {
        dom,
        contentDOM: div,
        update: (updatedNode) => {
          if (updatedNode.type !== this.type) {
            return false;
          }
          if (!editor.isEditable) return true;
          if (updatedNode.attrs.open) {
            dom.setAttribute("open", "true");
          } else {
            dom.removeAttribute("open");
          }
          return true;
        },
      };
    };
  },

  addCommands() {
    return {
      setDetails: () => {
        return ({ state, chain }) => {
          const range = state.selection.$from.blockRange(state.selection.$to);
          if (!range) {
            return false;
          }

          const slice = state.doc.slice(range.start, range.end);

          if (slice.content.firstChild.type.name === "detailsSummary")
            return false;

          if (
            !state.schema.nodes.detailsContent.contentMatch.matchFragment(
              slice.content,
            )
          ) {
            return false;
          }

          return chain()
            .insertContentAt(
              {
                from: range.start,
                to: range.end,
              },
              {
                type: this.name,
                attrs: {
                  open: true,
                },
                content: [
                  {
                    type: "detailsSummary",
                  },
                  {
                    type: "detailsContent",
                    content: slice.toJSON()?.content ?? [],
                  },
                ],
              },
            )
            .setTextSelection(range.start + 2)
            .run();
        };
      },

      unsetDetails: () => {
        return ({ state, chain }) => {
          const parent = findParentNode((node) => node.type === this.type)(
            state.selection,
          );
          if (!parent) {
            return false;
          }

          const summary = findChildren(
            parent.node,
            (node) => node.type.name === "detailsSummary",
          );
          const content = findChildren(
            parent.node,
            (node) => node.type.name === "detailsContent",
          );
          if (!summary.length || !content.length) {
            return false;
          }

          const range = {
            from: parent.pos,
            to: parent.pos + parent.node.nodeSize,
          };
          const defaultType = state.doc.resolve(range.from).parent.type
            .contentMatch.defaultType;
          return chain()
            .insertContentAt(range, [
              defaultType?.create(null, summary[0].node.content).toJSON(),
              ...(content[0].node.content.toJSON() ?? []),
            ])
            .setTextSelection(range.from + 1)
            .run();
        };
      },

      toggleDetails: () => {
        return ({ state, chain }) => {
          const node = findParentNode((node) => node.type === this.type)(
            state.selection,
          );
          if (node) {
            return chain().unsetDetails().run();
          } else {
            return chain().setDetails().run();
          }
        };
      },
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: /^:::details\s$/,
        type: this.type,
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Alt-d": () => this.editor.commands.toggleDetails(),
    };
  },
});
