import {
  extensions as coreExtensions,
  getSchema,
  Node as TiptapNode,
} from "@tiptap/core";
import { Highlight } from "@tiptap/extension-highlight";
import { TextAlign } from "@tiptap/extension-text-align";
import { ChangeSet, simplifyChanges } from "@tiptap/pm/changeset";
import { Node } from "@tiptap/pm/model";
import { StarterKit } from "@tiptap/starter-kit";
import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { Comment, recreateTransform, UniqueID } from "@docmost/editor-ext";
import { createHistoryTokenEncoder } from "./history-token-encoder";
import {
  formatChange,
  markChangeLabel,
  nodeChangeLabel,
} from "./format-change";

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
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Highlight.configure({ multicolor: true }),
  Comment,
  Image,
]);

const doc = (content: object[]) =>
  Node.fromJSON(schema, { type: "doc", content });
const node = (json: object) => Node.fromJSON(schema, json);
const text = (value: string, marks?: object[]) =>
  marks ? { type: "text", text: value, marks } : { type: "text", text: value };
const paragraph = (...content: object[]) => ({ type: "paragraph", content });
const heading = (level: number, value: string) => ({
  type: "heading",
  attrs: { level },
  content: [text(value)],
});
const bold = [{ type: "bold" }];
const link = (href: string) => [{ type: "link", attrs: { href } }];
const describeNode = (node: Node) =>
  node.type.name + (node.attrs.level ?? "");

// formatting found in each change the history view shows
function formatChanges(before: Node, after: Node) {
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
  return simplifyChanges(changeSet.changes, after).map((change) => {
    const format = formatChange(before, after, change);
    return (
      format && {
        ...format,
        nodes: format.nodes.map(({ pos, node, oldNode }) => ({
          pos,
          from: describeNode(oldNode),
          to: describeNode(node),
        })),
      }
    );
  });
}

const noMarks = { added: [], removed: [], changed: [] };

describe("formatChange", () => {
  it("finds a word that only became bold", () => {
    const before = doc([paragraph(text("Make this word bold"))]);
    const after = doc([
      paragraph(text("Make this "), text("word", bold), text(" bold")),
    ]);

    expect(formatChanges(before, after)).toEqual([
      { ...noMarks, ranges: [{ from: 11, to: 15 }], nodes: [], added: ["bold"] },
    ]);
  });

  it("covers only the letters whose marks changed", () => {
    const before = doc([paragraph(text("Make it faster"))]);
    const after = doc([
      paragraph(text("Make it "), text("fast", bold), text("er")),
    ]);

    expect(formatChanges(before, after)).toEqual([
      { ...noMarks, ranges: [{ from: 9, to: 13 }], nodes: [], added: ["bold"] },
    ]);
  });

  it("finds a link whose target changed", () => {
    const before = doc([paragraph(text("see "), text("docs", link("/a")))]);
    const after = doc([paragraph(text("see "), text("docs", link("/b")))]);

    expect(formatChanges(before, after)).toEqual([
      { ...noMarks, ranges: [{ from: 5, to: 9 }], nodes: [], changed: ["link"] },
    ]);
  });

  it("finds marks swapped on one word", () => {
    const before = doc([paragraph(text("one "), text("word", bold))]);
    const after = doc([
      paragraph(text("one "), text("word", [{ type: "italic" }])),
    ]);

    expect(formatChanges(before, after)).toEqual([
      {
        ranges: [{ from: 5, to: 9 }],
        nodes: [],
        added: ["italic"],
        removed: ["bold"],
        changed: [],
      },
    ]);
  });

  it("leaves comments out of the marks it reports", () => {
    const before = doc([paragraph(text("one word"))]);
    const after = doc([
      paragraph(
        text("one "),
        text("word", [
          { type: "bold" },
          { type: "comment", attrs: { commentId: "c1" } },
        ]),
      ),
    ]);

    expect(formatChanges(before, after)).toEqual([
      { ...noMarks, ranges: [{ from: 5, to: 9 }], nodes: [], added: ["bold"] },
    ]);
  });

  it("finds a heading whose level changed", () => {
    const before = doc([heading(1, "Title")]);
    const after = doc([heading(2, "Title")]);

    expect(formatChanges(before, after)).toEqual([
      {
        ...noMarks,
        ranges: [],
        nodes: [{ pos: 0, from: "heading1", to: "heading2" }],
      },
    ]);
  });

  it("finds a paragraph that became a heading once", () => {
    const before = doc([paragraph(text("Title"))]);
    const after = doc([heading(2, "Title")]);

    expect(formatChanges(before, after)).toEqual([
      {
        ...noMarks,
        ranges: [],
        nodes: [{ pos: 0, from: "paragraph", to: "heading2" }],
      },
      { ...noMarks, ranges: [], nodes: [] },
    ]);
  });

  it("leaves out an image whose source changed", () => {
    const before = doc([{ type: "image", attrs: { src: "/x" } }]);
    const after = doc([{ type: "image", attrs: { src: "/y" } }]);

    expect(formatChanges(before, after)).toEqual([null]);
  });

  it("leaves out text edits", () => {
    const before = doc([paragraph(text("Fix a typo hree"))]);
    const after = doc([paragraph(text("Fix a typo here"))]);

    expect(formatChanges(before, after)).toEqual([null]);
  });
});

const t = ((key: string, params?: Record<string, unknown>) =>
  key.replace(/{{(\w+)}}/g, (_, name) =>
    String(params?.[name]),
  )) as unknown as TFunction;

describe("markChangeLabel", () => {
  it("names an added mark", () => {
    expect(markChangeLabel({ ...noMarks, added: ["bold"] }, t)).toBe(
      "Bold added",
    );
  });

  it("lists several marks", () => {
    expect(
      markChangeLabel({ ...noMarks, added: ["italic", "underline"] }, t),
    ).toBe("Italic, Underline added");
  });

  it("names a changed link", () => {
    expect(markChangeLabel({ ...noMarks, changed: ["link"] }, t)).toBe(
      "Link changed",
    );
  });

  it("joins added and removed marks", () => {
    expect(
      markChangeLabel({ ...noMarks, added: ["italic"], removed: ["bold"] }, t),
    ).toBe("Italic added; Bold removed");
  });

  it("falls back for marks it can't name", () => {
    expect(markChangeLabel({ ...noMarks, added: ["mystery"] }, t)).toBe(
      "Formatting changed",
    );
  });
});

describe("nodeChangeLabel", () => {
  it("names a heading level change", () => {
    expect(
      nodeChangeLabel(node(heading(1, "Title")), node(heading(2, "Title")), t),
    ).toBe("Heading 1 → Heading 2");
  });

  it("names a paragraph that became a heading", () => {
    expect(
      nodeChangeLabel(node(paragraph(text("Title"))), node(heading(2, "Title")), t),
    ).toBe("Text → Heading 2");
  });

  it("names an alignment change", () => {
    const aligned = (textAlign: string) => ({
      type: "paragraph",
      attrs: { textAlign },
      content: [text("Thanks")],
    });

    expect(nodeChangeLabel(node(aligned("left")), node(aligned("center")), t)).toBe(
      "Align center",
    );
  });

  it("falls back for other attributes", () => {
    const code = (language: string) => ({
      type: "codeBlock",
      attrs: { language },
      content: [text("let a = 1;")],
    });

    expect(
      nodeChangeLabel(node(code("javascript")), node(code("typescript")), t),
    ).toBe("Formatting changed");
  });
});
