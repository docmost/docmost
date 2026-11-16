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

  // a range with no inline content changed only markup, so mark the block it opens or drop it
  return segments.flatMap((segment) => {
    if (segment.node || hasInlineContent(doc, segment.from, segment.to)) {
      return [segment];
    }
    const node = doc.nodeAt(segment.from);
    if (node && (node.isTextblock || specialNodeTypes.has(node.type.name))) {
      return [{ from: segment.from, to: segment.from + node.nodeSize, node }];
    }
    return [];
  });
}

// Splits a range that starts and ends between blocks into its whole blocks, leaving out the ones with nothing to show.
export function splitBlockRange(
  doc: Node,
  from: number,
  to: number,
  specialNodeTypes: ReadonlySet<string>,
): ChangeSegment[] {
  if (
    doc.resolve(from).parent.inlineContent ||
    doc.resolve(to).parent.inlineContent
  ) {
    return [];
  }

  const segments: ChangeSegment[] = [];
  doc.nodesBetween(from, to, (node, pos) => {
    const end = pos + node.nodeSize;
    if (pos < from || end > to) return true;
    if (
      specialNodeTypes.has(node.type.name) ||
      hasInlineContent(doc, pos, end)
    ) {
      segments.push({ from: pos, to: end, node });
    }
    return false;
  });
  return segments;
}

function hasInlineContent(doc: Node, from: number, to: number): boolean {
  let found = false;
  doc.nodesBetween(from, to, (node) => {
    if (node.isInline) found = true;
    return !found;
  });
  return found;
}
