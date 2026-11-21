import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

export interface HtmlBlockOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export interface HtmlBlockAttributes {
  htmlBlockId?: string | null;
  height?: number | null;
}

export interface HtmlBlockStorage {
  autoOpen: boolean;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    htmlBlock: {
      insertHtmlBlock: (attributes?: HtmlBlockAttributes) => ReturnType;
    };
  }

  interface Storage {
    htmlBlock: HtmlBlockStorage;
  }
}

export const HtmlBlock = Node.create<HtmlBlockOptions, HtmlBlockStorage>({
  name: "htmlBlock",
  inline: false,
  group: "block",
  isolating: true,
  atom: true,
  defining: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      view: null,
    };
  },

  addStorage() {
    return { autoOpen: false };
  },

  addAttributes() {
    return {
      htmlBlockId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-html-block-id"),
        renderHTML: (attributes: HtmlBlockAttributes) => ({
          "data-html-block-id": attributes.htmlBlockId,
        }),
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const parsed = parseInt(element.getAttribute("data-height") ?? "", 10);
          return Number.isNaN(parsed) ? null : parsed;
        },
        renderHTML: (attributes: HtmlBlockAttributes) => ({
          "data-height": attributes.height,
        }),
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
    ];
  },

  renderText() {
    return "";
  },

  addCommands() {
    return {
      insertHtmlBlock:
        (attrs?: HtmlBlockAttributes) =>
        ({ commands, editor }) => {
          editor.storage.htmlBlock.autoOpen = true;
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },

  addNodeView() {
    this.editor.isInitialized = true;

    return ReactNodeViewRenderer(this.options.view);
  },
});
