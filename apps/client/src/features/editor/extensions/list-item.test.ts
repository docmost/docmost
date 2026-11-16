import {
  CustomTable,
  Indent,
  ListItem,
  TableCell,
  TableHeader,
  TableRow,
  TaskItem,
} from "@docmost/editor-ext";
import { Editor, type JSONContent } from "@tiptap/core";
import { TaskList } from "@tiptap/extension-list";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";

const paragraph = (text: string): JSONContent => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const listItem = (text: string, ...nested: JSONContent[]): JSONContent => ({
  type: "listItem",
  content: [paragraph(text), ...nested],
});
const taskItem = (text: string, ...nested: JSONContent[]): JSONContent => ({
  type: "taskItem",
  attrs: { checked: false },
  content: [paragraph(text), ...nested],
});
const bulletList = (...items: JSONContent[]): JSONContent => ({
  type: "bulletList",
  content: items,
});
const taskList = (...items: JSONContent[]): JSONContent => ({
  type: "taskList",
  content: items,
});
const table = (...cells: JSONContent[][]): JSONContent => ({
  type: "table",
  content: [
    {
      type: "tableRow",
      content: cells.map((content) => ({ type: "tableCell", content })),
    },
  ],
});

const textOf = (node: JSONContent): string =>
  node.text ?? (node.content ?? []).map(textOf).join("");

// Lists as nested item texts, so ["A", ["B"]] is B nested under A; other blocks as "type:text".
function outline(node: JSONContent): unknown {
  if (!node.type.endsWith("List")) return `${node.type}:${textOf(node)}`;
  return node.content.flatMap((item) => {
    const [first, ...nested] = item.content;
    return [textOf(first), ...nested.map(outline)];
  });
}

let editor: Editor;

function editWith(content: JSONContent[], cursorText: string) {
  editor = new Editor({
    extensions: [
      StarterKit.configure({ listItem: false, trailingNode: false }),
      Indent,
      ListItem,
      TaskList,
      TaskItem.configure({ nested: true }),
      CustomTable.configure({ resizable: false }),
      TableRow,
      // the real cells also allow Docmost blocks this editor doesn't load
      TableCell.extend({ content: "block+" }),
      TableHeader.extend({ content: "block+" }),
    ],
    content: { type: "doc", content },
  });
  let cursor = 0;
  editor.state.doc.descendants((node, pos) => {
    if (node.text === cursorText) cursor = pos + 1;
  });
  editor.commands.setTextSelection(cursor);
}

// A keydown as the browser delivers it; TipTap's keyboardShortcut command drops
// selection changes such as moving to the next cell.
function press(key: string): boolean {
  const event = new KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey: key === "Shift-Tab",
  });
  return Boolean(
    editor.view.someProp("handleKeyDown", (handle) => handle(editor.view, event)),
  );
}

const outlineOf = (blocks: JSONContent[]) => blocks.map(outline);
const docBlocks = () => (editor.getJSON() as JSONContent).content;
const cellBlocks = () => docBlocks()[0].content[0].content[0].content;

afterEach(() => editor?.destroy());

const mixedListCases: [string, string, JSONContent, string, unknown][] = [
  [
    "Tab nests the checklist item in a bullet item",
    "Tab",
    bulletList(listItem("X"), listItem("Y", taskList(taskItem("T1"), taskItem("T2")))),
    "T2",
    ["X", "Y", ["T1", ["T2"]]],
  ],
  [
    "Tab nests the bullet item in a checklist item",
    "Tab",
    taskList(taskItem("P"), taskItem("Q", bulletList(listItem("B1"), listItem("B2")))),
    "B2",
    ["P", "Q", ["B1", ["B2"]]],
  ],
  [
    "Shift-Tab moves up the checklist item in a bullet item",
    "Shift-Tab",
    bulletList(listItem("Y", taskList(taskItem("T1", taskList(taskItem("T2")))))),
    "T2",
    ["Y", ["T1", "T2"]],
  ],
  [
    "Shift-Tab moves up the bullet item in a checklist item",
    "Shift-Tab",
    taskList(taskItem("Q", bulletList(listItem("B1", bulletList(listItem("B2")))))),
    "B2",
    ["Q", ["B1", "B2"]],
  ],
];

describe("Tab in lists of mixed kinds", () => {
  it.each(mixedListCases)("%s", (_, key, list, cursorText, expected) => {
    editWith([list], cursorText);
    press(key);
    expect(outlineOf(docBlocks())).toEqual([expected]);
  });

  it.each(mixedListCases)("%s, in a table cell", (_, key, list, cursorText, expected) => {
    editWith([table([list])], cursorText);
    press(key);
    expect(outlineOf(cellBlocks())).toEqual([expected]);
  });

  it("leaves the item around a first nested item alone", () => {
    editWith(
      [taskList(taskItem("P"), taskItem("Q", bulletList(listItem("B1"), listItem("B2"))))],
      "B1",
    );
    // nothing takes the key, so focus can leave the editor
    expect(press("Tab")).toBe(false);
    expect(outlineOf(docBlocks())).toEqual([["P", "Q", ["B1", "B2"]]]);
  });

  it("moves to the next cell in a table inside a list item", () => {
    editWith(
      [bulletList(listItem("A"), listItem("B", table([paragraph("c1")], [paragraph("c2")])))],
      "c1",
    );
    press("Tab");
    expect(outlineOf(docBlocks())).toEqual([["A", "B", "table:c1c2"]]);
    expect(editor.state.selection.$from.parent.textContent).toBe("c2");
  });
});
