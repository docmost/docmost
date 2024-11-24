import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import MistralModal from '../components/mistral-modal/MistralModal';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mistralBlock: {
      setMistralBlock: () => ReturnType;
    };
  }
}

export const MistralBlock = Node.create({
  name: 'mistralBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      prompt: {
        default: '',
      },
      completion: {
        default: '',
      },
    };
  },

  addCommands() {
    return {
      setMistralBlock:
        () =>
        ({ commands, chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: {
                prompt: '',
                completion: '',
              },
            })
            .focus()
            .run();
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(MistralModal);
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="mistral-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'mistral-block' }, HTMLAttributes)];
  },
});
