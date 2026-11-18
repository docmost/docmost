import type { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { getEditorUploadTarget } from "./upload-target";

const editor = (storage: object) => ({ storage }) as unknown as Editor;

describe("getEditorUploadTarget", () => {
  it("prefers the page when both are set", () => {
    expect(
      getEditorUploadTarget(editor({ pageId: "p1", templateId: "t1" })),
    ).toEqual({ pageId: "p1" });
  });

  it("falls back to the template", () => {
    expect(getEditorUploadTarget(editor({ templateId: "t1" }))).toEqual({
      templateId: "t1",
    });
  });

  it("returns null when neither is set", () => {
    expect(getEditorUploadTarget(editor({}))).toBeNull();
  });
});
