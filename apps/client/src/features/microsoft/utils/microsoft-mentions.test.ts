import {
  IntegrationMention,
  MicrosoftFile,
  type MicrosoftFileItem,
} from "@docmost/editor-ext";
import { Editor, type JSONContent } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { replaceMicrosoftFileWithMentions } from "./microsoft-mentions";

const a: MicrosoftFileItem = {
  driveId: "drive-1",
  itemId: "item-a",
  webUrl: "https://contoso.sharepoint.com/sites/team/a.docx",
  name: "a.docx",
};
const b: MicrosoftFileItem = {
  driveId: "drive-1",
  itemId: "item-b",
  webUrl: "https://contoso.sharepoint.com/sites/team/b.xlsx",
  name: "b.xlsx",
};

const text = (value: string): JSONContent => ({ type: "text", text: value });
const paragraph = (...content: JSONContent[]): JSONContent => ({
  type: "paragraph",
  ...(content.length && { content }),
});
const embed = (...items: MicrosoftFileItem[]): JSONContent => ({
  type: "microsoftFile",
  attrs: { items },
});
const mention = (item: MicrosoftFileItem): JSONContent => ({
  type: "integrationMention",
  attrs: { url: item.webUrl, provider: "microsoft_365" },
});
const mentionParagraph = (item: MicrosoftFileItem) =>
  paragraph(mention(item), text(" "));
const mentionsList: JSONContent = {
  type: "bulletList",
  content: [a, b].map((item) => ({
    type: "listItem",
    content: [mentionParagraph(item)],
  })),
};

let activeEditor: Editor;
afterEach(() => activeEditor?.destroy());

function createEditor(...content: JSONContent[]) {
  activeEditor = new Editor({
    extensions: [
      StarterKit.configure({ trailingNode: false }),
      IntegrationMention,
      MicrosoftFile,
    ],
    content: { type: "doc", content },
  });
  return activeEditor;
}

describe("replaceMicrosoftFileWithMentions", () => {
  it("turns an embed with two files into a bullet list with one mention per item", () => {
    const editor = createEditor(embed(a, b));

    expect(replaceMicrosoftFileWithMentions(editor, 0, [a, b])).toBe(true);
    expect(editor.getJSON().content).toEqual([mentionsList]);
  });

  it("turns an embed with one file into a paragraph with its mention", () => {
    const editor = createEditor(embed(a));

    expect(replaceMicrosoftFileWithMentions(editor, 0, [a])).toBe(true);
    expect(editor.getJSON().content).toEqual([mentionParagraph(a)]);
  });

  it("fills the empty placeholder from the items it is given", () => {
    const editor = createEditor(embed());

    expect(replaceMicrosoftFileWithMentions(editor, 0, [a, b])).toBe(true);
    expect(editor.getJSON().content).toEqual([mentionsList]);
  });

  it("keeps the blocks around the embed", () => {
    const editor = createEditor(
      paragraph(text("before")),
      embed(a, b),
      paragraph(text("after")),
    );
    const embedPos = editor.state.doc.child(0).nodeSize;

    expect(replaceMicrosoftFileWithMentions(editor, embedPos, [a, b])).toBe(
      true,
    );
    expect(editor.getJSON().content).toEqual([
      paragraph(text("before")),
      mentionsList,
      paragraph(text("after")),
    ]);
  });

  it("converts an embed inside a blockquote", () => {
    const editor = createEditor({
      type: "blockquote",
      content: [embed(a, b)],
    });

    expect(replaceMicrosoftFileWithMentions(editor, 1, [a, b])).toBe(true);
    expect(editor.getJSON().content).toEqual([
      { type: "blockquote", content: [mentionsList] },
    ]);
  });

  it.each([
    ["one file", [a]],
    ["two files", [a, b]],
  ])("places the cursor after the last mention for %s", (_label, items) => {
    const editor = createEditor(
      paragraph(text("before")),
      embed(...items),
      paragraph(text("after")),
    );
    const embedPos = editor.state.doc.child(0).nodeSize;

    replaceMicrosoftFileWithMentions(editor, embedPos, items);

    const { empty, $from } = editor.state.selection;
    expect(empty).toBe(true);
    expect($from.parent.toJSON()).toEqual(
      mentionParagraph(items[items.length - 1]),
    );
    expect($from.parentOffset).toBe($from.parent.content.size);
  });

  it("restores the embed on undo", () => {
    const editor = createEditor(embed(a, b));
    const original = editor.getJSON();

    expect(replaceMicrosoftFileWithMentions(editor, 0, [a, b])).toBe(true);
    expect(editor.commands.undo()).toBe(true);
    expect(editor.getJSON()).toEqual(original);
  });

  it("applies the change in a single transaction", () => {
    const editor = createEditor(embed(a, b));
    const onTransaction = vi.fn();
    editor.on("transaction", onTransaction);

    replaceMicrosoftFileWithMentions(editor, 0, [a, b]);

    expect(onTransaction).toHaveBeenCalledTimes(1);
  });

  it("returns false for a position that is not a microsoftFile", () => {
    const editor = createEditor(paragraph(text("before")), embed(a, b));
    const original = editor.getJSON();

    expect(replaceMicrosoftFileWithMentions(editor, 0, [a, b])).toBe(false);
    expect(editor.getJSON()).toEqual(original);
  });

  it("returns false for an empty item list", () => {
    const editor = createEditor(embed(a, b));
    const original = editor.getJSON();

    expect(replaceMicrosoftFileWithMentions(editor, 0, [])).toBe(false);
    expect(editor.getJSON()).toEqual(original);
  });
});
