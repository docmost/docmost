import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

export type TemplateSkeletonKind = "drawio" | "excalidraw";

export interface TemplateSkeletonOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export interface TemplateSkeletonAttributes {
  kind: TemplateSkeletonKind;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    templateSkeleton: {
      setTemplateSkeleton: (
        attributes: TemplateSkeletonAttributes,
      ) => ReturnType;
    };
  }
}

export const TemplateSkeleton = Node.create<TemplateSkeletonOptions>({
  name: "templateSkeleton",
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
      kind: {
        default: "drawio",
        parseHTML: (element) => element.getAttribute("data-kind"),
        renderHTML: (attributes: TemplateSkeletonAttributes) => ({
          "data-kind": attributes.kind,
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
      setTemplateSkeleton:
        (attrs: TemplateSkeletonAttributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: "templateSkeleton",
            attrs,
          });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(this.options.view);
  },
});

export default TemplateSkeleton;
