import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import { TableReadonlySort } from "@docmost/editor-ext";
import { afterEach, describe, expect, it, vi } from "vitest";

let editor: Editor | null = null;

const cell = (type: string, text: string) => ({
  type,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const table = {
  type: "table",
  content: [
    {
      type: "tableRow",
      content: [cell("tableHeader", "Name"), cell("tableHeader", "Size")],
    },
    {
      type: "tableRow",
      content: [cell("tableCell", "b"), cell("tableCell", "2")],
    },
    {
      type: "tableRow",
      content: [cell("tableCell", "a"), cell("tableCell", "1")],
    },
  ],
};

function createEditor(editable: boolean) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  editor = new Editor({
    element,
    editable,
    extensions: [
      StarterKit,
      Table,
      TableRow,
      TableCell,
      TableHeader,
      TableReadonlySort,
    ],
    content: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "intro" }] },
        table,
      ],
    },
  });
  return editor;
}

const chevrons = (e: Editor) =>
  e.view.dom.querySelectorAll(".tableReadonlySortChevron").length;

afterEach(() => {
  vi.restoreAllMocks();
  editor?.destroy();
  editor = null;
  document.body.innerHTML = "";
});

describe("table sort in read-only pages", () => {
  it("gives every header cell a sort control when the page is read-only", () => {
    const e = createEditor(false);

    expect(chevrons(e)).toBe(2);
  });

  it("has no sort controls while the page is editable", () => {
    const e = createEditor(true);

    e.commands.setTextSelection(3);

    expect(chevrons(e)).toBe(0);
  });

  it("removes the sort controls when the page becomes editable", () => {
    const e = createEditor(false);

    e.setEditable(true);

    expect(chevrons(e)).toBe(0);
  });

  it("adds the sort controls back when the page becomes read-only again", () => {
    const e = createEditor(false);
    e.setEditable(true);

    e.setEditable(false);

    expect(chevrons(e)).toBe(2);
  });

  it("does not search the page for sort controls on every update while editing", () => {
    const e = createEditor(true);
    const querySelectorAll = vi.spyOn(e.view.dom, "querySelectorAll");

    e.commands.setTextSelection(3);
    e.commands.insertContent("x");

    const searches = querySelectorAll.mock.calls.filter(([selector]) =>
      selector.includes("tableReadonlySortChevron"),
    );
    expect(searches).toHaveLength(0);
  });
});
