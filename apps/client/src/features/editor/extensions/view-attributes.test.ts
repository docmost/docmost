import { Editor, Mark, Node } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, describe, expect, it, vi } from "vitest";

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

const nodeWithView = (name: string) =>
  Node.create({
    name,
    group: "block",
    atom: true,
    parseHTML: () => [{ tag: name }],
    renderHTML: () => [name],
    addNodeView: () => () => ({ dom: document.createElement("div") }),
  });

const markWithView = (name: string) =>
  Mark.create({
    name,
    parseHTML: () => [{ tag: name }],
    renderHTML: () => [name, 0],
    addMarkView: () => () => {
      const dom = document.createElement("span");
      return { dom, contentDOM: dom };
    },
  });

function createEditor() {
  editor = new Editor({
    extensions: [
      StarterKit,
      nodeWithView("alpha"),
      nodeWithView("beta"),
      nodeWithView("gamma"),
      markWithView("delta"),
      markWithView("epsilon"),
    ],
  });
  return vi.spyOn(editor.extensionManager, "attributes", "get");
}

describe("extension manager views", () => {
  it("computes the extension attributes once for all node views", () => {
    const attributes = createEditor();

    expect(Object.keys(editor!.extensionManager.nodeViews)).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
    expect(attributes).toHaveBeenCalledTimes(1);
  });

  it("computes the extension attributes once for all mark views", () => {
    const attributes = createEditor();

    expect(Object.keys(editor!.extensionManager.markViews)).toEqual([
      "delta",
      "epsilon",
    ]);
    expect(attributes).toHaveBeenCalledTimes(1);
  });
});
