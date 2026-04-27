import { Node, mergeAttributes } from '@tiptap/core';

export interface BaseEmbedOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    baseEmbed: {
      insertBaseEmbed: (attrs: { pageId: string }) => ReturnType;
    };
  }
}

export const BaseEmbed = Node.create<BaseEmbedOptions>({
  name: 'baseEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      pageId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-page-id'),
        renderHTML: (attrs) =>
          attrs.pageId ? { 'data-page-id': attrs.pageId } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="base-embed"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'base-embed',
      }),
    ];
  },

  addCommands() {
    return {
      insertBaseEmbed:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
          }),
    };
  },
});
