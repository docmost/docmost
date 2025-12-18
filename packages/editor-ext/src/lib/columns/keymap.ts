import { liftTarget, canSplit } from "@tiptap/pm/transform";
import { TextSelection, Command } from "@tiptap/pm/state";
import {
  splitBlock,
  chainCommands,
  newlineInCode,
  createParagraphNear,
} from "@tiptap/pm/commands";
import { keymap } from "@tiptap/pm/keymap";
import { ResolvedPos } from "@tiptap/pm/model";

function findParentColumn($pos: ResolvedPos) {
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === "column") {
      return { node, depth };
    }
  }
  return null;
}

export const liftEmptyBlock: Command = (state, dispatch) => {
  const { $cursor } = state.selection as TextSelection;
  if (!$cursor || $cursor.parent.content.size) return false;
  if ("column" === $cursor.node($cursor.depth - 1).type.name) return false;
  if ($cursor.depth > 1 && $cursor.after() != $cursor.end(-1)) {
    const before = $cursor.before();
    if (canSplit(state.doc, before)) {
      if (dispatch) dispatch(state.tr.split(before).scrollIntoView());
      return true;
    }
  }
  const range = $cursor.blockRange(),
    target = range && liftTarget(range);
  if (target == null) return false;
  if (dispatch) dispatch(state.tr.lift(range!, target).scrollIntoView());
  return true;
};

export const columnsKeymap = keymap({
  Enter: chainCommands(
    newlineInCode,
    createParagraphNear,
    liftEmptyBlock,
    splitBlock,
  ),
  "Mod-a": (state, dispatch, view) => {
    const { selection } = state;
    const { $from } = selection;
    const found = findParentColumn($from);
    if (found) {
      const { depth } = found;
      const start = $from.start(depth);
      const end = $from.end(depth);
      const tr = state.tr.setSelection(
        TextSelection.create(state.doc, start, end),
      );
      if (dispatch) dispatch(tr);
      return true;
    }
    return false;
  },
} as { [key: string]: Command });
