import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

export interface EmbedOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}
export interface EmbedAttributes {
  src?: string;
  provider: string;
  align?: string;
  width?: number;
  height?: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    embeds: {
      setEmbed: (attributes?: EmbedAttributes) => ReturnType;
    };
  }
}

export const Embed = Node.create<EmbedOptions>({
  name: 'embed',
  inline: false,
  group: 'block',
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
        default: '',
        parseHTML: (element) => element.getAttribute('data-src'),
        renderHTML: (attributes: EmbedAttributes) => ({
          'data-src': attributes.src,
        }),
      },
      provider: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-provider'),
        renderHTML: (attributes: EmbedAttributes) => ({
          'data-provider': attributes.provider,
        }),
      },
      align: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-align'),
        renderHTML: (attributes: EmbedAttributes) => ({
          'data-align': attributes.align,
        }),
      },
      width: {
        default: 640,
        parseHTML: (element) => element.getAttribute('data-width'),
        renderHTML: (attributes: EmbedAttributes) => ({
          'data-width': attributes.width,
        }),
      },
      height: {
        default: 480,
        parseHTML: (element) => element.getAttribute('data-height'),
        renderHTML: (attributes: EmbedAttributes) => ({
          'data-height': attributes.height,
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
          href: HTMLAttributes["data-src"],
          target: "blank",
        },
        `${HTMLAttributes["data-src"]}`,
      ],
    ];
  },

  addCommands() {
    return {
      setEmbed:
        (attrs: EmbedAttributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: 'embed',
            attrs: attrs,
          });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(this.options.view);
  },
});
