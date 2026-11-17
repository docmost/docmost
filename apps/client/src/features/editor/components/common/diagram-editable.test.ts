import type { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { canEditDiagram } from "./diagram-editable";

const editor = (isEditable: boolean, storage: object) =>
  ({ isEditable, storage }) as unknown as Editor;

describe("canEditDiagram", () => {
  it("allows editing in an editable editor that has a page", () => {
    expect(canEditDiagram(editor(true, { pageId: "page-1" }))).toBe(true);
  });

  it("refuses where the editor has no page to save the diagram to", () => {
    expect(canEditDiagram(editor(true, {}))).toBe(false);
  });

  it("refuses in a read-only editor", () => {
    expect(canEditDiagram(editor(false, { pageId: "page-1" }))).toBe(false);
  });
});
