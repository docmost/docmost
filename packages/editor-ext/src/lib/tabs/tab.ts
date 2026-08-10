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
          element.getAttribute('data-tab-id') ?? generateNodeId(),
        renderHTML: (attributes: { id?: string }) => ({
          'data-tab-id': attributes.id ?? '',
        }),
      },
      active: {
        default: true,
        parseHTML: (element: HTMLElement) => {
          const rawValue = element.getAttribute('data-tab-active');
          if (rawValue === null) {
            return !element.hasAttribute('hidden');
          }

          return rawValue === 'true';
        },
        renderHTML: (attributes: { active?: boolean }) => {
          const isActive = attributes.active !== false;

          return {
            'data-tab-active': isActive ? 'true' : 'false',
            'aria-hidden': isActive ? 'false' : 'true',
            ...(isActive ? {} : { hidden: 'hidden' }),
          };
        },
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
