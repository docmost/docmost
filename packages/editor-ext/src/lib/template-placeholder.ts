import { Node } from '@tiptap/core';

export const TemplatePlaceholder = Node.create({
  name: 'templatePlaceholder',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return { hint: { default: '', validate: 'string', rendered: false } };
  },

  // The editor supplies the visible hint. HTML exports and the clipboard
  // serialize this node without its instruction.
  renderHTML() {
    return ['span'];
  },

  renderText() {
    return '';
  },
});
