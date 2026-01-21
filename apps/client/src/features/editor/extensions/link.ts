import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import InsertLinkView from "../components/insert-link/insert-link-view";

export default Node.create({
  name: "insertLink",

  group: "block",

  atom: true,
  draggable: true,

  addAttributes() {
    return {
      type: {
        default: "page", // 'page' | 'url'
      },
      pageId: {
        default: null,
      },
      url: {
        default: null,
      },
      title: {
        default: "",
      },
      icon: {
        default: null,
      },
      slugId: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "insert-link",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["insert-link", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InsertLinkView);
  },
});
