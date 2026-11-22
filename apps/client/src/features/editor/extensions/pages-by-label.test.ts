import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { PagesByLabel, pagesByLabelSettingsKey } from "@docmost/editor-ext";

const editors: Editor[] = [];
function createEditor(content?: string) {
  const editor = new Editor({
    extensions: [StarterKit, PagesByLabel],
    content,
  });
  editors.push(editor);
  return editor;
}
afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()));

describe("Pages by label", () => {
  it("round-trips filters and heading without serializing live results", () => {
    const editor = createEditor();
    editor.commands.insertPagesByLabel({
      labels: [" Release Guide ", "guide"],
      excludeLabels: ["Draft"],
      match: "all",
      heading: "Rollout",
    });
    const html = editor.getHTML();
    expect(html).toContain('data-type="pages-by-label"');
    expect(html).toContain(">Rollout</div>");
    const copy = createEditor(html);
    expect(copy.getJSON().content[0].attrs).toMatchObject({
      labels: ["release-guide", "guide"],
      excludeLabels: ["draft"],
      match: "all",
      heading: "Rollout",
      scope: "current",
      limit: 15,
    });
  });

  it.each([
    "{",
    '{"labels":["guide"],"excludeLabels":"draft"}',
    '{"labels":["guide"],"match":"future-mode"}',
    '{"labels":["guide"],"scope":"spaces","spaceIds":["unknown"]}',
  ])(
    "leaves the block unconfigured when its filters are malformed",
    (config) => {
      const div = document.createElement("div");
      div.dataset.type = "pages-by-label";
      div.dataset.config = config;
      div.setAttribute("labels", "guide");
      expect(
        createEditor(div.outerHTML).getJSON().content[0].attrs.labels,
      ).toEqual([]);
    },
  );

  it("only requests settings for the locally inserted empty block", () => {
    const editor = createEditor();
    editor.can().insertPagesByLabel();
    expect(pagesByLabelSettingsKey.getState(editor.state)).toBeNull();
    editor.commands.insertPagesByLabel();
    expect(pagesByLabelSettingsKey.getState(editor.state)).toBe(0);
    expect(
      pagesByLabelSettingsKey.getState(createEditor(editor.getHTML()).state),
    ).toBeNull();
  });
});
