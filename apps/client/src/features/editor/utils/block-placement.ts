import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";

export type BlockPlacement = {
  range: { from: number; to: number };
  content: Fragment;
};

// Swaps an inline range for a block, splitting its paragraph around it; null where the block can't go.
export function getBlockPlacement(
  doc: ProseMirrorNode,
  from: number,
  to: number,
  block: ProseMirrorNode,
): BlockPlacement | null {
  const $from = doc.resolve(from);
  if ($from.parent.type.name !== "paragraph") return null;

  const parentStart = $from.start();
  const parentEnd = parentStart + $from.parent.content.size;
  if (from < parentStart || to > parentEnd || from > to) return null;

  const depth = $from.depth;
  const parentContainer = $from.node(depth - 1);
  const parentIndex = $from.index(depth - 1);

  const before = trimInlineBoundary(
    $from.parent.content.cut(0, from - parentStart),
    "end",
  );
  const after = trimInlineBoundary(
    $from.parent.content.cut(to - parentStart),
    "start",
  );
  const replacement: ProseMirrorNode[] = [];
  if (before.size) replacement.push($from.parent.copy(before));
  replacement.push(block);
  if (after.size) replacement.push($from.parent.copy(after));

  const content = Fragment.fromArray(replacement);
  if (!parentContainer.canReplace(parentIndex, parentIndex + 1, content)) {
    return null;
  }

  return {
    range: { from: $from.before(depth), to: $from.after(depth) },
    content,
  };
}

function trimInlineBoundary(
  fragment: Fragment,
  boundary: "start" | "end",
): Fragment {
  const children: ProseMirrorNode[] = [];
  fragment.forEach((child) => children.push(child));

  while (children.length) {
    const index = boundary === "start" ? 0 : children.length - 1;
    const child = children[index];
    if (!child?.isText) break;

    const text =
      boundary === "start"
        ? child.text?.replace(/^\s+/, "")
        : child.text?.replace(/\s+$/, "");
    if (text) {
      children[index] = child.type.schema.text(text, child.marks);
      break;
    }
    children.splice(index, 1);
  }

  return Fragment.fromArray(children);
}
