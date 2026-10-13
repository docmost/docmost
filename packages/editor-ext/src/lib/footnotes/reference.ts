//Source MIT - https://github.com/buttondown/tiptap-footnotes
import { mergeAttributes, Node } from "@tiptap/core";
import {
  Fragment as PMFragment,
  Node as PMNode,
  Slice,
} from "@tiptap/pm/model";
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";
import { generateNodeId } from "../utils";


const REFNUM_ATTR = "data-reference-number";
const REF_CLASS = "footnote-ref";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    footnoteReference: {
      /**
       * add a new footnote reference
       * @example editor.commands.addFootnote()
       */
      addFootnote: () => ReturnType;
    };
  }
}

const FootnoteReference = Node.create({
  name: "footnoteReference",
  inline: true,
  content: "text*",
  group: "inline",
  atom: true,
  draggable: true,

  parseHTML() {
    return [
      {
        tag: `sup`,
        priority: 1000,
        getAttrs(node) {
          const anchor = node.querySelector<HTMLAnchorElement>(
            `a.${REF_CLASS}:first-child`
          );

          if (!anchor) {
            return false;
          }

          const id = anchor.getAttribute("data-id");
          const ref = anchor.getAttribute(REFNUM_ATTR);

          return {
            "data-id": id ?? generateNodeId(),
            referenceNumber: ref ?? anchor.innerText,
          };
        },
        contentElement(node) {
          return node.firstChild as HTMLElement;
        },
      },
    ];
  },

  addAttributes() {
    return {
      class: {
        default: REF_CLASS,
      },
      "data-id": {
        renderHTML(attributes) {
          return {
            "data-id": attributes["data-id"] || generateNodeId(),
          };
        },
      },
      referenceNumber: {},

      href: {
        renderHTML(attributes) {
          return {
            href: `#fn:${attributes["referenceNumber"]}`,
          };
        },
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const { referenceNumber, ...attributes } = HTMLAttributes;
    const attrs = mergeAttributes(this.options.HTMLAttributes, attributes);
    attrs[REFNUM_ATTR] = referenceNumber;

    return [
      "sup",
      { id: `fnref:${referenceNumber}` },
      ["a", attrs, HTMLAttributes.referenceNumber],
    ];
  },

  addProseMirrorPlugins() {
    const { editor } = this;

    // Ensures pasted footnote references get unique IDs.
    const mapNode = (node: PMNode): PMNode => {
      if (node.type.name === this.name) {
        const newAttrs = { ...node.attrs, "data-id": generateNodeId() };
        return node.type.create(newAttrs, node.content, node.marks);
      }

      if (node.content && node.content.size > 0) {
        const newChildren: PMNode[] = [];
        let changed = false;

        node.content.forEach((child) => {
          const mapped = mapNode(child);
          if (mapped !== child) {
            changed = true;
          }

          newChildren.push(mapped);
        });

        if (changed) {
          return node.copy(PMFragment.from(newChildren));
        }
      }

      return node;
    };

    return [
      new Plugin({
        key: new PluginKey("footnotePasteHandler"),
        props: {
          transformPasted(slice) {
            const mappedNodes: PMNode[] = [];
            let changed = false;

            slice.content.forEach((node) => {
              const mapped = mapNode(node);
              if (mapped !== node) {
                changed = true;
              }
              mappedNodes.push(mapped);
            });

            if (!changed) {
              return slice;
            }

            return new Slice(
              PMFragment.from(mappedNodes),
              slice.openStart,
              slice.openEnd
            );
          },
        },
      }),
      new Plugin({
        key: new PluginKey("footnoteRefClick"),

        props: {
          // on double-click, focus on the footnote
          handleDoubleClickOn(view, pos, node, nodePos, event) {
            if (node.type.name != "footnoteReference") return false;
            event.preventDefault();
            const id = node.attrs["data-id"];
            return editor.commands.focusFootnote(id);
          },
          // click the footnote reference once to get focus, click twice to scroll to the footnote
          handleClickOn(view, pos, node, nodePos, event) {
            if (node.type.name != "footnoteReference") return false;
            event.preventDefault();
            const { selection } = editor.state.tr;
            if (selection instanceof NodeSelection && selection.node.eq(node)) {
              const id = node.attrs["data-id"];
              return editor.commands.focusFootnote(id);
            } else {
              editor.chain().setNodeSelection(nodePos).run();
              return true;
            }
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      addFootnote:
        () =>
        ({ state, tr }) => {
          const node = this.type.create({
            "data-id": generateNodeId(),
          });
          tr.insert(state.selection.anchor, node);
          return true;
        },
    };
  },

  addInputRules() {
    // when a user types [^text], add a new footnote
    return [
      {
        find: /\[\^(.*?)\]/,
        type: this.type,
        undoable: true,
        handler({ range, match, chain }) {
          const start = range.from;
          let end = range.to;
          if (match[1]) {
            chain().deleteRange({ from: start, to: end }).addFootnote().run();
          }
        },
      },
    ];
  },
});

export default FootnoteReference;
