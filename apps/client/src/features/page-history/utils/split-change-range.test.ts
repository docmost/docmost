import { getSchema, Node as TiptapNode } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";
import { StarterKit } from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { splitChangeRange } from "./split-change-range";

const Image = TiptapNode.create({
  name: "image",
  group: "block",
  atom: true,
  renderHTML: () => ["img"],
});

const Table = TiptapNode.create({
  name: "table",
  group: "block",
  content: "paragraph+",
  renderHTML: () => ["table", 0],
});

const schema = getSchema([StarterKit, Image, Table]);
const special = new Set(["image", "table"]);

const p = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

const doc = Node.fromJSON(schema, {
  type: "doc",
  content: [
    p("Intro"),
    { type: "image" },
    p("Middle"),
    { type: "table", content: [p("Cell")] },
    p("End"),
  ],
});

function positionOf(name: string) {
  let found = -1;
  doc.descendants((node, pos) => {
    if (found < 0 && node.type.name === name) found = pos;
  });
  return found;
}

const imageFrom = positionOf("image");
const imageTo = imageFrom + 1;
const tableFrom = positionOf("table");
const tableTo = tableFrom + doc.nodeAt(tableFrom)!.nodeSize;

const summary = (from: number, to: number) =>
  splitChangeRange(doc, from, to, special).map((segment) => ({
    from: segment.from,
    to: segment.to,
    node: segment.node?.type.name,
  }));

describe("splitChangeRange", () => {
  it("marks every special node in a change and the text around them", () => {
    expect(summary(0, doc.content.size)).toEqual([
      { from: 0, to: imageFrom, node: undefined },
      { from: imageFrom, to: imageTo, node: "image" },
      { from: imageTo, to: tableFrom, node: undefined },
      { from: tableFrom, to: tableTo, node: "table" },
      { from: tableTo, to: doc.content.size, node: undefined },
    ]);
  });

  it("keeps a change that is one special node as that node", () => {
    expect(summary(imageFrom, imageTo)).toEqual([
      { from: imageFrom, to: imageTo, node: "image" },
    ]);
  });

  it("treats a change inside a special node as text", () => {
    const cellText = tableFrom + 2;
    expect(summary(cellText, cellText + 4)).toEqual([
      { from: cellText, to: cellText + 4, node: undefined },
    ]);
  });

  it("returns a text change as one range", () => {
    expect(summary(1, 6)).toEqual([{ from: 1, to: 6, node: undefined }]);
  });

  it("marks a whole block when only its opening changed", () => {
    expect(summary(0, 1)).toEqual([{ from: 0, to: 7, node: "paragraph" }]);
  });

  it("marks a whole special node when only its opening changed", () => {
    expect(summary(tableFrom, tableFrom + 1)).toEqual([
      { from: tableFrom, to: tableTo, node: "table" },
    ]);
  });

  it("drops a change with nothing to show", () => {
    expect(summary(6, 7)).toEqual([]);
  });
});
