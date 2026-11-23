import { getSchema } from "@tiptap/core";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import { Node } from "@tiptap/pm/model";
import { StarterKit } from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { blockAnchor } from "./block-anchor";

const schema = getSchema([StarterKit, Table, TableRow, TableCell, TableHeader]);

const p = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const cell = (text: string) => ({ type: "tableCell", content: [p(text)] });

// one row of three cells: A at 2-7, B at 7-12, C at 12-17
const doc = Node.fromJSON(schema, {
  type: "doc",
  content: [
    {
      type: "table",
      content: [
        { type: "tableRow", content: [cell("A"), cell("B"), cell("C")] },
      ],
    },
    p("After"),
  ],
});

describe("blockAnchor", () => {
  it("moves a position between two cells into the cell after it", () => {
    expect(blockAnchor(doc, 7)).toBe(8);
  });

  it("moves a position before the first cell into that cell", () => {
    expect(blockAnchor(doc, 2)).toBe(3);
  });

  it("moves a position after the last cell to the end of that cell", () => {
    expect(blockAnchor(doc, 17)).toBe(16);
  });

  it("leaves a position between rows alone", () => {
    expect(blockAnchor(doc, 18)).toBe(18);
  });

  it("leaves a position between blocks of the page alone", () => {
    expect(blockAnchor(doc, 19)).toBe(19);
  });
});
