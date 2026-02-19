import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    inlineStatus: {
      setInlineStatus: (attributes?: {
        text?: string;
        color?: string;
      }) => ReturnType;
    };
  }
}

export type InlineStatusColor =
  | "gray"
  | "blue"
  | "green"
  | "yellow"
  | "red"
  | "purple";

export interface InlineStatusOption {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export const InlineStatus = Node.create<InlineStatusOption>({
  name: "inlineStatus",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      view: null,
    };
  },

  addAttributes() {
    return {
      text: {
        default: "",
        parseHTML: (element: HTMLElement) => element.textContent || "",
      },
      color: {
        default: "gray",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-color") || "gray",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `span[data-type="${this.name}"]`,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      {
        "data-type": this.name,
        "data-color": HTMLAttributes.color,
      },
      HTMLAttributes.text,
    ];
  },

  addNodeView() {
    this.editor.isInitialized = true;
    return ReactNodeViewRenderer(this.options.view);
  },

  addCommands() {
    return {
      setInlineStatus:
        (attributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              text: attributes?.text || "STATUS",
              color: attributes?.color || "gray",
            },
          });
        },
    };
  },
});
