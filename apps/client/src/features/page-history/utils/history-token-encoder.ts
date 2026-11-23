import type { TokenEncoder } from "@tiptap/pm/changeset";
import type { Attrs, Mark } from "@tiptap/pm/model";

// attrs that change without the content changing, and link attrs derived from href
const ignoredAttrs = new Set([
  "id",
  "dir",
  "placeholder",
  "pendingKey",
  "data-id",
  "class",
  "creatorId",
  "open",
  "colwidth",
  "rel",
  "target",
]);
// comments anchor on text without formatting it
export const ignoredMarks = new Set(["comment"]);

// diff tokens that also carry marks and node attrs, so formatting-only edits count as changes
export function createHistoryTokenEncoder(): TokenEncoder<number | string> {
  const markSets = new Map<string, number>();
  const markSetIds = new WeakMap<readonly Mark[], number>();

  // all characters of a text node share its marks array, so its key is built once
  const markSetId = (marks: readonly Mark[]) => {
    let id = markSetIds.get(marks);
    if (id === undefined) {
      const key = marks
        .filter((mark) => !ignoredMarks.has(mark.type.name))
        .map((mark) => mark.type.name + attrsKey(mark.attrs))
        .join(",");
      id = 0;
      if (key) {
        id = markSets.get(key);
        if (id === undefined) {
          id = markSets.size + 1;
          markSets.set(key, id);
        }
      }
      markSetIds.set(marks, id);
    }
    return id;
  };

  return {
    // char codes stay below 0x10000, so the mark set fits above them
    encodeCharacter: (char, marks) => char + markSetId(marks) * 0x10000,
    encodeNodeStart: (node) => node.type.name + attrsKey(node.attrs),
    encodeNodeEnd: (node) => "/" + node.type.name,
    compareTokens: (a, b) => a === b,
  };
}

export function attrsKey(attrs: Attrs): string {
  let key = "";
  for (const name in attrs) {
    if (!ignoredAttrs.has(name)) key += `|${name}=${JSON.stringify(attrs[name])}`;
  }
  return key;
}
