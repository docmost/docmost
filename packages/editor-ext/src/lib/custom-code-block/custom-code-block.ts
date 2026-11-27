import type { CodeBlockOptions } from '@tiptap/extension-code-block';
import CodeBlock from '@tiptap/extension-code-block';
import { Plugin, Selection, TextSelection } from '@tiptap/pm/state';
import type { NodeType, ResolvedPos } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { GapCursor } from '@tiptap/pm/gapcursor';

import { LowlightPlugin } from './lowlight-plugin.js';
import { ReactNodeViewRenderer } from '@tiptap/react';

export interface CodeBlockLowlightOptions extends CodeBlockOptions {
  /**
   * The lowlight instance.
   */
  lowlight: any;
  view: any;
}

const TAB_CHAR = '\u00A0\u00A0';

/**
 * This extension allows you to highlight code blocks with lowlight.
 * @see https://tiptap.dev/api/nodes/code-block-lowlight
 */
export const CustomCodeBlock = CodeBlock.extend<CodeBlockLowlightOptions>({
  // Run ahead of Gapcursor (100) so the mermaid arrow-into-source plugin
  // can intercept before gapcursor takes over.
  priority: 101,
  selectable: true,
  isolating: true,

  addOptions() {
    return {
      ...this.parent?.(),
      lowlight: {},
      languageClassPrefix: 'language-',
      exitOnTripleEnter: true,
      exitOnArrowDown: true,
      defaultLanguage: null,
      HTMLAttributes: {},
      view: null,
    };
  },

  addKeyboardShortcuts() {
    const isMermaid = (node: any) =>
      node?.type === this.type && node.attrs.language === 'mermaid';

    return {
      ...this.parent?.(),
      // Stop at the gap (or enter mermaid source) instead of jumping
      // straight into the next block, so the user can place a cursor
      // between two adjacent isolating blocks.
      ArrowDown: ({ editor }) => {
        const { state } = editor;
        const { selection, doc } = state;
        const { $from, empty } = selection;

        if (!empty || $from.parent.type !== this.type) return false;
        if ($from.parentOffset !== $from.parent.nodeSize - 2) return false;

        const after = $from.after();
        if (after >= doc.content.size) {
          return editor.commands.exitCode();
        }

        const $after = doc.resolve(after);
        const nodeAfter = $after.nodeAfter;

        if (isMermaid(nodeAfter)) {
          return editor.commands.command(({ tr }) => {
            tr.setSelection(TextSelection.create(tr.doc, after + 1));
            return true;
          });
        }

        // Last block of its container: the table and gap cursor plugins handle its end.
        if (!nodeAfter) return false;

        if (
          nodeAfter?.type.spec.isolating &&
          !nodeAfter.type.spec.atom
        ) {
          return editor.commands.command(({ tr }) => {
            tr.setSelection(new GapCursor(tr.doc.resolve(after)));
            return true;
          });
        }

        return editor.commands.command(({ tr }) => {
          tr.setSelection(Selection.near(tr.doc.resolve(after)));
          return true;
        });
      },
      // Mirror of ArrowDown; upstream has no ArrowUp handler.
      ArrowUp: ({ editor }) => {
        const { state } = editor;
        const { selection, doc } = state;
        const { $from, empty } = selection;

        if (!empty || $from.parent.type !== this.type) return false;
        if ($from.parentOffset !== 0) return false;

        const before = $from.before();
        if (before <= 0) return false;

        const $before = doc.resolve(before);
        const nodeBefore = $before.nodeBefore;

        if (isMermaid(nodeBefore)) {
          return editor.commands.command(({ tr }) => {
            tr.setSelection(TextSelection.create(tr.doc, before - 1));
            return true;
          });
        }

        if (
          nodeBefore?.type.spec.isolating &&
          !nodeBefore.type.spec.atom
        ) {
          return editor.commands.command(({ tr }) => {
            tr.setSelection(new GapCursor(tr.doc.resolve(before)));
            return true;
          });
        }

        return false;
      },
      'Mod-a': () => {
        if (this.editor.isActive('codeBlock')) {
          const { state } = this.editor;
          const { $from } = state.selection;

          let codeBlockNode = null;
          let codeBlockPos = null;
          let depth = 0;

          for (depth = $from.depth; depth > 0; depth--) {
            const node = $from.node(depth);
            if (node.type.name === 'codeBlock') {
              codeBlockNode = node;
              codeBlockPos = $from.start(depth) - 1;
              break;
            }
          }

          if (codeBlockNode && codeBlockPos !== null) {
            const codeBlockStart = codeBlockPos;
            const codeBlockEnd = codeBlockPos + codeBlockNode.nodeSize;

            const contentStart = codeBlockStart + 1;
            const contentEnd = codeBlockEnd - 1;

            this.editor.commands.setTextSelection({
              from: contentStart,
              to: contentEnd,
            });

            return true;
          }
        }

        return false;
      },
    };
  },

  addNodeView() {
    // Force the react node view to render immediately using flush sync (https://github.com/ueberdosis/tiptap/blob/b4db352f839e1d82f9add6ee7fb45561336286d8/packages/react/src/ReactRenderer.tsx#L183-L191)
    this.editor.isInitialized = true;

    return ReactNodeViewRenderer(this.options.view);
  },

  addProseMirrorPlugins() {
    const codeBlockType = this.type;
    return [
      ...(this.parent?.() || []),
      LowlightPlugin({
        name: this.name,
        lowlight: this.options.lowlight,
        defaultLanguage: this.options.defaultLanguage,
      }),
      // Mermaid hides its <pre> when unselected, so the browser's native
      // vertical caret movement skips past it. Land the cursor inside the
      // source explicitly.
      new Plugin({
        props: {
          handleKeyDown: (view, event) => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
              return false;
            }
            const { state } = view;
            const { selection } = state;
            if (
              !selection.empty ||
              !(selection instanceof TextSelection)
            ) {
              return false;
            }
            const { $from } = selection;
            if ($from.depth === 0 || $from.parent.type === codeBlockType) {
              return false;
            }
            const dir = event.key === 'ArrowUp' ? 'up' : 'down';
            if (!view.endOfTextblock(dir)) return false;

            const isMermaid = (node: any) =>
              node?.type === codeBlockType && node.attrs.language === 'mermaid';

            if (event.key === 'ArrowUp') {
              if ($from.parentOffset !== 0) return false;
              const beforePos = $from.before();
              const prev = state.doc.resolve(beforePos).nodeBefore;
              if (!isMermaid(prev)) return false;
              const endPos = beforePos - 1;
              view.dispatch(
                state.tr.setSelection(
                  TextSelection.create(state.doc, endPos),
                ),
              );
              return true;
            }
            if ($from.parentOffset !== $from.parent.nodeSize - 2) return false;
            const afterPos = $from.after();
            const next = state.doc.resolve(afterPos).nodeAfter;
            if (!isMermaid(next)) return false;
            const startPos = afterPos + 1;
            view.dispatch(
              state.tr.setSelection(
                TextSelection.create(state.doc, startPos),
              ),
            );
            return true;
          },
        },
      }),
      // A code block is a single textblock, so the default triple click
      // selects all of it. Select the clicked line instead.
      new Plugin({
        props: {
          handleTripleClick: (view, pos, event) => {
            if (event.button !== 0) return false;

            const line = codeLineRange(view.state.doc.resolve(pos), codeBlockType);
            if (!line) return false;

            selectWithPointer(view, line.from, line.to);
            extendSelectionOnDrag(view, line, codeBlockType);
            return true;
          },
        },
      }),
    ];
  },
});

type TextRange = { from: number; to: number };

// The line of a code block that holds $pos, without its line break.
function codeLineRange(
  $pos: ResolvedPos,
  codeBlockType: NodeType,
): TextRange | null {
  if ($pos.parent.type !== codeBlockType) return null;

  const text = $pos.parent.textContent;
  const offset = $pos.parentOffset;
  const lineStart = offset === 0 ? 0 : text.lastIndexOf('\n', offset - 1) + 1;
  const newline = text.indexOf('\n', offset);
  const lineEnd = newline === -1 ? text.length : newline;

  const start = $pos.start();
  return { from: start + lineStart, to: start + lineEnd };
}

function selectWithPointer(view: EditorView, anchor: number, head: number) {
  if (!view.hasFocus()) view.focus();
  view.dispatch(
    view.state.tr
      .setSelection(TextSelection.create(view.state.doc, anchor, head))
      .setMeta('pointer', true),
  );
}

// Handling the triple click skips ProseMirror's drag tracking, which extends
// the selection by whole textblocks. Extend it by lines inside a code block
// and by textblocks elsewhere until the mouse is released.
function extendSelectionOnDrag(
  view: EditorView,
  start: TextRange,
  codeBlockType: NodeType,
) {
  const startDoc = view.state.doc;
  const target = view.dom.ownerDocument;

  const stop = () => {
    target.removeEventListener('mousemove', move);
    target.removeEventListener('mouseup', stop);
    target.removeEventListener('mousedown', stop, true);
  };

  const move = (event: MouseEvent) => {
    if (
      event.buttons === 0 ||
      view.isDestroyed ||
      !view.state.doc.eq(startDoc)
    ) {
      stop();
      return;
    }

    const coords = view.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    });
    if (!coords) return;

    const $pos = view.state.doc.resolve(coords.pos);
    const range =
      codeLineRange($pos, codeBlockType) ??
      ($pos.parent.inlineContent
        ? { from: $pos.start(), to: $pos.end() }
        : null);
    if (!range) return;

    event.preventDefault();
    const [anchor, head] =
      range.from < start.from
        ? [start.to, range.from]
        : [start.from, range.to];
    selectWithPointer(view, anchor, head);
  };

  target.addEventListener('mousemove', move);
  target.addEventListener('mouseup', stop);
  // the triple click's own mousedown is already past the capture phase
  target.addEventListener('mousedown', stop, true);
}
