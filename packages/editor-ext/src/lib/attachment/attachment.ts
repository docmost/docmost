import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { AttachmentUploadPlugin } from "./attachment-upload";

export interface AttachmentOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}
export interface AttachmentAttributes {
  src?: string;
  extension?: string;
  name?: string;
  attachmentId?: string;
  size?: number;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    attachment: {
      setAttachment: (attributes: AttachmentAttributes) => ReturnType;
    };
  }
}

export const Attachment = Node.create<AttachmentOptions>({
  name: "attachment",
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
    return {
      src: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-src"),
        renderHTML: (attributes) => ({
          "data-src": attributes.src,
        }),
      },
      extension: {
        default: undefined,
        parseHTML: (element) => element.getAttribute("data-extension"),
        renderHTML: (attributes: AttachmentAttributes) => ({
          "data-extension": attributes.extension,
        }),
      },
      name: {
        default: undefined,
        parseHTML: (element) => element.getAttribute("data-name"),
        renderHTML: (attributes: AttachmentAttributes) => ({
          "data-name": attributes.name,
        }),
      },
      attachmentId: {
        default: undefined,
        parseHTML: (element) => element.getAttribute("data-attachment-id"),
        renderHTML: (attributes: AttachmentAttributes) => ({
          "data-attachment-id": attributes.attachmentId,
        }),
      },
      size: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-size"),
        renderHTML: (attributes: AttachmentAttributes) => ({
          "data-size": attributes.size,
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

  addCommands() {
    return {
      setAttachment:
        (attrs: AttachmentAttributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: "attachment",
            attrs: attrs,
          });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(this.options.view);
  },

  addProseMirrorPlugins() {
    return [
      AttachmentUploadPlugin({
        placeholderClass: "attachment-placeholder",
      }),
    ];
  },
});
