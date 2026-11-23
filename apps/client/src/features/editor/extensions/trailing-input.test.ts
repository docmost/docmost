import { Editor, Node } from "@tiptap/core";
import { Collaboration } from "@tiptap/extension-collaboration";
import { TableKit } from "@tiptap/extension-table";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { StarterKit } from "@tiptap/starter-kit";
import * as Y from "yjs";
import { afterEach, expect, it, vi } from "vitest";
import { TrailingNode } from "@docmost/editor-ext";
import { TiptapDocument } from "./document";

const editors: Editor[] = [];
const docs: Y.Doc[] = [];
const Footnotes = Node.create({
  name: "footnotes",
  content: "paragraph*",
  renderHTML: () => ["ol", 0],
});
function open(update?: Uint8Array, editable = true) {
  const doc = new Y.Doc();
  docs.push(doc);
  if (update) Y.applyUpdate(doc, update);
  const element = document.createElement("div");
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    editable,
    extensions: [
      TiptapDocument,
      StarterKit.configure({
        document: false,
        trailingNode: false,
        undoRedo: false,
      }),
      Footnotes,
      TableKit,
      Collaboration.configure({ document: doc }),
      TrailingNode,
    ],
  });
  editors.push(editor);
  return { doc, editor };
}
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  docs.splice(0).forEach((d) => d.destroy());
  document.body.replaceChildren();
});

it("opens a shared table in two editors without appending any shared paragraphs", () => {
  const source = open();
  source.editor.commands.setContent(
    "<table><tr><td><p>Stock</p></td></tr></table>",
  );
  const update = Y.encodeStateAsUpdate(source.doc);
  const a = open(update),
    b = open(update);
  expect(a.editor.getJSON().content.map((n) => n.type)).toEqual(["table"]);
  expect(b.editor.getJSON()).toEqual(a.editor.getJSON());
  for (const { editor } of [a, b]) {
    const target = editor.view.dom.querySelector<HTMLElement>(
      "[data-trailing-input]",
    );
    expect(target).toBeTruthy();
    target.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    expect(editor.state.selection).toBeInstanceOf(GapCursor);
    expect(editor.getJSON().content).toHaveLength(1);
  }
  const pos = a.editor.state.selection.from;
  const handled = a.editor.view.someProp("handleTextInput", (fn) =>
    fn(a.editor.view, pos, pos, "Dispatch", () => a.editor.state.tr),
  );
  expect(handled).toBe(true);
  Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
  expect(b.editor.getJSON()).toEqual(a.editor.getJSON());
  expect(b.editor.getJSON().content[1]).toMatchObject({
    type: "paragraph",
    content: [{ text: "Dispatch" }],
  });
  expect(b.editor.view.dom.querySelector("[data-trailing-input]")).toBeNull();
});

function press(editor: Editor, key: string, keyCode: number) {
  editor.view.dom.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      keyCode,
      bubbles: true,
      cancelable: true,
    }),
  );
}

it("uses the empty line after the last heading from the keyboard without editing the heading", () => {
  const { editor } = open();
  editor.commands.setContent("<h2>Title</h2>");
  editor.commands.setTextSelection(6);
  vi.spyOn(editor.view, "endOfTextblock").mockReturnValue(true);
  press(editor, "ArrowDown", 40);
  expect(editor.state.selection).toBeInstanceOf(GapCursor);
  expect(editor.getJSON().content).toHaveLength(1);
  press(editor, "Enter", 13);
  expect(editor.getJSON().content).toMatchObject([
    { type: "heading", content: [{ text: "Title" }] },
    { type: "paragraph" },
  ]);
});

it("places deliberate input before the footnotes and hides the local line in read mode", () => {
  const { editor, doc } = open();
  editor.commands.setContent({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Title" }],
      },
      {
        type: "footnotes",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Original note" }],
          },
        ],
      },
    ],
  });
  const copy = open(Y.encodeStateAsUpdate(doc), false);
  const widget = () =>
    copy.editor.view.dom.querySelector<HTMLElement>("[data-trailing-input]");
  expect(widget()).toBeNull();
  copy.editor.setEditable(true, false);
  const line = widget();
  expect(line.nextElementSibling?.tagName).toBe("OL");
  const nonPrimary = new MouseEvent("mousedown", {
    button: 1,
    bubbles: false,
    cancelable: true,
  });
  line.dispatchEvent(nonPrimary);
  expect(nonPrimary.defaultPrevented).toBe(false);
  line.dispatchEvent(
    new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
  );
  expect(copy.editor.state.selection).toBeInstanceOf(GapCursor);
  press(copy.editor, "Enter", 13);
  expect(copy.editor.getJSON().content.map((n) => n.type)).toEqual([
    "heading",
    "paragraph",
    "footnotes",
  ]);
  expect(copy.editor.state.doc.lastChild.textContent).toBe("Original note");
});

it("keeps the local insertion line selected when a peer edits the last heading", () => {
  const a = open();
  a.editor.commands.setContent("<h2>Title</h2>");
  const b = open(Y.encodeStateAsUpdate(a.doc));
  const line = a.editor.view.dom.querySelector<HTMLElement>(
    "[data-trailing-input]",
  );
  line.dispatchEvent(
    new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
  );
  b.editor.commands.insertContentAt(1, "Peer ");
  Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc));
  expect(a.editor.state.doc.firstChild.textContent).toBe("Peer Title");
  expect(a.editor.state.selection).toBeInstanceOf(GapCursor);
  press(a.editor, "Enter", 13);
  expect(a.editor.getJSON().content.map((n) => n.type)).toEqual([
    "heading",
    "paragraph",
  ]);
});

it("restores the original document when composition on the local insertion line is canceled", async () => {
  const { editor } = open();
  editor.commands.setContent("<h2>Title</h2>");
  const before = editor.getJSON();
  const dom = editor.view.dom;
  dom
    .querySelector<HTMLElement>("[data-trailing-input]")
    .dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
  dom.dispatchEvent(
    new CompositionEvent("compositionstart", { bubbles: true }),
  );
  dom.dispatchEvent(
    new InputEvent("beforeinput", {
      bubbles: true,
      inputType: "insertCompositionText",
    }),
  );
  expect(editor.state.doc.childCount).toBe(2);
  dom.dispatchEvent(
    new CompositionEvent("compositionend", { bubbles: true, data: "" }),
  );
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  expect(editor.getJSON()).toEqual(before);
  expect(editor.state.selection).toBeInstanceOf(GapCursor);
});
