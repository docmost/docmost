import type { Editor } from "@tiptap/core";
import { GapCursor } from "@tiptap/pm/gapcursor";
import type { Node, ResolvedPos } from "@tiptap/pm/model";
import { Selection, TextSelection } from "@tiptap/pm/state";
import { nextCell } from "@tiptap/pm/tables";

// prosemirror-gapcursor's own rule for where a gap cursor may sit; its typings leave it out.
const isGapCursorPos = ($pos: ResolvedPos): boolean =>
  (GapCursor as unknown as { valid($pos: ResolvedPos): boolean }).valid($pos);

const isCell = (node: Node): boolean =>
  node.type.spec.tableRole === "cell" ||
  node.type.spec.tableRole === "header_cell";

// prosemirror-tables leaves the cell before the gap cursor plugin sees the key; stop at the cell's edge gaps first.
export function handleCellEdgeArrow(
  editor: Editor,
  axis: "horiz" | "vert",
  dir: -1 | 1,
): boolean {
  const { state, view } = editor;
  const { selection } = state;
  const isGap = selection instanceof GapCursor;

  if (!isGap && !(selection instanceof TextSelection && selection.empty)) {
    return false;
  }
  const edge =
    axis === "vert" ? (dir < 0 ? "up" : "down") : dir < 0 ? "left" : "right";
  if (!isGap && !view.endOfTextblock(edge)) return false;

  const { $head } = selection;
  let cellDepth = -1;
  for (let depth = isGap ? $head.depth : $head.depth - 1; depth > 0; depth--) {
    const node = $head.node(depth);
    const atEdge =
      dir < 0
        ? $head.index(depth) === 0
        : $head.indexAfter(depth) === node.childCount;
    if (!atEdge) return false;
    if (isCell(node)) {
      cellDepth = depth;
      break;
    }
  }
  if (cellDepth < 0) return false;

  for (let depth = $head.depth; depth > cellDepth; depth--) {
    const $gap = state.doc.resolve(
      dir < 0 ? $head.before(depth) : $head.after(depth),
    );
    if (isGapCursorPos($gap)) {
      view.dispatch(state.tr.setSelection(new GapCursor($gap)).scrollIntoView());
      return true;
    }
  }

  if (!isGap || axis !== "vert") return false;

  const $cell = state.doc.resolve($head.before(cellDepth));
  const $next = nextCell($cell, "vert", dir);
  let target: Selection | null;
  if ($next) {
    target = Selection.near($next, 1);
  } else {
    // Selection.near would fall back into the table when nothing lies beyond it.
    const $outside = state.doc.resolve(
      dir < 0 ? $cell.before(-1) : $cell.after(-1),
    );
    target =
      Selection.findFrom($outside, dir) ??
      (isGapCursorPos($outside) ? new GapCursor($outside) : null);
  }
  if (!target) return false;
  view.dispatch(state.tr.setSelection(target).scrollIntoView());
  return true;
}
