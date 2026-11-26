import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import {
  LinkPreviewAttributes,
  LinkPreviewOptions,
  linkPreviewAttributes,
  sanitizeLinkPreviewUrl,
} from "./link-preview";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    linkCard: {
      setLinkCard: (attributes: Partial<LinkPreviewAttributes>) => ReturnType;
    };
  }
}

export const LinkCard = Node.create<LinkPreviewOptions>({
  name: "linkCard",
  inline: false,
  group: "block",
  isolating: true,
  atom: true,
  defining: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      view: null,
    };
  },

  addAttributes() {
    return linkPreviewAttributes();
  },

  parseHTML() {
    return [
      {
        tag: `div[data-type="${this.name}"]`,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const safeUrl = sanitizeLinkPreviewUrl(HTMLAttributes["data-url"]);

    return [
      "div",
      mergeAttributes(
        { "data-type": this.name },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      [
        "a",
        { href: safeUrl, target: "_blank", rel: "noopener noreferrer" },
        HTMLAttributes["data-title"] || safeUrl,
      ],
    ];
  },

  renderText({ node }) {
    return node.attrs.url;
  },

  addCommands() {
    return {
      setLinkCard:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              ...attrs,
              url: sanitizeLinkPreviewUrl(attrs.url),
            },
          });
        },
    };
  },

  addNodeView() {
    this.editor.isInitialized = true;
    return ReactNodeViewRenderer(this.options.view);
  },
});
