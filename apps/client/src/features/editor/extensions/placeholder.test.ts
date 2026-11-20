import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Node } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Placeholder } from "./placeholder";

let editor: Editor | null = null;

const text = (value: string) => ({
  type: "paragraph",
  content: [{ type: "text", text: value }],
});
const empty = { type: "paragraph" };

function createEditor(content: object[], options = {}) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({ trailingNode: false }),
      Placeholder.configure({
        placeholder: "Write",
        includeChildren: true,
        ...options,
      }),
    ],
    content: { type: "doc", content },
  });
  return editor;
}

// index of every block that shows the placeholder, in document order
function placeholders(e: Editor) {
  const blocks = [...e.view.dom.querySelectorAll("p, h1, h2, h3")];
  return blocks
    .map((block, index) => (block.matches("[data-placeholder]") ? index : -1))
    .filter((index) => index >= 0);
}

afterEach(() => {
  vi.restoreAllMocks();
  editor?.destroy();
  editor = null;
  document.body.innerHTML = "";
});

describe("placeholder", () => {
  it("shows in the empty block that holds the caret", () => {
    const e = createEditor([text("one"), empty, text("three")]);

    e.commands.setTextSelection(6);

    expect(placeholders(e)).toEqual([1]);
    const block = e.view.dom.querySelector("[data-placeholder]");
    expect(block.getAttribute("data-placeholder")).toBe("Write");
    expect(block.classList.contains("is-empty")).toBe(true);
    expect(block.classList.contains("is-editor-empty")).toBe(false);
  });

  it("does not show in empty blocks without the caret", () => {
    const e = createEditor([text("one"), empty, text("three"), empty]);

    e.commands.setTextSelection(2);

    expect(placeholders(e)).toEqual([]);
  });

  it("shows in an empty block inside another block", () => {
    const e = createEditor([
      text("one"),
      { type: "blockquote", content: [empty] },
    ]);

    e.commands.setTextSelection(7);

    expect(placeholders(e)).toEqual([1]);
  });

  it("shows in an empty block right before a selected node", () => {
    const e = createEditor([text("one"), empty, { type: "horizontalRule" }]);

    e.view.dispatch(
      e.state.tr.setSelection(NodeSelection.create(e.state.doc, 7)),
    );

    expect(placeholders(e)).toEqual([1]);
  });

  it("marks the block of an empty document", () => {
    const e = createEditor([empty]);

    const block = e.view.dom.querySelector("[data-placeholder]");
    expect(block.classList.contains("is-editor-empty")).toBe(true);
  });

  it("shows in every empty block when it is not limited to the caret", () => {
    const e = createEditor([text("one"), empty, text("three"), empty], {
      showOnlyCurrent: false,
    });

    e.commands.setTextSelection(2);

    expect(placeholders(e)).toEqual([1, 3]);
  });

  it("looks only at the blocks around the caret", () => {
    const e = createEditor(
      Array.from({ length: 300 }, (_, i) => text(`paragraph ${i}`)),
    );
    const plugin = e.state.plugins.find((p) =>
      (p as any).key.startsWith("docmostPlaceholder$"),
    );
    const nodesBetween = vi.spyOn(Node.prototype, "nodesBetween");

    plugin.props.decorations.call(plugin, e.state);

    // one walk per visited block: all 300 of them before
    expect(nodesBetween.mock.calls.length).toBeLessThan(10);
  });
});
