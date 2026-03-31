import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

export type StatusStorage = {
  autoOpen: boolean;
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    status: {
      setStatus: (attributes?: { text?: string; color?: string }) => ReturnType;
    };
  }

  interface Storage {
    status: StatusStorage;
  }
}

export type StatusColor =
  | 'gray'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'red'
  | 'purple';

export interface StatusOption {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export const Status = Node.create<StatusOption, StatusStorage>({
  name: 'status',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      view: null,
    };
  },

  addStorage() {
    return {
      autoOpen: false,
    };
  },

  addAttributes() {
    return {
      text: {
        default: '',
        parseHTML: (element: HTMLElement) => element.textContent || '',
      },
      color: {
        default: 'gray',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-color') || 'gray',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `span[data-type="${this.name}"]`,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        'data-type': this.name,
        'data-color': HTMLAttributes.color,
      },
      HTMLAttributes.text,
    ];
  },

  addNodeView() {
    this.editor.isInitialized = true;
    return ReactNodeViewRenderer(this.options.view);
  },

  addCommands() {
    return {
      setStatus:
        (attributes) =>
        ({ commands }) => {
          this.storage.autoOpen = true;
          return commands.insertContent({
            type: this.name,
            attrs: {
              text: attributes?.text ?? '',
              color: attributes?.color || 'gray',
            },
          });
        },
    };
  },
});
