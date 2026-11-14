import { Editor } from "@tiptap/core";
import { Document } from "@tiptap/extension-document";
import { Heading } from "@tiptap/extension-heading";
import { Text } from "@tiptap/extension-text";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { splitTitleIntoPage } from "./title-editor.utils";

const editors: Editor[] = [];

function createEditor(options: Partial<Editor["options"]>) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const editor = new Editor({ element, ...options });
  editors.push(editor);
  return editor;
}

function createTitleEditor(title: string, cursor: number) {
  const editor = createEditor({
    extensions: [
      Document.extend({ content: "heading" }),
      Heading.configure({ levels: [1] }),
      Text,
    ],
    content: title,
  });
  // position 1 is the start of the heading text
  editor.commands.setTextSelection(1 + cursor);
  return editor;
}

function createPageEditor() {
  return createEditor({
    extensions: [StarterKit],
    content: "<p>Body</p>",
  });
}

function blockTexts(editor: Editor) {
  const texts: string[] = [];
  editor.state.doc.forEach((node) => texts.push(node.textContent));
  return texts;
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  document.body.innerHTML = "";
});

describe("splitTitleIntoPage", () => {
  it("moves the text after the cursor into a new first paragraph of the page", () => {
    const titleEditor = createTitleEditor("Alpha Beta", "Alpha ".length);
    const pageEditor = createPageEditor();

    expect(splitTitleIntoPage(titleEditor, pageEditor)).toBe(true);

    expect(titleEditor.getText()).toBe("Alpha ");
    expect(blockTexts(pageEditor)).toEqual(["Beta", "Body"]);
  });

  it("adds an empty first paragraph when the cursor is at the end of the title", () => {
    const titleEditor = createTitleEditor("Alpha", "Alpha".length);
    const pageEditor = createPageEditor();

    expect(splitTitleIntoPage(titleEditor, pageEditor)).toBe(true);

    expect(titleEditor.getText()).toBe("Alpha");
    expect(blockTexts(pageEditor)).toEqual(["", "Body"]);
  });

  it("keeps the whole title when the page editor is already destroyed", () => {
    const titleEditor = createTitleEditor("Alpha Beta", "Alpha ".length);
    const pageEditor = createPageEditor();
    pageEditor.destroy();

    expect(splitTitleIntoPage(titleEditor, pageEditor)).toBe(false);

    expect(titleEditor.getText()).toBe("Alpha Beta");
  });
});
