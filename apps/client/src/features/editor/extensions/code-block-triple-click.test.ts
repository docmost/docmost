import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import { CustomCodeBlock } from "@docmost/editor-ext";
import { afterEach, describe, expect, it, vi } from "vitest";

let editor: Editor | null = null;

function createEditor(content: object[]) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({ codeBlock: false, trailingNode: false }),
      CustomCodeBlock.configure({ lowlight: createLowlight(common) }),
    ],
    content: { type: "doc", content },
  });
  return editor;
}

function codeBlock(text: string) {
  return {
    type: "codeBlock",
    attrs: { language: "javascript" },
    content: text ? [{ type: "text", text }] : [],
  };
}

// position of `offset` within the text of the first code block
function codePos(e: Editor, offset: number) {
  let pos = -1;
  e.state.doc.descendants((node, nodePos) => {
    if (pos === -1 && node.type.name === "codeBlock") pos = nodePos + 1;
    return false;
  });
  return pos + offset;
}

function tripleClick(e: Editor, pos: number, button = 0) {
  const event = new MouseEvent("mousedown", { button });
  return !!e.view.someProp("handleTripleClick", (handler) =>
    handler(e.view, pos, event),
  );
}

// ProseMirror reads the drop position from layout, which jsdom lacks
function dragTo(e: Editor, pos: number, buttons = 1) {
  vi.spyOn(e.view, "posAtCoords").mockReturnValue({ pos, inside: -1 });
  document.dispatchEvent(new MouseEvent("mousemove", { buttons }));
}

function selectedText(e: Editor) {
  const { from, to } = e.state.selection;
  return e.state.doc.textBetween(from, to, "\n");
}

const CODE = "const a = 1;\nconst b = 2;\nconst c = 3;";

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = "";
});

describe("triple click in a code block", () => {
  it("selects the clicked line", () => {
    const e = createEditor([codeBlock(CODE)]);

    expect(tripleClick(e, codePos(e, CODE.indexOf("b =")))).toBe(true);
    expect(selectedText(e)).toBe("const b = 2;");
  });

  it("selects the first and the last line", () => {
    const e = createEditor([codeBlock(CODE)]);

    tripleClick(e, codePos(e, 2));
    expect(selectedText(e)).toBe("const a = 1;");

    tripleClick(e, codePos(e, CODE.length));
    expect(selectedText(e)).toBe("const c = 3;");
  });

  it("selects the line that ends at the click", () => {
    const e = createEditor([codeBlock(CODE)]);

    tripleClick(e, codePos(e, CODE.indexOf("\n")));
    expect(selectedText(e)).toBe("const a = 1;");
  });

  it("does not include the line break", () => {
    const e = createEditor([codeBlock(CODE)]);

    tripleClick(e, codePos(e, CODE.indexOf("b =")));
    const { from, to } = e.state.selection;
    expect(to - from).toBe("const b = 2;".length);
  });

  it("collapses the selection on an empty line", () => {
    const code = "\nfirst\n\nlast";
    const e = createEditor([codeBlock(code)]);

    tripleClick(e, codePos(e, 0));
    expect(e.state.selection.from).toBe(codePos(e, 0));
    expect(e.state.selection.empty).toBe(true);

    const emptyLine = code.indexOf("\n\n") + 1;
    tripleClick(e, codePos(e, emptyLine));
    expect(e.state.selection.from).toBe(codePos(e, emptyLine));
    expect(e.state.selection.empty).toBe(true);
  });

  it("selects the whole text of a single line block", () => {
    const e = createEditor([codeBlock("npm install")]);

    tripleClick(e, codePos(e, 4));
    expect(selectedText(e)).toBe("npm install");
  });

  it("leaves other blocks to the default triple click", () => {
    const e = createEditor([
      {
        type: "paragraph",
        content: [{ type: "text", text: "line one" }],
      },
      codeBlock(CODE),
    ]);

    expect(tripleClick(e, 3)).toBe(false);
  });

  it("ignores buttons other than the primary one", () => {
    const e = createEditor([codeBlock(CODE)]);

    expect(tripleClick(e, codePos(e, 2), 2)).toBe(false);
  });

  describe("dragging after the triple click", () => {
    it("extends the selection by lines", () => {
      const e = createEditor([codeBlock(CODE)]);

      tripleClick(e, codePos(e, 2));
      dragTo(e, codePos(e, CODE.indexOf("c =")));

      expect(selectedText(e)).toBe(CODE);
      expect(e.state.selection.anchor).toBe(codePos(e, 0));
    });

    it("extends upwards from the end of the clicked line", () => {
      const e = createEditor([codeBlock(CODE)]);

      tripleClick(e, codePos(e, CODE.indexOf("c =")));
      dragTo(e, codePos(e, CODE.indexOf("b =")));

      expect(selectedText(e)).toBe("const b = 2;\nconst c = 3;");
      expect(e.state.selection.anchor).toBe(codePos(e, CODE.length));
    });

    it("extends over whole blocks outside the code block", () => {
      const e = createEditor([
        codeBlock(CODE),
        { type: "paragraph", content: [{ type: "text", text: "after" }] },
      ]);
      const paragraphPos = e.state.doc.content.size - 3;

      tripleClick(e, codePos(e, CODE.indexOf("c =")));
      dragTo(e, paragraphPos);

      expect(selectedText(e)).toBe("const c = 3;\nafter");
    });

    it("stops when the mouse is released", () => {
      const e = createEditor([codeBlock(CODE)]);

      tripleClick(e, codePos(e, 2));
      document.dispatchEvent(new MouseEvent("mouseup"));
      dragTo(e, codePos(e, CODE.indexOf("c =")));

      expect(selectedText(e)).toBe("const a = 1;");
    });

    it("stops on a move without a pressed button", () => {
      const e = createEditor([codeBlock(CODE)]);

      tripleClick(e, codePos(e, 2));
      dragTo(e, codePos(e, CODE.indexOf("b =")), 0);
      dragTo(e, codePos(e, CODE.indexOf("c =")));

      expect(selectedText(e)).toBe("const a = 1;");
    });
  });
});
