import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { StarterKit } from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { TiptapCode } from "./code";

function createEditor(content: object[]) {
  const element = document.createElement("div");
  document.body.appendChild(element);

  return new Editor({
    element,
    extensions: [StarterKit.configure({ code: false }), TiptapCode],
    content: { type: "doc", content },
  });
}

function pressKey(editor: Editor, init: KeyboardEventInit) {
  editor.view.dom.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }),
  );
}

describe("TiptapCode", () => {
  it("toggles inline code with Mod-e", () => {
    const editor = createEditor([
      { type: "paragraph", content: [{ type: "text", text: "code me" }] },
    ]);
    editor.commands.setTextSelection({ from: 1, to: 8 });

    pressKey(editor, { key: "e", code: "KeyE", keyCode: 69, ctrlKey: true });

    expect(editor.state.doc.firstChild?.firstChild?.marks[0]?.type.name).toBe(
      "code",
    );

    editor.destroy();
  });

  it("leaves inline code when pressing Enter at its end", () => {
    const editor = createEditor([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "before " },
          { type: "text", text: "abc", marks: [{ type: "code" }] },
        ],
      },
    ]);
    const endOfCode = editor.state.doc.firstChild!.nodeSize - 1;
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, endOfCode),
      ),
    );

    pressKey(editor, { key: "Enter", keyCode: 13 });
    editor.view.dispatch(editor.state.tr.insertText("x"));

    expect(editor.state.doc.childCount).toBe(2);
    expect(editor.state.doc.lastChild?.textContent).toBe("x");
    expect(editor.state.doc.lastChild?.firstChild?.marks).toHaveLength(0);

    editor.destroy();
  });
});
