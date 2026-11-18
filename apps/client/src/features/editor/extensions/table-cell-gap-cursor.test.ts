import {
  Callout,
  CustomCodeBlock,
  CustomTable,
  Details,
  DetailsContent,
  DetailsSummary,
  TableCell,
  TableHeader,
  TableRow,
} from "@docmost/editor-ext";
import { Editor, Node, type JSONContent } from "@tiptap/core";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { StarterKit } from "@tiptap/starter-kit";
import { createLowlight } from "lowlight";
import { afterEach, describe, expect, it, vi } from "vitest";

const AtomBlock = Node.create({
  name: "atomBlock",
  group: "block",
  atom: true,
  renderHTML() {
    return ["div", { "data-atom-block": "" }];
  },
});

const text = (value: string) => [{ type: "text", text: value }];
const paragraph = (value: string): JSONContent => ({
  type: "paragraph",
  content: text(value),
});
const codeBlock = (value: string, language: string | null = null) => ({
  type: "codeBlock",
  attrs: { language },
  content: text(value),
});
const callout = (...content: JSONContent[]) => ({ type: "callout", content });
const details = (summary: string, ...content: JSONContent[]) => ({
  type: "details",
  content: [
    { type: "detailsSummary", content: text(summary) },
    { type: "detailsContent", content },
  ],
});

type CellName = "r0c0" | "r0c1" | "r1c0" | "r1c1";

// A paragraph, a 2x2 table and a paragraph; cells without content hold their own name.
function tableDoc(
  cells: Partial<Record<CellName, JSONContent[]>>,
  { header = false } = {},
): JSONContent[] {
  const cell = (name: CellName) => ({
    type: header && name.startsWith("r0") ? "tableHeader" : "tableCell",
    content: cells[name] ?? [paragraph(name)],
  });
  return [
    paragraph("above"),
    {
      type: "table",
      content: [
        { type: "tableRow", content: [cell("r0c0"), cell("r0c1")] },
        { type: "tableRow", content: [cell("r1c0"), cell("r1c1")] },
      ],
    },
    paragraph("below"),
  ];
}

const editors: Editor[] = [];

function createEditor(content: JSONContent[]) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  // StarterKit (with the gap cursor) before the table, as in the page editor.
  const editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({ codeBlock: false, trailingNode: false }),
      CustomCodeBlock.extend({ addNodeView: null }).configure({
        lowlight: createLowlight(),
      }),
      Callout.extend({ addNodeView: null }),
      Details,
      DetailsSummary,
      DetailsContent,
      CustomTable.configure({ resizable: false }),
      TableRow,
      // the real cells also allow Docmost blocks this editor doesn't load
      TableCell.extend({ content: "block+" }),
      TableHeader.extend({ content: "block+" }),
      AtomBlock,
    ],
    content: { type: "doc", content },
  });
  editors.push(editor);
  // jsdom has no layout: a caret is on the first/last line when no "\n" is before/after it.
  vi.spyOn(editor.view, "endOfTextblock").mockImplementation((dir) => {
    const { $head } = editor.state.selection;
    const value = $head.parent.textContent;
    const offset = $head.parentOffset;
    if (dir === "up") return !value.slice(0, offset).includes("\n");
    if (dir === "down") return !value.slice(offset).includes("\n");
    if (dir === "left" || dir === "backward") return offset === 0;
    return offset === $head.parent.content.size;
  });
  return editor;
}

const keyCodes = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };

function press(editor: Editor, key: keyof typeof keyCodes) {
  editor.view.dom.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      keyCode: keyCodes[key],
      bubbles: true,
      cancelable: true,
    }),
  );
}

function placeCaret(editor: Editor, textValue: string, offset: number) {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text === textValue) found = pos;
  });
  if (found < 0) throw new Error(`no text "${textValue}"`);
  editor.commands.setTextSelection(found + offset);
}

function caret(editor: Editor): string {
  const { selection } = editor.state;
  const { $head } = selection;
  let place = "doc";
  for (let depth = $head.depth; depth > 0; depth--) {
    const role = $head.node(depth).type.spec.tableRole;
    if (role === "cell" || role === "header_cell") {
      place = `r${$head.index(depth - 2)}c${$head.index(depth - 1)}`;
      break;
    }
  }
  if (selection instanceof GapCursor) {
    const before = $head.nodeBefore?.type.name ?? "start";
    const after = $head.nodeAfter?.type.name ?? "end";
    return `gap in ${$head.parent.type.name} ${place}: ${before} | ${after}`;
  }
  return `text "${$head.parent.textContent}" at ${$head.parentOffset}`;
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  vi.restoreAllMocks();
});

describe("gap cursor at table cell edges", () => {
  it.each([0, 2])(
    "stops before a code block that opens a cell from offset %i on its first line",
    (offset) => {
      const editor = createEditor(tableDoc({ r1c0: [codeBlock("abc\ndef")] }));
      placeCaret(editor, "abc\ndef", offset);

      press(editor, "ArrowUp");

      expect(caret(editor)).toBe("gap in tableCell r1c0: start | codeBlock");
    },
  );

  it.each([5, 7])(
    "stops after a code block that ends a cell from offset %i on its last line",
    (offset) => {
      const editor = createEditor(tableDoc({ r0c0: [codeBlock("abc\ndef")] }));
      placeCaret(editor, "abc\ndef", offset);

      press(editor, "ArrowDown");

      expect(caret(editor)).toBe("gap in tableCell r0c0: codeBlock | end");
    },
  );

  it("moves from a cell-edge gap to the cell above and below", () => {
    const up = createEditor(tableDoc({ r1c1: [codeBlock("abc")] }));
    placeCaret(up, "abc", 0);
    press(up, "ArrowUp");
    expect(caret(up)).toBe("gap in tableCell r1c1: start | codeBlock");
    press(up, "ArrowUp");
    expect(caret(up)).toBe('text "r0c1" at 0');

    const down = createEditor(tableDoc({ r0c0: [codeBlock("abc")] }));
    placeCaret(down, "abc", 3);
    press(down, "ArrowDown");
    expect(caret(down)).toBe("gap in tableCell r0c0: codeBlock | end");
    press(down, "ArrowDown");
    expect(caret(down)).toBe('text "r1c0" at 0');

    const out = createEditor(tableDoc({ r0c1: [codeBlock("abc")] }));
    placeCaret(out, "abc", 0);
    press(out, "ArrowUp");
    press(out, "ArrowUp");
    expect(caret(out)).toBe('text "above" at 5');
  });

  it.each<
    [
      string,
      Partial<Record<CellName, JSONContent[]>>,
      string,
      number,
      keyof typeof keyCodes,
      string,
    ]
  >([
    [
      "before a callout",
      { r1c0: [callout(paragraph("inside"))] },
      "inside",
      0,
      "ArrowUp",
      "gap in tableCell r1c0: start | callout",
    ],
    [
      "before a toggle",
      { r1c0: [details("summary", paragraph("body"))] },
      "summary",
      0,
      "ArrowUp",
      "gap in tableCell r1c0: start | details",
    ],
    [
      "after a callout",
      { r0c0: [callout(paragraph("inside"))] },
      "inside",
      6,
      "ArrowDown",
      "gap in tableCell r0c0: callout | end",
    ],
  ])(
    "stops at the gap %s at a cell edge",
    (_, cells, textValue, offset, key, expected) => {
      const editor = createEditor(tableDoc(cells));
      placeCaret(editor, textValue, offset);

      press(editor, key);

      expect(caret(editor)).toBe(expected);
    },
  );

  it("stops inside a callout before stopping in the cell", () => {
    const editor = createEditor(
      tableDoc({ r1c0: [callout(codeBlock("abc"))] }),
    );
    placeCaret(editor, "abc", 0);

    press(editor, "ArrowUp");
    expect(caret(editor)).toBe("gap in callout r1c0: start | codeBlock");
    press(editor, "ArrowUp");
    expect(caret(editor)).toBe("gap in tableCell r1c0: start | callout");
    press(editor, "ArrowUp");
    expect(caret(editor)).toBe('text "r0c0" at 0');
  });

  it("stops at cell-edge gaps with ArrowLeft and ArrowRight", () => {
    const left = createEditor(tableDoc({ r1c1: [codeBlock("abc")] }));
    placeCaret(left, "abc", 0);
    press(left, "ArrowLeft");
    expect(caret(left)).toBe("gap in tableCell r1c1: start | codeBlock");

    const right = createEditor(tableDoc({ r0c0: [codeBlock("abc")] }));
    placeCaret(right, "abc", 3);
    press(right, "ArrowRight");
    expect(caret(right)).toBe("gap in tableCell r0c0: codeBlock | end");
  });

  it("keeps cell navigation for paragraphs next to cells with gaps", () => {
    const up = createEditor(
      tableDoc({ r1c0: [paragraph("left"), codeBlock("abc")] }),
    );
    placeCaret(up, "r1c1", 0);
    press(up, "ArrowUp");
    expect(caret(up)).toBe('text "r0c1" at 0');

    const down = createEditor(
      tableDoc({ r1c0: [codeBlock("abc"), paragraph("left")] }),
    );
    placeCaret(down, "r0c1", 4);
    press(down, "ArrowDown");
    expect(caret(down)).toBe('text "r1c1" at 0');
  });

  it("still opens a Mermaid block below a code block in the same cell", () => {
    const editor = createEditor(
      tableDoc({
        r0c0: [codeBlock("abc"), codeBlock("graph TD", "mermaid")],
      }),
    );
    placeCaret(editor, "abc", 3);

    press(editor, "ArrowDown");

    expect(caret(editor)).toBe('text "graph TD" at 0');
  });

  it("adds a paragraph inside the cell when typing at the gap", () => {
    const editor = createEditor(tableDoc({ r1c0: [codeBlock("abc")] }));
    placeCaret(editor, "abc", 0);
    press(editor, "ArrowUp");

    editor.commands.insertContent("x");

    const cell = editor.state.doc.child(1).child(1).child(0);
    expect(cell.childCount).toBe(2);
    expect(cell.child(0).type.name).toBe("paragraph");
    expect(cell.child(0).textContent).toBe("x");
    expect(cell.child(1).type.name).toBe("codeBlock");
  });

  it("treats header cells like body cells", () => {
    const editor = createEditor(tableDoc({ r0c1: [codeBlock("abc")] }, { header: true }));
    placeCaret(editor, "abc", 3);

    press(editor, "ArrowDown");
    expect(caret(editor)).toBe("gap in tableHeader r0c1: codeBlock | end");
    press(editor, "ArrowDown");
    expect(caret(editor)).toBe('text "r1c1" at 0');
  });

  it("leaves a table at the document edge through the gap outside it", () => {
    const [, table, below] = tableDoc({ r0c0: [codeBlock("abc")] });
    const up = createEditor([table, below]);
    placeCaret(up, "abc", 0);
    press(up, "ArrowUp");
    expect(caret(up)).toBe("gap in tableCell r0c0: start | codeBlock");
    press(up, "ArrowUp");
    expect(caret(up)).toBe("gap in doc doc: start | table");
    press(up, "ArrowUp");
    expect(caret(up)).toBe("gap in doc doc: start | table");

    const [above, endTable] = tableDoc({ r1c1: [codeBlock("abc")] });
    const down = createEditor([above, endTable]);
    placeCaret(down, "abc", 3);
    press(down, "ArrowDown");
    expect(caret(down)).toBe("gap in tableCell r1c1: codeBlock | end");
    press(down, "ArrowDown");
    expect(caret(down)).toBe("gap in doc doc: table | end");
  });

  it("moves from the gap beside a selected atom to the cell below", () => {
    const editor = createEditor(
      tableDoc({ r0c0: [paragraph("text"), { type: "atomBlock" }] }),
    );
    let atomPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "atomBlock") atomPos = pos;
    });
    editor.commands.setNodeSelection(atomPos);

    press(editor, "ArrowDown");
    expect(caret(editor)).toBe("gap in tableCell r0c0: atomBlock | end");
    press(editor, "ArrowDown");

    expect(caret(editor)).toBe('text "r1c0" at 0');
  });

  it("moves within the cell from a gap between two blocks", () => {
    const editor = createEditor(
      tableDoc({ r1c0: [codeBlock("one"), codeBlock("two")] }),
    );
    placeCaret(editor, "two", 0);
    press(editor, "ArrowUp");
    expect(caret(editor)).toBe("gap in tableCell r1c0: codeBlock | codeBlock");

    press(editor, "ArrowUp");

    expect(caret(editor)).toBe('text "one" at 3');
  });
});

describe("code block at the end of a container", () => {
  it("stops at the gap after a code block that ends a callout", () => {
    const editor = createEditor([callout(codeBlock("abc")), paragraph("after")]);
    placeCaret(editor, "abc", 3);

    press(editor, "ArrowDown");

    const { selection } = editor.state;
    expect(selection).toBeInstanceOf(GapCursor);
    expect(selection.$head.parent.type.name).toBe("callout");
    expect(selection.$head.nodeBefore?.type.name).toBe("codeBlock");
  });
});
