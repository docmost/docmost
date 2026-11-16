import { CustomCodeBlock, TableCell, TableHeader } from "@docmost/editor-ext";
import { Editor, Node, type JSONContent } from "@tiptap/core";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { Table, TableRow } from "@tiptap/extension-table";
import { StarterKit } from "@tiptap/starter-kit";
import { createLowlight } from "lowlight";
import { afterEach, describe, expect, it, vi } from "vitest";

const CodeBlock = CustomCodeBlock.extend({
  addNodeView() {
    return () => {
      const dom = document.createElement("pre");
      const contentDOM = document.createElement("code");
      dom.appendChild(contentDOM);
      return { dom, contentDOM };
    };
  },
});

const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  isolating: true,
  renderHTML: () => ["div", 0],
});

const cellBlocks = [
  "taskList",
  "image",
  "video",
  "audio",
  "subpages",
  "attachment",
  "mathBlock",
  "details",
].map((name) =>
  Node.create({
    name,
    group: "block",
    atom: true,
    renderHTML: () => ["div"],
  })
);

const code = (language: string | null = null): JSONContent => ({
  type: "codeBlock",
  attrs: { language },
  content: [{ type: "text", text: "code" }],
});

const containers = ["tableCell", "tableHeader", "callout", "doc"] as const;
type Container = (typeof containers)[number];
const editors: Editor[] = [];

function createEditor(container: Container, blocks: JSONContent[]) {
  const content =
    container === "doc"
      ? blocks
      : container === "callout"
        ? [{ type: "callout", content: blocks }]
        : [
            {
              type: "table",
              content: [
                {
                  type: "tableRow",
                  content: [{ type: container, content: blocks }],
                },
              ],
            },
          ];
  const editor = new Editor({
    extensions: [
      StarterKit.configure({ codeBlock: false, trailingNode: false }),
      CodeBlock.configure({ lowlight: createLowlight() }),
      Table,
      TableRow,
      TableCell,
      TableHeader,
      Callout,
      ...cellBlocks,
    ],
    content: { type: "doc", content },
  });
  editors.push(editor);
  // Exercise the code-block shortcuts independently of browser caret geometry.
  vi.spyOn(editor.view, "endOfTextblock").mockReturnValue(false);
  return editor;
}

function codePositions(editor: Editor) {
  const positions: number[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "codeBlock") positions.push(pos);
  });
  return positions;
}

function pressArrow(editor: Editor, direction: "up" | "down") {
  editor.view.dom.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: direction === "up" ? "ArrowUp" : "ArrowDown",
      keyCode: direction === "up" ? 38 : 40,
      bubbles: true,
      cancelable: true,
    })
  );
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  vi.restoreAllMocks();
});

describe("code-block gap navigation", () => {
  it.each(containers)(
    "allows typing before the first code block in %s",
    (container) => {
      const editor = createEditor(container, [code()]);
      const [pos] = codePositions(editor);
      editor.commands.setTextSelection(pos + 1);

      pressArrow(editor, "up");

      expect(editor.state.selection).toBeInstanceOf(GapCursor);
      expect(editor.state.selection.head).toBe(pos);
      editor.commands.insertContent(" ");
      const parent = editor.state.selection.$from.node(
        editor.state.selection.$from.depth - 1
      );
      expect(parent.type.name).toBe(container);
      expect(parent.firstChild?.type.name).toBe("paragraph");
      expect(parent.firstChild?.textContent).toBe(" ");
      expect(parent.child(1).type.name).toBe("codeBlock");
    }
  );

  it.each(["tableCell", "tableHeader", "callout"] as const)(
    "allows typing after the last code block in %s",
    (container) => {
      const editor = createEditor(container, [code()]);
      const [pos] = codePositions(editor);
      const end = pos + editor.state.doc.nodeAt(pos)!.nodeSize;
      editor.commands.setTextSelection(end - 1);

      pressArrow(editor, "down");

      expect(editor.state.selection).toBeInstanceOf(GapCursor);
      expect(editor.state.selection.head).toBe(end);
      editor.commands.insertContent("after");
      const parent = editor.state.selection.$from.node(
        editor.state.selection.$from.depth - 1
      );
      expect(parent.type.name).toBe(container);
      expect(parent.firstChild?.type.name).toBe("codeBlock");
      expect(parent.lastChild?.type.name).toBe("paragraph");
      expect(parent.lastChild?.textContent).toBe("after");
    }
  );

  it.each(["up", "down"] as const)(
    "stops between code and an atom when moving %s",
    (direction) => {
      const image = { type: "image" };
      const editor = createEditor(
        "tableCell",
        direction === "up" ? [image, code()] : [code(), image]
      );
      const [pos] = codePositions(editor);
      const end = pos + editor.state.doc.nodeAt(pos)!.nodeSize;
      editor.commands.setTextSelection(direction === "up" ? pos + 1 : end - 1);

      pressArrow(editor, direction);

      expect(editor.state.selection).toBeInstanceOf(GapCursor);
      expect(editor.state.selection.head).toBe(direction === "up" ? pos : end);

      const { $from } = editor.state.selection;
      expect($from.nodeBefore?.type.name).toBe(
        direction === "up" ? "image" : "codeBlock"
      );
      expect($from.nodeAfter?.type.name).toBe(
        direction === "up" ? "codeBlock" : "image"
      );
    }
  );

  it.each(["up", "down"] as const)(
    "enters adjacent Mermaid source when moving %s",
    (direction) => {
      const editor = createEditor(
        "tableCell",
        direction === "up"
          ? [code("mermaid"), code()]
          : [code(), code("mermaid")]
      );
      const positions = codePositions(editor);
      const pos = positions[direction === "up" ? 1 : 0];
      const end = pos + editor.state.doc.nodeAt(pos)!.nodeSize;
      editor.commands.setTextSelection(direction === "up" ? pos + 1 : end - 1);

      pressArrow(editor, direction);

      expect(editor.state.selection).not.toBeInstanceOf(GapCursor);
      expect(editor.state.selection.$from.parent.attrs.language).toBe(
        "mermaid"
      );
    }
  );

  it.each(["up", "down"] as const)(
    "does not create a gap next to a paragraph when moving %s",
    (direction) => {
      const paragraph = {
        type: "paragraph",
        content: [{ type: "text", text: "text" }],
      };
      const editor = createEditor(
        "tableCell",
        direction === "up" ? [paragraph] : [code(), paragraph]
      );
      const [pos] = codePositions(editor);
      const end = pos + editor.state.doc.nodeAt(pos)!.nodeSize;
      editor.commands.setTextSelection(direction === "up" ? pos + 1 : end - 1);

      pressArrow(editor, direction);

      expect(editor.state.selection).not.toBeInstanceOf(GapCursor);
      expect(
        editor.state.doc.firstChild // table
        ?.firstChild // tableRow
        ?.firstChild // cell
        ?.childCount // paragraph & codeBlock
      ).toBe(2); // same number as initially added
    }
  );

  it.each(["up", "down"] as const)(
    "does not jump to gap cursor from the middle of code block text when moving %s",
    (direction) => {
      const editor = createEditor("tableCell", [code()]);
      const [pos] = codePositions(editor);
      editor.commands.setTextSelection(pos + 2);

      pressArrow(editor, direction);

      expect(editor.state.selection).not.toBeInstanceOf(GapCursor);
      expect(editor.state.selection.head).toBe(pos + 2);
      expect(editor.state.selection.$from.parent.type.name).toBe("codeBlock");
    }
  );

  it("still creates a paragraph when exiting code at the document end", () => {
    const editor = createEditor("doc", [code()]);
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    pressArrow(editor, "down");

    expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
    expect(editor.state.doc.lastChild?.type.name).toBe("paragraph");
  });
});
