import { NodeSpec } from '@tiptap/pm/model';

export type ColumnNodes = Record<'column' | 'column_container', NodeSpec>;

export function columnNodes(): ColumnNodes {
  return {
    column: {
      group: 'block',
      content: 'block+',
      attrs: {
        colWidth: { default: 200 },
      },
      parseDOM: [
        {
          tag: 'div.prosemirror-column',
          getAttrs(dom) {
            if (!(dom instanceof HTMLElement)) return false;
            const width = dom.style.width.replace('px', '') || 200;
            return {
              colWidth: width,
            };
          },
        },
      ],
      toDOM(node) {
        const { colWidth } = node.attrs;
        const style = colWidth ? `width: ${colWidth}px;` : '';
        return [
          'div',
          {
            class: 'prosemirror-column',
            style,
          },
          0,
        ];
      },
    },
    column_container: {
      group: 'block',
      content: 'column+',
      parseDOM: [
        {
          tag: 'div.prosemirror-column-container',
        },
      ],
      toDOM() {
        return ['div', { class: 'prosemirror-column-container' }, 0];
      },
    },
  };
}
