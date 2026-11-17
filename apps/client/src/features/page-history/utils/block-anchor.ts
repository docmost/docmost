import { Node } from "@tiptap/pm/model";

// Where blocks drawn for a change at this position can go. Nothing can sit between two table cells, so they go into the next cell, or else the one before.
export function blockAnchor(doc: Node, pos: number): number {
  const $pos = doc.resolve(pos);
  if ($pos.parent.type.spec.tableRole !== "row") return pos;
  if ($pos.nodeAfter) return pos + 1;
  return $pos.nodeBefore ? pos - 1 : pos;
}
