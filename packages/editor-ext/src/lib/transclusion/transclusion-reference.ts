import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

export interface TransclusionReferenceOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export interface TransclusionReferenceAttributes {
  sourcePageId?: string | null;
  transclusionId?: string | null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    transclusionReference: {
      insertTransclusionReference: (
        attributes: TransclusionReferenceAttributes,
      ) => ReturnType;
    };
  }
}

export const TransclusionReference = Node.create<TransclusionReferenceOptions>({
  name: "transclusionReference",

  addOptions() {
    return {
      HTMLAttributes: {},
      view: null,
    };
  },

  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      sourcePageId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-source-page-id"),
        renderHTML: (attrs) =>
          attrs.sourcePageId
            ? { "data-source-page-id": attrs.sourcePageId }
            : {},
      },
      transclusionId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-transclusion-id"),
        renderHTML: (attrs) =>
          attrs.transclusionId
            ? { "data-transclusion-id": attrs.transclusionId }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: `div[data-type="${this.name}"]` }];
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
      insertTransclusionReference:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: attributes,
          }),
    };
  },

  addNodeView() {
    if (!this.options.view) return null;
    this.editor.isInitialized = true;
    return ReactNodeViewRenderer(this.options.view);
  },
});
