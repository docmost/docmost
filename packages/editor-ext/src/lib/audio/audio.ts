import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { normalizeFileUrl } from "../media-utils";
import { sanitizeUrl, isInternalFileUrl } from "../utils";

export interface AudioOptions {
  view: any;
  HTMLAttributes: Record<string, any>;
}

export interface AudioAttributes {
  src?: string;
  attachmentId?: string;
  size?: number;
  placeholder?: {
    id: string;
    name: string;
  };
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    audioBlock: {
      setAudio: (attributes: AudioAttributes) => ReturnType;
    };
  }
}

export const TiptapAudio = Node.create<AudioOptions>({
  name: "audio",

  group: "block",
  isolating: true,
  atom: true,
  defining: true,
  draggable: true,

  addOptions() {
    return {
      view: null,
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (element) => {
          const src = element.getAttribute("src");
          const sanitized = sanitizeUrl(src);
          return isInternalFileUrl(sanitized) ? sanitized : "";
        },
        renderHTML: (attributes) => ({
          src: isInternalFileUrl(attributes.src)
            ? sanitizeUrl(attributes.src)
            : "",
        }),
      },
      attachmentId: {
        default: undefined,
        parseHTML: (element) => element.getAttribute("data-attachment-id"),
        renderHTML: (attributes: AudioAttributes) => ({
          "data-attachment-id": attributes.attachmentId,
        }),
      },
      size: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-size"),
        renderHTML: (attributes: AudioAttributes) => ({
          "data-size": attributes.size,
        }),
      },
      placeholder: {
        default: null,
        rendered: false,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "audio",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "audio",
      mergeAttributes(
        { controls: "true", preload: "metadata" },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      ["source", { src: HTMLAttributes.src }],
    ];
  },

  addCommands() {
    return {
      setAudio:
        (attrs: AudioAttributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: "audio",
            attrs: attrs,
          });
        },
    };
  },

  addNodeView() {
    if (this.options.view) {
      this.editor.isInitialized = true;
      return ReactNodeViewRenderer(this.options.view);
    }

    return ({ node, HTMLAttributes }) => {
      const dom = document.createElement("div");
      const audio = document.createElement("audio");
      const src = node.attrs.src;
      if (src && isInternalFileUrl(src)) {
        audio.src = normalizeFileUrl(src);
      }
      audio.controls = true;
      audio.preload = "metadata";
      audio.style.width = "100%";
      dom.append(audio);
      return { dom };
    };
  },
});
