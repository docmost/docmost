import { ReactNodeViewRenderer } from "@tiptap/react";
import { VideoUploadPlugin } from "./video-upload";
import { mergeAttributes, Range, Node, nodeInputRule } from "@tiptap/core";

export interface VideoOptions {
  view: any;
  HTMLAttributes: Record<string, any>;
}
export interface VideoAttributes {
  src?: string;
  title?: string;
  align?: string;
  attachmentId?: string;
  size?: number;
  width?: number;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    videoBlock: {
      setVideo: (attributes: VideoAttributes) => ReturnType;
      setVideoAt: (
        attributes: VideoAttributes & { pos: number | Range },
      ) => ReturnType;
      setVideoAlign: (align: "left" | "center" | "right") => ReturnType;
      setVideoWidth: (width: number) => ReturnType;
    };
  }
}

export const TiptapVideo = Node.create<VideoOptions>({
  name: "video",

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
        parseHTML: (element) => element.getAttribute("src"),
        renderHTML: (attributes) => ({
          src: attributes.src,
        }),
      },
      attachmentId: {
        default: undefined,
        parseHTML: (element) => element.getAttribute("data-attachment-id"),
        renderHTML: (attributes: VideoAttributes) => ({
          "data-attachment-id": attributes.attachmentId,
        }),
      },
      width: {
        default: "100%",
        parseHTML: (element) => element.getAttribute("width"),
        renderHTML: (attributes: VideoAttributes) => ({
          width: attributes.width,
        }),
      },
      size: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-size"),
        renderHTML: (attributes: VideoAttributes) => ({
          "data-size": attributes.size,
        }),
      },
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align"),
        renderHTML: (attributes: VideoAttributes) => ({
          "data-align": attributes.align,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'video',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      { controls: "true", ...HTMLAttributes },
      ["source", HTMLAttributes],
    ];
  },

  addCommands() {
    return {
      setVideo:
        (attrs: VideoAttributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: "video",
            attrs: attrs,
          });
        },

      setVideoAlign:
        (align) =>
        ({ commands }) =>
          commands.updateAttributes("video", { align }),

      setVideoWidth:
        (width) =>
        ({ commands }) =>
          commands.updateAttributes("video", {
            width: `${Math.max(0, Math.min(100, width))}%`,
          }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(this.options.view);
  },

  addProseMirrorPlugins() {
    return [
      VideoUploadPlugin({
        placeholderClass: "video-upload",
      }),
    ];
  },
});
