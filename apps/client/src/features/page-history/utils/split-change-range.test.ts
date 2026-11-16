import { getSchema, Node as TiptapNode } from "@tiptap/core";
import {
  Table as TiptapTable,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import { Node } from "@tiptap/pm/model";
import { StarterKit } from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { splitBlockRange, splitChangeRange } from "./split-change-range";

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

const item = (...content: object[]) => ({ type: "listItem", content });
const bullets = (...content: object[]) => ({ type: "bulletList", content });

// Alpha holds a nested list, the last item is empty
const list = Node.fromJSON(schema, {
  type: "doc",
  content: [
    p("Intro"),
    bullets(
      item(p("Alpha"), bullets(item(p("Nested")))),
      item(p("Bravo")),
      item({ type: "paragraph" }),
    ),
    { type: "image" },
  ],
});

const blocks = (from: number, to: number) =>
  splitBlockRange(list, from, to, special).map((segment) => ({
    from: segment.from,
    to: segment.to,
    node: segment.node?.type.name,
  }));

describe("splitBlockRange", () => {
  it("returns a list item as one whole block", () => {
    expect(blocks(29, 38)).toEqual([{ from: 29, to: 38, node: "listItem" }]);
  });

  it("returns each block of a range over several", () => {
    expect(blocks(8, 38)).toEqual([
      { from: 8, to: 29, node: "listItem" },
      { from: 29, to: 38, node: "listItem" },
    ]);
  });

  it("takes a nested list out of a range that also closes its item", () => {
    expect(blocks(16, 29)).toEqual([{ from: 16, to: 28, node: "bulletList" }]);
  });

  it("returns nothing for a range that starts inside text", () => {
    expect(blocks(11, 38)).toEqual([]);
  });

  it("returns nothing for a range that ends inside text", () => {
    expect(blocks(8, 32)).toEqual([]);
  });

  it("skips a block with nothing to show", () => {
    expect(blocks(29, 42)).toEqual([{ from: 29, to: 38, node: "listItem" }]);
  });

  it("keeps a special node that has no text", () => {
    expect(blocks(38, 44)).toEqual([{ from: 43, to: 44, node: "image" }]);
  });

  it("finds a special node inside a block that holds no text", () => {
    const quoted = Node.fromJSON(schema, {
      type: "doc",
      content: [
        p("Caption"),
        { type: "blockquote", content: [{ type: "image" }] },
        p("End"),
      ],
    });

    expect(
      splitBlockRange(quoted, 0, 12, special).map((segment) => [
        segment.from,
        segment.to,
        segment.node?.type.name,
      ]),
    ).toEqual([
      [0, 9, "paragraph"],
      [10, 11, "image"],
    ]);
  });
});

describe("splitBlockRange in a table", () => {
  const tableSchema = getSchema([
    StarterKit,
    TiptapTable,
    TableRow,
    TableCell,
    TableHeader,
  ]);
  const cell = (text: string) => ({ type: "tableCell", content: [p(text)] });
  const grid = Node.fromJSON(tableSchema, {
    type: "doc",
    content: [
      {
        type: "table",
        content: [
          { type: "tableRow", content: [cell("A"), cell("B"), cell("C")] },
        ],
      },
    ],
  });
  const segments = (from: number, to: number) =>
    splitBlockRange(grid, from, to, new Set()).map((segment) => [
      segment.from,
      segment.to,
      segment.node?.type.name,
    ]);

  it("returns what a removed cell held, never the cell", () => {
    expect(segments(7, 12)).toEqual([[8, 11, "paragraph"]]);
  });

  it("returns a removed row whole", () => {
    expect(segments(1, 18)).toEqual([[1, 18, "tableRow"]]);
  });
});
