import { Extension } from '@tiptap/core'
import { isChangeOrigin } from '@tiptap/extension-collaboration';
import { NodeSelection, PluginKey, Plugin, Selection, TextSelection } from '@tiptap/pm/state';
import { GapCursor } from '@tiptap/pm/gapcursor';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';

export interface TrailingNodeExtensionOptions {
  node: string,
  notAfter: string[],
}

function nodeEqualsType({ types, node }: { types: any, node: any }) {
  if (!node) return false
  return (Array.isArray(types) && types.includes(node.type)) || node.type === types
}

// footnotes must stay the last doc child, so the trailing node goes before it
function lastNodeBeforeFootnotes(doc: ProseMirrorNode) {
  const lastChild = doc.lastChild
  if (lastChild?.type.name === 'footnotes') {
    return doc.childCount > 1 ? doc.child(doc.childCount - 2) : null
  }
  return lastChild
}

function canMoveToTrailingLine(
  view: EditorView,
  end: number,
  key: string,
): boolean {
  const { doc, selection } = view.state;
  if (selection instanceof NodeSelection)
    return selection.$from.depth === 0 && selection.to === end;
  if (
    !(selection instanceof TextSelection) ||
    !selection.empty ||
    selection.$head.depth === 0 ||
    selection.$head.after(1) !== end
  )
    return false;
  const last = Selection.findFrom(doc.resolve(end), -1, true);
  if (!last || last.$head.parent !== selection.$head.parent) return false;
  if (key === 'ArrowRight' && last.head !== selection.head) return false;
  return view.endOfTextblock(key === 'ArrowDown' ? 'down' : 'right');
}

function collaborativeTrailingInput(
  options: TrailingNodeExtensionOptions,
  editable: () => boolean,
) {
  const position = (doc: ProseMirrorNode) => {
    const last = lastNodeBeforeFootnotes(doc);
    if (last && options.notAfter.includes(last.type.name)) return null;
    return (
      doc.content.size -
      (doc.lastChild?.type.name === 'footnotes' ? doc.lastChild.nodeSize : 0)
    );
  };
  const select = (view: EditorView, pos: number) => {
    view.dispatch(
      view.state.tr
        .setSelection(new GapCursor(view.state.doc.resolve(pos)))
        .scrollIntoView(),
    );
  };
  const insert = (view: EditorView, text?: string) => {
    const { state } = view;
    const pos = position(state.doc);
    if (
      !view.editable ||
      pos === null ||
      !(state.selection instanceof GapCursor) ||
      state.selection.from !== pos
    )
      return false;
    const paragraph = state.schema.nodes[options.node].create(
      null,
      text ? state.schema.text(text) : undefined,
    );
    const tr = state.tr.insert(pos, paragraph);
    view.dispatch(
      tr
        .setSelection(
          TextSelection.create(tr.doc, pos + 1 + (text?.length ?? 0)),
        )
        .scrollIntoView(),
    );
    return true;
  };
  let composition: { doc: ProseMirrorNode; pos: number } | undefined;
  // Navigation is local. Typing into the empty line creates a shared paragraph.
  return new Plugin({
    appendTransaction(transactions, before, state) {
      if (
        composition &&
        transactions.some((tr) => isChangeOrigin(tr) && tr.docChanged)
      )
        composition = undefined;
      if (
        !(before.selection instanceof GapCursor) ||
        before.selection.from !== position(before.doc) ||
        !transactions.some((tr) => tr.docChanged && isChangeOrigin(tr)) ||
        !editable()
      )
        return;
      const end = position(state.doc);
      if (
        end === null ||
        (state.selection instanceof GapCursor && state.selection.from === end)
      )
        return;
      // Yjs restores relative positions as text selections. Keep a caret on the local insertion line.
      return state.tr
        .setSelection(new GapCursor(state.doc.resolve(end)))
        .setMeta('addToHistory', false);
    },
    props: {
      handleDOMEvents: {
        compositionstart(view) {
          const { doc, selection } = view.state;
          if (
            view.editable &&
            selection instanceof GapCursor &&
            selection.from === position(doc)
          ) {
            composition = { doc, pos: selection.from };
          }
          return false;
        },
        compositionend(view, event) {
          const start = composition;
          composition = undefined;
          if (!start || event.data !== '') return false;
          view.dom.ownerDocument.defaultView?.requestAnimationFrame(() => {
            if (view.isDestroyed || !view.editable || view.composing) return;
            const { state } = view;
            if (
              state.selection.from !== start.pos + 1 ||
              !state.selection.empty
            )
              return;
            const line = state.doc.nodeAt(start.pos);
            if (line?.type.name !== options.node || line.content.size) return;
            const tr = state.tr.delete(start.pos, start.pos + line.nodeSize);
            // Only remove the empty paragraph if that restores the entire document from before composition.
            if (tr.doc.eq(start.doc)) {
              view.dispatch(
                tr
                  .setSelection(new GapCursor(tr.doc.resolve(start.pos)))
                  .setMeta('addToHistory', false),
              );
            }
          });
          return false;
        },
      },
      decorations(state) {
        const pos = position(state.doc);
        if (!editable() || pos === null) return null;
        const line = Decoration.widget(
          pos,
          (view) => {
            const element = view.dom.ownerDocument.createElement('p');
            element.dataset.trailingInput = 'true';
            element.setAttribute('aria-hidden', 'true');
            element.appendChild(view.dom.ownerDocument.createElement('br'));
            element.onmousedown = (event) => {
              if (
                event.button !== 0 ||
                event.shiftKey ||
                event.ctrlKey ||
                event.altKey ||
                event.metaKey
              )
                return;
              const end = position(view.state.doc);
              if (end === null || !view.editable) return;
              event.preventDefault();
              select(view, end);
              view.focus();
            };
            return element;
          },
          { key: 'trailing-input', side: 1, ignoreSelection: true },
        );
        return DecorationSet.create(state.doc, [line]);
      },
      handleTextInput: (view, _from, _to, text) => insert(view, text),
      handleKeyDown(view, event) {
        if (
          !view.editable ||
          view.composing ||
          event.isComposing ||
          event.shiftKey ||
          event.ctrlKey ||
          event.altKey ||
          event.metaKey
        )
          return false;
        if (event.key === 'Enter') return insert(view);
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowRight')
          return false;
        const end = position(view.state.doc);
        if (end === null || !canMoveToTrailingLine(view, end, event.key))
          return false;
        select(view, end);
        return true;
      },
    },
  });
}

// @ts-ignore
/**
 * Extension based on:
 * - https://github.com/ueberdosis/tiptap/blob/v1/packages/tiptap-extensions/src/extensions/TrailingNode.js
 * - https://github.com/remirror/remirror/blob/e0f1bec4a1e8073ce8f5500d62193e52321155b9/packages/prosemirror-trailing-node/src/trailing-node-plugin.ts
 */
export const TrailingNode = Extension.create<TrailingNodeExtensionOptions>({
  name: 'trailingNode',

  addOptions() {
    return {
      node: 'paragraph',
      notAfter: [
        'paragraph',
      ],
    };
  },

  addProseMirrorPlugins() {
    if (this.editor.extensionManager.extensions.some(extension => extension.name === 'collaboration')) {
      return [collaborativeTrailingInput(this.options, () => this.editor.isEditable)];
    }
    const plugin = new PluginKey(this.name)
    const disabledNodes = Object.entries(this.editor.schema.nodes)
      .map(([, value]) => value)
      .filter(node => this.options.notAfter.includes(node.name))

    return [
      new Plugin({
        key: plugin,
        appendTransaction: (_, __, state) => {
          const { doc, tr, schema } = state;
          const shouldInsertNodeAtEnd = plugin.getState(state);
          const type = schema.nodes[this.options.node]

          if (!shouldInsertNodeAtEnd) {
            return;
          }

          const lastChild = doc.lastChild
          const endPosition = lastChild?.type.name === 'footnotes'
            ? doc.content.size - lastChild.nodeSize
            : doc.content.size

          return tr.insert(endPosition, type.create());
        },
        state: {
          init: (_, state) => {
            try {
              const lastNode = lastNodeBeforeFootnotes(state.tr.doc)
              return !nodeEqualsType({ node: lastNode, types: disabledNodes })
            } catch (err){
              console.log(err)
            }
            return true;
          },
          apply: (tr, value) => {
            if (!tr.docChanged) {
              return value
            }

            // Ignore transactions from UniqueID extension to prevent infinite loops
            // when UniqueID adds IDs to newly inserted trailing nodes
            if (tr.getMeta('__uniqueIDTransaction')) {
              return value
            }

            const lastNode = lastNodeBeforeFootnotes(tr.doc)
            return !nodeEqualsType({ node: lastNode, types: disabledNodes })
          },
        },
      }),
    ]
  }
})
