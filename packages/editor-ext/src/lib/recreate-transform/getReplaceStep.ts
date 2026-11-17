import { ReplaceStep } from "@tiptap/pm/transform";
import { Node } from "@tiptap/pm/model";

export function getReplaceStep(fromDoc: Node, toDoc: Node) {
  let start = toDoc.content.findDiffStart(fromDoc.content);
  if (start === null) {
    return false;
  }

  // @ts-ignore property access to content
  let { a: endA, b: endB } = toDoc.content.findDiffEnd(fromDoc.content);
  const overlap = start - Math.min(endA, endB);
  if (overlap > 0) {
    // If there is an overlap, there is some freedom of choice in how to calculate the
    // start/end boundary. for an inserted/removed slice. We choose the nearest boundary
    // with the lowest depth value, so a whole node is added or removed on its own boundaries.
    const $start = fromDoc.resolve(start);
    const depth = $start.sharedDepth(start - overlap);
    const shift = $start.depth > depth ? start - $start.before(depth + 1) : 0;
    start -= shift;
    endA += overlap - shift;
    endB += overlap - shift;
  }

  return new ReplaceStep(start, endB, toDoc.slice(start, endA));
}
