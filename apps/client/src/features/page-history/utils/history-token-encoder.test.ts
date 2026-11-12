import {
  extensions as coreExtensions,
  getSchema,
  Node as TiptapNode,
} from "@tiptap/core";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import { ChangeSet, simplifyChanges } from "@tiptap/pm/changeset";
import { Node } from "@tiptap/pm/model";
import { StarterKit } from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { Comment, recreateTransform, UniqueID } from "@docmost/editor-ext";
import { createHistoryTokenEncoder } from "./history-token-encoder";

const Image = TiptapNode.create({
  name: "image",
  group: "block",
  atom: true,
  addAttributes: () => ({ src: { default: null } }),
  renderHTML: () => ["img"],
});

const schema = getSchema([
  StarterKit,
  coreExtensions.TextDirection.configure({ direction: "auto" }),
  UniqueID.configure({ types: ["heading", "paragraph"] }),
  Comment,
  Image,
  Table,
  TableRow,
  TableCell,
  TableHeader,
]);

const doc = (content: object[]) =>
  Node.fromJSON(schema, { type: "doc", content });
const text = (value: string, marks?: object[]) =>
  marks ? { type: "text", text: value, marks } : { type: "text", text: value };
const paragraph = (...content: object[]) => ({ type: "paragraph", content });
const heading = (level: number, value: string) => ({
  type: "heading",
  attrs: { level },
  content: [text(value)],
});
const link = (href: string) => [{ type: "link", attrs: { href } }];

// same steps and changes as the history view
function changes(before: Node, after: Node) {
  const tr = recreateTransform(before, after, {
    complexSteps: false,
    wordDiffs: true,
    simplifyDiff: true,
  });
  const changeSet = ChangeSet.create(
    before,
    undefined,
    createHistoryTokenEncoder(),
  ).addSteps(tr.doc, tr.mapping.maps, []);
  return simplifyChanges(changeSet.changes, after).map(
    ({ fromA, toA, fromB, toB }) => ({ fromA, toA, fromB, toB }),
  );
}

describe("createHistoryTokenEncoder", () => {
  it("finds a word that only became bold", () => {
    const before = doc([paragraph(text("Make this word bold"))]);
    const after = doc([
      paragraph(
        text("Make this "),
        text("word", [{ type: "bold" }]),
        text(" bold"),
      ),
    ]);

    expect(changes(before, after)).toEqual([
      { fromA: 11, toA: 15, fromB: 11, toB: 15 },
    ]);
  });

  it("finds a link whose target changed", () => {
    const before = doc([paragraph(text("see "), text("docs", link("/a")))]);
    const after = doc([paragraph(text("see "), text("docs", link("/b")))]);

    expect(changes(before, after)).toEqual([
      { fromA: 5, toA: 9, fromB: 5, toB: 9 },
    ]);
  });

  it("finds a heading whose level changed", () => {
    const before = doc([heading(1, "Title")]);
    const after = doc([heading(2, "Title")]);

    expect(changes(before, after)).toEqual([
      { fromA: 0, toA: 1, fromB: 0, toB: 1 },
    ]);
  });

  it("finds an image whose source changed", () => {
    const before = doc([paragraph(text("a")), { type: "image", attrs: { src: "/x" } }]);
    const after = doc([paragraph(text("a")), { type: "image", attrs: { src: "/y" } }]);

    expect(changes(before, after)).toEqual([
      { fromA: 3, toA: 4, fromB: 3, toB: 4 },
    ]);
  });

  it("ignores block ids, text direction and comments", () => {
    const before = doc([
      { type: "paragraph", attrs: { id: "one", dir: "auto" }, content: [text("keep")] },
    ]);
    const after = doc([
      {
        type: "paragraph",
        attrs: { id: "two", dir: "rtl" },
        content: [text("keep", [{ type: "comment", attrs: { commentId: "c1" } }])],
      },
    ]);

    expect(changes(before, after)).toEqual([]);
  });

  it("ignores column widths", () => {
    const table = (colwidth: number) => ({
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              attrs: { colwidth: [colwidth] },
              content: [paragraph(text("cell"))],
            },
          ],
        },
      ],
    });

    expect(changes(doc([table(100)]), doc([table(200)]))).toEqual([]);
  });

  it("still finds text edits", () => {
    const before = doc([paragraph(text("Fix a typo hree"))]);
    const after = doc([paragraph(text("Fix a typo here"))]);

    expect(changes(before, after)).toEqual([
      { fromA: 12, toA: 16, fromB: 12, toB: 16 },
    ]);
  });
});
