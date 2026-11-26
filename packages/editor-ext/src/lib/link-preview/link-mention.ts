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
    linkMention: {
      setLinkMention: (attributes: Partial<LinkPreviewAttributes>) => ReturnType;
    };
  }
}

export const LinkMention = Node.create<LinkPreviewOptions>({
  name: "linkMention",
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,
  draggable: false,

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
        tag: `span[data-type="${this.name}"]`,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const safeUrl = sanitizeLinkPreviewUrl(HTMLAttributes["data-url"]);

    return [
      "span",
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
      setLinkMention:
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
