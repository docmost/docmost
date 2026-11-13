import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { TextSelection } from "@tiptap/pm/state";
import { Heading } from "@docmost/editor-ext";
import { afterEach, describe, expect, it } from "vitest";

let editor: Editor | null = null;

function createEditor(content: object[]) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  editor = new Editor({
    element,
    extensions: [StarterKit.configure({ heading: false }), Heading],
    content: { type: "doc", content },
  });
  return editor;
}

const heading = (text: string) => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
});
const paragraph = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

const linkButtons = (e: Editor) => [...e.view.dom.querySelectorAll(".link-btn")];

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = "";
});

describe("heading link button", () => {
  it("renders one button inside each heading longer than one character", () => {
    const e = createEditor([heading("Intro"), paragraph("text"), heading("A")]);

    const buttons = linkButtons(e);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].parentElement?.tagName).toBe("H2");
  });

  it("keeps the same button elements when only the selection changes", () => {
    const e = createEditor([heading("Intro"), paragraph("text"), heading("Usage")]);
    const before = linkButtons(e);

    e.view.dispatch(e.state.tr.setSelection(TextSelection.create(e.state.doc, 10)));

    expect(linkButtons(e)).toEqual(before);
  });

  it("adds a button when a heading is inserted", () => {
    const e = createEditor([heading("Intro"), paragraph("text")]);

    e.commands.insertContentAt(e.state.doc.content.size, heading("Usage"));

    expect(linkButtons(e)).toHaveLength(2);
  });
});
