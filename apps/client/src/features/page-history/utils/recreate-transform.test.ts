import { getSchema } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";
import { ReplaceStep } from "@tiptap/pm/transform";
import { StarterKit } from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { recreateTransform } from "@docmost/editor-ext";

const schema = getSchema([StarterKit]);

const paragraph = (content: object[]) =>
  Node.fromJSON(schema, { type: "doc", content: [{ type: "paragraph", content }] });

// same options as the history and review diff
const diff = (before: Node, after: Node) =>
  recreateTransform(before, after, {
    complexSteps: false,
    wordDiffs: true,
    simplifyDiff: true,
  });

const text = (value: string, marks?: object[]) =>
  marks ? { type: "text", text: value, marks } : { type: "text", text: value };
const block = (type: string, value: string, attrs?: object) =>
  attrs
    ? { type, attrs, content: [text(value)] }
    : { type, content: [text(value)] };
const item = (value: string) => ({
  type: "listItem",
  content: [block("paragraph", value)],
});
const doc = (content: object[]) =>
  Node.fromJSON(schema, { type: "doc", content });

// edits spread over the page: attrs, words, list items, code, marks, a new block
const editedPage = () => ({
  before: doc([
    block("heading", "Title", { level: 1 }),
    block("paragraph", "The quick brown fox jumps over the lazy dog."),
    { type: "bulletList", content: [item("one"), item("two"), item("three")] },
    block("paragraph", "This paragraph stays the same."),
    block("codeBlock", "const a = 1;"),
    block("paragraph", "Last line."),
  ]),
  after: doc([
    block("heading", "Title", { level: 2 }),
    block("paragraph", "The quick red fox jumped over the lazy dog."),
    { type: "bulletList", content: [item("one"), item("three"), item("four")] },
    block("paragraph", "This paragraph stays the same."),
    block("codeBlock", "const a = 2;"),
    { type: "paragraph", content: [text("Last line.", [{ type: "bold" }])] },
    block("paragraph", "Added at the end."),
  ]),
});

describe("recreateTransform", () => {
  it("diffs a line break that became bold text", () => {
    const before = paragraph([{ type: "text", text: "Hello" }, { type: "hardBreak" }]);
    const after = paragraph([
      { type: "text", text: "Hello" },
      { type: "text", text: " world", marks: [{ type: "bold" }] },
    ]);

    expect(diff(before, after).doc.eq(after)).toBe(true);
  });

  it("diffs a list that became a paragraph", () => {
    const before = doc([{ type: "bulletList", content: [item("one")] }]);
    const after = doc([block("paragraph", "one")]);

    expect(diff(before, after).doc.eq(after)).toBe(true);
  });

  it("rebuilds the new doc from edits across the page", () => {
    const { before, after } = editedPage();

    expect(diff(before, after).doc.eq(after)).toBe(true);
  });

  it("keeps its steps for edits across the page", () => {
    const { before, after } = editedPage();
    const steps = diff(before, after).steps.map((step) => {
      const { from, to, slice } = step as ReplaceStep;
      return `${from}-${to} ${slice.content}`;
    });

    expect(steps).toEqual([
      '0-7 <heading("Title")>',
      '18-23 <"red">',
      '26-31 <"jumped">',
      "63-70 <>",
      '69-69 <listItem(paragraph("four"))>',
      '121-122 <"2">',
      '125-135 <bold("Last line.")>',
      '136-136 <paragraph("Added at the end.")>',
    ]);
  });

  it("leaves the docs it compares unchanged", () => {
    const { before, after } = editedPage();
    const json = () => JSON.stringify([before.toJSON(), after.toJSON()]);
    const original = json();

    diff(before, after);

    expect(json()).toBe(original);
  });
});
