import { mergeAttributes, Node } from '@tiptap/core';
import { generateNodeId } from "../utils";

export interface TabOptions {
  HTMLAttributes: Record<string, unknown>;
}

export const Tab = Node.create<TabOptions>({
  name: 'tab',
  content: 'tabLabel tabPanel',
  defining: true,
  isolating: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      id: {
        default: '',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-tab-id') || generateNodeId(),
        renderHTML: (attributes: { id?: string }) => ({
          'data-tab-id': attributes.id ?? '',
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
      'div',
      mergeAttributes(
        { 'data-type': this.name },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      0,
    ];
  },
});
