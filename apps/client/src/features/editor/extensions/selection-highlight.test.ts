import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Selection } from "@docmost/editor-ext";
import { afterEach, describe, expect, it } from "vitest";

let editor: Editor | null = null;

function createEditor(paragraphs: number) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  editor = new Editor({
    element,
    extensions: [StarterKit, Selection],
    content: Array.from(
      { length: paragraphs },
      (_, i) => `<p>paragraph number ${i} with a little more text</p>`,
    ).join(""),
  });
  return editor;
}

function blur(e: Editor) {
  e.view.dom.dispatchEvent(new FocusEvent("focus"));
  e.view.dom.dispatchEvent(new FocusEvent("blur"));
}

const highlights = (e: Editor) => e.view.dom.querySelectorAll(".selection");

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = "";
});

describe("selection highlight", () => {
  it("keeps a selection visible while the editor is not focused", () => {
    const e = createEditor(3);
    e.commands.setTextSelection({ from: 1, to: 20 });

    blur(e);

    expect(highlights(e).length).toBeGreaterThan(0);
    expect(highlights(e)[0].textContent).toBe("paragraph number 0 ");
  });

  it("shows no highlight when nothing is selected", () => {
    const e = createEditor(3);
    e.commands.setTextSelection(5);

    blur(e);

    expect(highlights(e)).toHaveLength(0);
  });

  it("does not wrap a very large selection", () => {
    const e = createEditor(800);
    e.commands.selectAll();
    expect(e.state.selection.to - e.state.selection.from).toBeGreaterThan(
      20_000,
    );

    blur(e);

    expect(highlights(e)).toHaveLength(0);
  });
});
