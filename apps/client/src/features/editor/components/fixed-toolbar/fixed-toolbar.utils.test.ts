import { Indent } from "@docmost/editor-ext";
import { Editor, type JSONContent } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { decreaseIndent, increaseIndent } from "./fixed-toolbar.utils";

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

// Item texts with their nesting: ["A", ["B"]] is B nested under A.
function outline(list: JSONContent): unknown[] {
  return list.content.flatMap((item) => {
    const [first, ...nested] = item.content;
    return [first.content[0].text, ...nested.map(outline)];
  });
}

let editor: Editor;

function editWith(list: JSONContent, cursorText: string) {
  editor = new Editor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Indent,
    ],
    content: { type: "doc", content: [list] },
  });
  let cursor = 0;
  editor.state.doc.descendants((node, pos) => {
    if (node.text === cursorText) cursor = pos + 1;
  });
  editor.commands.setTextSelection(cursor);
}

const firstBlock = () => editor.getJSON().content[0];

afterEach(() => editor?.destroy());

describe("increaseIndent", () => {
  it("nests a list item under the one before it", () => {
    editWith(bulletList(listItem("A"), listItem("B")), "B");
    increaseIndent(editor);
    expect(outline(firstBlock())).toEqual(["A", ["B"]]);
  });

  it("nests the task item the cursor is in, not the list item around it", () => {
    editWith(
      bulletList(
        listItem("X"),
        listItem("Y", taskList(taskItem("T1"), taskItem("T2"))),
      ),
      "T2",
    );
    increaseIndent(editor);
    expect(outline(firstBlock())).toEqual(["X", "Y", ["T1", ["T2"]]]);
  });

  it("indents a paragraph outside lists", () => {
    editWith(paragraph("Text"), "Text");
    increaseIndent(editor);
    expect(firstBlock().attrs.indent).toBe(1);
  });
});

describe("decreaseIndent", () => {
  it("moves a nested list item one level up", () => {
    editWith(bulletList(listItem("A", bulletList(listItem("B")))), "B");
    decreaseIndent(editor);
    expect(outline(firstBlock())).toEqual(["A", "B"]);
  });

  it("moves the task item the cursor is in, not the list item around it", () => {
    editWith(
      bulletList(listItem("Y", taskList(taskItem("T1", taskList(taskItem("T2")))))),
      "T2",
    );
    decreaseIndent(editor);
    expect(outline(firstBlock())).toEqual(["Y", ["T1", "T2"]]);
  });
});
