import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { getFileNameFromUrl, normalizeFileUrl } from "../media-utils";
import { sanitizeUrl, isInternalFileUrl, renderableFileUrl } from "../utils";

export interface AudioOptions {
  view: any;
  HTMLAttributes: Record<string, any>;
}

export interface AudioAttributes {
  src?: string;
  name?: string;
  attachmentId?: string;
  size?: number;
  placeholder?: {
    id: string;
    name: string;
  };
}

// audio added before the name attribute falls back to the file name in src
export function getAudioFileName(attrs: {
  name?: string | null;
  src?: string | null;
}): string | null {
  return attrs?.name || getFileNameFromUrl(attrs?.src) || null;
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
        // an export with attachments points src into its own files folder
        renderHTML: (attributes) => ({
          src: renderableFileUrl(attributes.src),
        }),
      },
      name: {
        default: undefined,
        parseHTML: (element) => element.getAttribute("data-name"),
        renderHTML: (attributes: AudioAttributes) => ({
          "data-name": attributes.name,
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
      return ReactNodeViewRenderer(this.options.view, {
        // the player's controls take their own clicks and keys, drags stay with ProseMirror
        stopEvent: ({ event }) => {
          if (event.type.startsWith("drag") || event.type === "drop") {
            return false;
          }
          const target = event.target as HTMLElement | null;
          return !!target?.closest?.("[data-audio-controls]");
        },
      });
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

      const fileName = getAudioFileName(node.attrs);
      if (fileName) {
        const label = document.createElement("div");
        label.textContent = fileName;
        label.title = fileName;
        label.style.cssText =
          "font-size:14px;font-weight:600;margin-bottom:6px;" +
          "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
        audio.setAttribute("aria-label", fileName);
        dom.append(label);
      }

      dom.append(audio);
      return { dom };
    };
  },
});
