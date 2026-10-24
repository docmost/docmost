import { Extension } from '@tiptap/core';
import {
  NodeSelection,
  TextSelection,
  type EditorState,
  type Transaction,
} from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    moveNode: {
      moveNodeUp: () => ReturnType;
      moveNodeDown: () => ReturnType;
    };
  }
}

// Containers whose children form the sibling list a node swaps within when
// there's no more specific match. A list item swaps with its sibling list
// item (dragging any nested sub-list along with it); anything else swaps
// among the top-level blocks around it. Crossing into/out of other
// containers (blockquote, callout, table cell, …) is left for a later step.
const SIBLING_CONTAINERS = new Set(['listItem', 'taskItem']);

type MovableNode = {
  start: number;
  end: number;
  index: number;
  parent: ProseMirrorNode;
  node: ProseMirrorNode;
};

function findMovableNode(state: EditorState): MovableNode | null {
  const { selection } = state;

  if (selection instanceof NodeSelection) {
    const { $from, node } = selection;
    return {
      start: selection.from,
      end: selection.to,
      index: $from.index(),
      parent: $from.parent,
      node,
    };
  }

  const { $from, $to } = selection;

  let depth = -1;
  for (let d = $from.depth; d > 0; d--) {
    if (SIBLING_CONTAINERS.has($from.node(d).type.name)) {
      depth = d;
      break;
    }
  }
  if (depth === -1) {
    // No list-item ancestor: fall back to the top-level block under the
    // document root.
    if ($from.depth < 1) return null;
    depth = 1;
  }

  const end = $from.after(depth);
  // Bail on selections spanning past this node, e.g. a range selecting
  // across two list items — keep the move unambiguous.
  if ($to.pos > end) return null;

  return {
    start: $from.before(depth),
    end,
    index: $from.index(depth - 1),
    parent: $from.node(depth - 1),
    node: $from.node(depth),
  };
}

function moveNode(direction: 'up' | 'down') {
  return ({
    state,
    dispatch,
  }: {
    state: EditorState;
    dispatch?: (tr: Transaction) => void;
  }) => {
    const movable = findMovableNode(state);
    if (!movable) return false;

    const { parent, index, node, start, end } = movable;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= parent.childCount) return false;

    if (dispatch) {
      const sibling = parent.child(targetIndex);
      // Valid in the doc once the delete below has run: positions before
      // `start` are untouched by it, and `start + sibling.nodeSize` lands
      // right after the sibling once it has shifted back to `start`.
      const insertPos =
        direction === 'up'
          ? start - sibling.nodeSize
          : start + sibling.nodeSize;

      const { selection } = state;
      const tr = state.tr.delete(start, end).insert(insertPos, node);

      if (selection instanceof NodeSelection) {
        tr.setSelection(NodeSelection.create(tr.doc, insertPos));
      } else {
        // Keep the cursor/selection at the same relative offset inside the
        // moved node rather than jumping to a node selection.
        const anchorOffset = selection.anchor - start;
        const headOffset = selection.head - start;
        tr.setSelection(
          TextSelection.create(
            tr.doc,
            insertPos + anchorOffset,
            insertPos + headOffset,
          ),
        );
      }

      tr.scrollIntoView();
      dispatch(tr);
    }

    return true;
  };
}

export const MoveNode = Extension.create({
  name: 'moveNode',

  addCommands() {
    return {
      moveNodeUp:
        () =>
        ({ state, dispatch }) =>
          moveNode('up')({ state, dispatch }),
      moveNodeDown:
        () =>
        ({ state, dispatch }) =>
          moveNode('down')({ state, dispatch }),
    };
  },

  addKeyboardShortcuts() {
    return {
      'Alt-ArrowUp': () => this.editor.commands.moveNodeUp(),
      'Alt-ArrowDown': () => this.editor.commands.moveNodeDown(),
    };
  },
});

export default MoveNode;
