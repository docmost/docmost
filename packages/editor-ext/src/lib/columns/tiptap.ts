import { Node, mergeAttributes, Extension } from '@tiptap/core';
import { columnsKeymap } from './keymap';
import { gridResizingPlugin } from './resize';

const Column = Node.create({
  name: 'column',

  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      colWidth: {
        default: 200,
        parseHTML: (element) => {
          const width = (element as HTMLElement).style.width.replace('px', '');
          return Number(width) || 200;
        },
        renderHTML: (attributes) => {
          const style = attributes.colWidth
            ? `width: ${attributes.colWidth}px;`
            : '';
          return { style };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div.prosemirror-column',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'prosemirror-column' }),
      0,
    ];
  },
});

const ColumnContainer = Node.create({
  name: 'column_container',

  group: 'block',
  content: 'column+',

  parseHTML() {
    return [
      {
        tag: 'div.prosemirror-column-container',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'prosemirror-column-container',
      }),
      0,
    ];
  },
});

export const ColumnsExtension = Extension.create({
  name: 'columns',

  addExtensions() {
    return [Column, ColumnContainer];
  },

  addProseMirrorPlugins() {
    return [
      gridResizingPlugin({ handleWidth: 2, columnMinWidth: 50 }),
      columnsKeymap,
    ];
  },
});
