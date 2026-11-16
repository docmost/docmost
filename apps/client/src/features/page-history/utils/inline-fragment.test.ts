import { getSchema } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";
import { StarterKit } from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { inlineFragment } from "./inline-fragment";

const schema = getSchema([StarterKit]);

const doc = Node.fromJSON(schema, {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "a " },
        { type: "text", text: "bold", marks: [{ type: "bold" }] },
        { type: "text", text: " b" },
      ],
    },
    { type: "paragraph", content: [{ type: "text", text: "next" }] },
  ],
});

describe("inlineFragment", () => {
  it("keeps the marks of a range inside one paragraph", () => {
    expect(inlineFragment(doc, 3, 7)?.toJSON()).toEqual([
      { type: "text", text: "bold", marks: [{ type: "bold" }] },
    ]);
  });

  it("returns nothing for a range across blocks", () => {
    expect(inlineFragment(doc, 3, 12)).toBeNull();
  });
});
