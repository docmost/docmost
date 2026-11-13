import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Fragment, Node, Slice } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { common, createLowlight } from "lowlight";
import { CustomCodeBlock } from "@docmost/editor-ext";
import { afterEach, describe, expect, it, vi } from "vitest";

let editor: Editor | null = null;

function codeBlock(text: string, language: string | null = "javascript") {
  return {
    type: "codeBlock",
    attrs: { language },
    content: [{ type: "text", text }],
  };
}

function createEditor(content: object[]) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const lowlight = createLowlight(common);
  // tiptap copies the options object but keeps its functions, so the counter goes in up front
  const highlight = vi.fn(lowlight.highlight);
  editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({ codeBlock: false, trailingNode: false }),
      CustomCodeBlock.configure({ lowlight: { ...lowlight, highlight } }),
    ],
    content: { type: "doc", content },
  });
  highlight.mockClear();
  return { editor, highlight };
}

function lowlightPlugin(e: Editor) {
  return e.state.plugins.find((plugin) =>
    (plugin as any).key.startsWith("lowlight$"),
  );
}

// text of every highlighted token, per code block
function highlighted(e: Editor, className: string) {
  const decorations = lowlightPlugin(e)
    .getState(e.state)
    .find()
    .sort((a, b) => a.from - b.from);
  const blocks: string[][] = [];
  e.state.doc.forEach((node, offset) => {
    if (node.type.name !== "codeBlock") return;
    blocks.push(
      decorations
        .filter(
          (decoration) =>
            decoration.from > offset &&
            decoration.to < offset + node.nodeSize &&
            decoration.type.attrs.class.split(" ").includes(className),
        )
        .map((decoration) =>
          e.state.doc.textBetween(decoration.from, decoration.to),
        ),
    );
  });
  return blocks;
}

function blockStart(e: Editor, index: number) {
  let offset = 0;
  for (let i = 0; i < index; i++) offset += e.state.doc.child(i).nodeSize;
  return offset + 1;
}

afterEach(() => {
  vi.restoreAllMocks();
  editor?.destroy();
  editor = null;
  document.body.innerHTML = "";
});

describe("code block highlighting", () => {
  it("highlights each code block in its language", () => {
    const { editor: e } = createEditor([
      codeBlock("const a = 1;"),
      codeBlock("def run():\n    return None", "python"),
    ]);

    expect(highlighted(e, "hljs-keyword")).toEqual([
      ["const"],
      ["def", "return"],
    ]);
  });

  it("highlights the new text of the block being typed in", () => {
    const { editor: e } = createEditor([
      codeBlock("a = 1;"),
      codeBlock("let b = 2;"),
    ]);

    e.commands.insertContentAt(blockStart(e, 0), "const ");

    expect(e.state.doc.child(0).textContent).toBe("const a = 1;");
    expect(highlighted(e, "hljs-keyword")).toEqual([["const"], ["let"]]);
  });

  it("highlights only the block that was typed in", () => {
    const blocks = Array.from({ length: 40 }, (_, i) =>
      codeBlock(`const value${i} = ${i};`),
    );
    const { editor: e, highlight } = createEditor(blocks);

    e.commands.insertContentAt(blockStart(e, 20), "export ");

    expect(highlight).toHaveBeenCalledTimes(1);
    const keywords = highlighted(e, "hljs-keyword");
    expect(keywords).toHaveLength(40);
    expect(keywords[20]).toEqual(["export", "const"]);
    expect(keywords.filter((k) => k.join() === "const")).toHaveLength(39);
  });

  it("keeps every block highlighted when a block above is removed", () => {
    const { editor: e } = createEditor([
      codeBlock("const a = 1;"),
      codeBlock("let b = 2;"),
      codeBlock("var c = 3;"),
    ]);

    e.commands.deleteRange({ from: 0, to: e.state.doc.child(0).nodeSize });

    expect(highlighted(e, "hljs-keyword")).toEqual([["let"], ["var"]]);
  });

  it("highlights a block again when its language changes", () => {
    const { editor: e } = createEditor([codeBlock("def run(): pass", "plaintext")]);
    expect(highlighted(e, "hljs-keyword")).toEqual([[]]);

    e.commands.setTextSelection(blockStart(e, 0));
    e.commands.updateAttributes("codeBlock", { language: "python" });

    expect(highlighted(e, "hljs-keyword")).toEqual([["def", "pass"]]);
  });

  it("highlights only the changed block when the whole document is replaced", () => {
    const blocks = Array.from({ length: 40 }, (_, i) =>
      codeBlock(`const value${i} = ${i};`),
    );
    const { editor: e, highlight } = createEditor(blocks);

    // a remote change arrives as one step over the whole document that keeps the unchanged blocks
    const { doc, schema } = e.state;
    const children = [];
    doc.forEach((node, _offset, index) => {
      children.push(
        index === 7
          ? node.type.create(node.attrs, schema.text("let remote = true;"))
          : node,
      );
    });
    e.view.dispatch(
      e.state.tr.replace(
        0,
        doc.content.size,
        new Slice(Fragment.from(children), 0, 0),
      ),
    );

    expect(highlight).toHaveBeenCalledTimes(1);
    const keywords = highlighted(e, "hljs-keyword");
    expect(keywords).toHaveLength(40);
    expect(keywords[7]).toEqual(["let"]);
    expect(keywords.filter((k) => k.join() === "const")).toHaveLength(39);
  });

  it("highlights a block that was moved to another place", () => {
    const { editor: e } = createEditor([
      codeBlock("const a = 1;"),
      { type: "paragraph", content: [{ type: "text", text: "between" }] },
      codeBlock("let b = 2;"),
    ]);

    // cut the first block and drop the same node at the end
    const first = e.state.doc.child(0);
    const tr = e.state.tr.delete(0, first.nodeSize);
    tr.insert(tr.doc.content.size, first);
    e.view.dispatch(tr);

    expect(e.state.doc.lastChild).toBe(first);
    expect(highlighted(e, "hljs-keyword")).toEqual([["let"], ["const"]]);
  });

  it("does not look for code blocks when only the selection moves", () => {
    const { editor: e } = createEditor([
      codeBlock("const a = 1;"),
      { type: "paragraph", content: [{ type: "text", text: "some text" }] },
    ]);
    const plugin = lowlightPlugin(e);
    const before = plugin.getState(e.state);
    const tr = e.state.tr.setSelection(
      TextSelection.create(e.state.doc, e.state.doc.content.size - 2),
    );
    const newState = e.state.apply(tr);
    const descendants = vi.spyOn(Node.prototype, "descendants");

    const after = plugin.spec.state.apply(tr, before, e.state, newState);

    expect(descendants).not.toHaveBeenCalled();
    expect(after).toBe(before);
  });
});
