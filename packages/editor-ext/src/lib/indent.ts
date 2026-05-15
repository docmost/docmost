import { Extension } from '@tiptap/core';
import {
  Plugin,
  PluginKey,
  type EditorState,
  type Transaction,
} from '@tiptap/pm/state';

export type IndentOptions = {
  types: string[];
  min: number;
  max: number;
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
  }
}

// Containers whose descendants must never carry an `indent` attribute. These
// nodes own their own Tab semantics (list nesting, cell navigation, literal
// tab) and visually conflict with our indent padding, so paragraphs and
// headings inside them stay flat
const NON_INDENTABLE_ANCESTORS = new Set([
  'listItem',
  'taskItem',
  'tableCell',
  'tableHeader',
  'codeBlock',
]);

const clampIndent = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
};

const hasNonIndentableAncestor = (
  doc: EditorState['doc'],
  pos: number,
): boolean => {
  const $pos = doc.resolve(pos);
  for (let depth = $pos.depth; depth >= 0; depth--) {
    if (NON_INDENTABLE_ANCESTORS.has($pos.node(depth).type.name)) {
      return true;
    }
  }
  return false;
};

export const Indent = Extension.create<IndentOptions>({
  name: 'indent',

  priority: 1000,

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      min: 0,
      max: 8,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: this.options.min,
            keepOnSplit: true,
            parseHTML: (element) => {
              const raw = element.getAttribute('data-indent');
              if (raw === null) return this.options.min;
              return clampIndent(
                parseInt(raw, 10),
                this.options.min,
                this.options.max,
              );
            },
            renderHTML: (attributes) => {
              const value = attributes.indent;
              if (value <= this.options.min) return {};
              return { 'data-indent': String(value) };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      indent:
        () =>
        ({ state, tr, dispatch }) => {
          return updateIndent(state, tr, dispatch, this.options, +1);
        },
      outdent:
        () =>
        ({ state, tr, dispatch }) => {
          return updateIndent(state, tr, dispatch, this.options, -1);
        },
    };
  },

  addKeyboardShortcuts() {
    const isInIndentableBlock = (): boolean => {
      const { $from } = this.editor.state.selection;
      if (!this.options.types.includes($from.parent.type.name)) return false;
      for (let depth = $from.depth - 1; depth >= 0; depth--) {
        if (NON_INDENTABLE_ANCESTORS.has($from.node(depth).type.name)) {
          return false;
        }
      }
      return true;
    };

    return {
      Tab: () => {
        if (!isInIndentableBlock()) return false;
        this.editor.commands.indent();
        return true;
      },
      'Shift-Tab': () => {
        if (!isInIndentableBlock()) return false;
        this.editor.commands.outdent();
        return true;
      },
      Backspace: () => {
        const { $from, empty } = this.editor.state.selection;
        if (!empty) return false;
        if ($from.parentOffset !== 0) return false;
        if (!isInIndentableBlock()) return false;
        if ($from.parent.attrs.indent <= this.options.min) return false;
        this.editor.commands.outdent();
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const types = new Set(this.options.types);
    const min = this.options.min;

    return [
      new Plugin({
        key: new PluginKey('indentNormalizer'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;

          const tr = newState.tr;
          let modified = false;

          newState.doc.descendants((node, pos) => {
            // Containers: descend so we can find paragraph/heading children.
            if (!types.has(node.type.name)) return true;

            if (node.attrs.indent <= min) return false;

            if (hasNonIndentableAncestor(newState.doc, pos)) {
              tr.setNodeMarkup(
                pos,
                undefined,
                { ...node.attrs, indent: min },
                node.marks,
              );
              modified = true;
            }

            // paragraph/heading don't contain other paragraphs/headings —
            // never descend into their inline content.
            return false;
          });

          if (!modified) return null;
          // Normalisation must not show up as a separate undo step;
          // otherwise undo would re-introduce the illegal indent.
          return tr.setMeta('addToHistory', false);
        },
      }),
    ];
  },
});

function updateIndent(
  state: EditorState,
  tr: Transaction,
  dispatch: ((tr: Transaction) => void) | undefined,
  options: IndentOptions,
  delta: number,
): boolean {
  const { selection } = state;
  const { from, to } = selection;
  const types = new Set(options.types);
  let updated = false;

  state.doc.nodesBetween(from, to, (node, pos) => {
    // Skip non-block nodes (text, inline atoms) up front.
    if (!node.type.isBlock) return false;

    // Don't descend into containers whose children must stay flat — handles
    // multi-block selections that span across e.g. a list-item or table-cell.
    if (NON_INDENTABLE_ANCESTORS.has(node.type.name)) return false;

    if (!types.has(node.type.name)) return true;

    const current = node.attrs.indent as number;
    const next = clampIndent(current + delta, options.min, options.max);
    if (next === current) return false;

    tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
    updated = true;
    return false;
  });

  if (!updated) return false;
  if (dispatch) dispatch(tr);
  return true;
}
