import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import {
  htmlToMarkdown,
  ItemsByLabel,
  itemsByLabelSettingsKey,
} from "@docmost/editor-ext";

const editors: Editor[] = [];
function createEditor(content?: string) {
  const editor = new Editor({
    extensions: [StarterKit, ItemsByLabel],
    content,
  });
  editors.push(editor);
  return editor;
}
afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()));

describe("Pages by label", () => {
  it("round-trips filters and heading without serializing live results", () => {
    const editor = createEditor();
    editor.commands.insertItemsByLabel({
      labels: [" Release Guide ", "guide"],
      excludeLabels: ["Draft"],
      match: "all",
      heading: "Rollout",
    });
    const html = editor.getHTML();
    expect(html).toContain('data-type="items-by-label"');
    expect(html).toContain(">Rollout</div>");
    const copy = createEditor(html);
    const block = editor.getJSON().content[0];
    expect(block).toMatchObject({
      type: "itemsByLabel",
      attrs: {
        labels: ["release-guide", "guide"],
        excludeLabels: ["draft"],
        match: "all",
        heading: "Rollout",
        scope: "workspace",
        limit: 15,
      },
    });
    expect(copy.getJSON().content[0]).toEqual(block);
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
      div.dataset.type = "items-by-label";
      div.dataset.config = config;
      div.setAttribute("labels", "guide");
      expect(
        createEditor(div.outerHTML).getJSON().content[0].attrs.labels,
      ).toEqual([]);
    },
  );

  it("keeps only the block's heading in Markdown, including tables preserved as HTML", () => {
    const editor = createEditor();
    editor.commands.insertItemsByLabel({
      heading: "Release guides",
      labels: ["confidential-filter"],
    });
    const blockHtml = editor.getHTML();
    const blank =
      '<div data-type="items-by-label" data-config=\'{"labels":["hidden-label"]}\'></div>';
    const richTable =
      "<table><tr><td><h2>Reference</h2></td><td>" +
      blockHtml +
      blank +
      "</td></tr></table>";

    expect(htmlToMarkdown(blockHtml)).toBe("Release guides");
    const markdown = htmlToMarkdown(richTable);
    expect(markdown).toContain("<table");
    expect(markdown).toContain("<h2>Reference</h2>");
    expect(markdown).toContain("Release guides");
    expect(markdown).toContain("Pages by label");
    expect(markdown).not.toMatch(
      /data-config|data-type="items-by-label"|confidential-filter|hidden-label/,
    );
    expect(createEditor(blockHtml).getJSON().content[0].attrs.labels).toEqual([
      "confidential-filter",
    ]);
  });

  it("keeps an explicitly empty heading on insert and import", () => {
    const editor = createEditor();
    editor.commands.insertItemsByLabel({ heading: "" });
    expect(editor.state.doc.firstChild.attrs.heading).toBe("");
    expect(
      createEditor(editor.getHTML()).state.doc.firstChild.attrs.heading,
    ).toBe("");
    expect(
      createEditor('<div data-type="items-by-label"></div>').state.doc
        .firstChild.attrs.heading,
    ).toBe("");
  });

  it("only requests settings for the locally inserted empty block", () => {
    const editor = createEditor();
    editor.can().insertItemsByLabel();
    expect(itemsByLabelSettingsKey.getState(editor.state)).toBeNull();
    editor.commands.insertItemsByLabel();
    expect(itemsByLabelSettingsKey.getState(editor.state)).toBe(0);
    expect(editor.state.doc.firstChild.attrs.heading).toBe("Pages by label");
    expect(
      itemsByLabelSettingsKey.getState(createEditor(editor.getHTML()).state),
    ).toBeNull();
  });
});
