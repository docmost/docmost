import { describe, expect, it } from "vitest";
import type { Editor } from "@tiptap/core";
import { getSuggestionItems } from "./menu-items";

const editorWhere = (canInsertTabs: boolean) =>
  ({ can: () => ({ insertTabs: () => canInsertTabs }) }) as unknown as Editor;

const titles = (editor?: Editor) =>
  Object.values(getSuggestionItems({ query: "tabs", editor }))
    .flat()
    .map((item) => item.title);

describe("slash menu", () => {
  it("hides Tabs where tabs can't be inserted, such as inside a tab", () => {
    expect(titles(editorWhere(true))).toContain("Tabs");
    expect(titles(editorWhere(false))).not.toContain("Tabs");
  });
});
