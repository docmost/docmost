import { Fragment, Node } from "@tiptap/pm/model";

// inline content of a range that stays inside one textblock, with its marks
export function inlineFragment(
  doc: Node,
  from: number,
  to: number,
): Fragment | null {
  const $from = doc.resolve(from);
  const $to = doc.resolve(to);
  if (!$from.sameParent($to) || !$from.parent.inlineContent) return null;
  return $from.parent.content.cut($from.parentOffset, $to.parentOffset);
}
