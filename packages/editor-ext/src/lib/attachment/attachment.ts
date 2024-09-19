import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { AttachmentUploadPlugin } from "./attachment-upload";

export interface AttachmentOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export interface AttachmentAttributes {
  url?: string;
  name?: string;
  mime?: string; // e.g. application/zip
  size?: number;
  attachmentId?: string;
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
      url: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-attachment-url"),
        renderHTML: (attributes) => ({
          "data-attachment-url": attributes.url,
        }),
      },
      name: {
        default: undefined,
        parseHTML: (element) => element.getAttribute("data-attachment-name"),
        renderHTML: (attributes: AttachmentAttributes) => ({
          "data-attachment-name": attributes.name,
        }),
      },
      mime: {
        default: undefined,
        parseHTML: (element) => element.getAttribute("data-attachment-mime"),
        renderHTML: (attributes: AttachmentAttributes) => ({
          "data-attachment-mime": attributes.mime,
        }),
      },
      size: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-attachment-size"),
        renderHTML: (attributes: AttachmentAttributes) => ({
          "data-attachment-size": attributes.size,
        }),
      },
      attachmentId: {
        default: undefined,
        parseHTML: (element) => element.getAttribute("data-attachment-id"),
        renderHTML: (attributes: AttachmentAttributes) => ({
          "data-attachment-id": attributes.attachmentId,
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
      [
        "a",
        {
          href: HTMLAttributes["data-attachment-url"],
          class: "attachment",
          target: "blank",
        },
        `${HTMLAttributes["data-attachment-name"]}`,
      ],
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
