import { Node } from "@tiptap/pm/model";

export type ChangeSegment = { from: number; to: number; node?: Node };

// Splits a changed range so each special node inside it is marked whole and the content between them inline.
export function splitChangeRange(
  doc: Node,
  from: number,
  to: number,
  specialNodeTypes: ReadonlySet<string>,
): ChangeSegment[] {
  const segments: ChangeSegment[] = [];
  let cursor = from;

  doc.nodesBetween(from, to, (node, pos) => {
    if (!specialNodeTypes.has(node.type.name)) return true;
    const end = pos + node.nodeSize;
    if (pos < from || end > to) return true;
    if (pos > cursor) segments.push({ from: cursor, to: pos });
    segments.push({ from: pos, to: end, node });
    cursor = end;
    return false;
  });

  if (cursor < to) segments.push({ from: cursor, to });
  return segments;
}
