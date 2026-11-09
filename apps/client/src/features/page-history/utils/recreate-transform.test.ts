import { getSchema } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";
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

describe("recreateTransform", () => {
  it("diffs a line break that became bold text", () => {
    const before = paragraph([{ type: "text", text: "Hello" }, { type: "hardBreak" }]);
    const after = paragraph([
      { type: "text", text: "Hello" },
      { type: "text", text: " world", marks: [{ type: "bold" }] },
    ]);

    expect(diff(before, after).doc.eq(after)).toBe(true);
  });
});
