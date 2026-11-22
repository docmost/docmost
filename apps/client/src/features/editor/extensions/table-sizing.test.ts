import { CustomTable, TableView } from "@docmost/editor-ext";
import { Editor } from "@tiptap/core";
import { TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { closeHistory } from "@tiptap/pm/history";
import { columnResizingPluginKey } from "@tiptap/pm/tables";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, expect, it } from "vitest";

let editor: Editor;

function mount(editable: boolean) {
  editor = new Editor({
    editable,
    extensions: [
      StarterKit,
      CustomTable.configure({
        resizable: true,
        cellMinWidth: 49,
        View: TableView,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
  });
  editor.commands.insertTable({ rows: 1, cols: 2, withHeaderRow: false });
}

afterEach(() => editor?.destroy());

it("keeps column resizing available when a synced page becomes editable", () => {
  mount(false);
  editor.setEditable(true);
  expect(columnResizingPluginKey.getState(editor.state)).toBeDefined();
});

it("restores an automatic column after undoing a resize", () => {
  mount(true);
  const col = editor.view.dom.querySelector("col")!;
  editor.view.dispatch(closeHistory(editor.state.tr));
  editor.commands.setCellAttribute("colwidth", [80]);
  expect(col.style.width).toBe("80px");
  editor.commands.undo();
  expect(col.style.width).toBe("");
  expect(col.style.minWidth).toBe("49px");
});

it("uses the same responsive sizing for editing and rendered HTML", () => {
  mount(true);
  editor.commands.setCellAttribute("colwidth", [80]);

  const table = editor.view.dom.querySelector("table")!;
  const html = new DOMParser().parseFromString(editor.getHTML(), "text/html");
  const wrapper = html.querySelector<HTMLElement>(".tableWrapper")!;
  const preferredWidth = table.style.getPropertyValue(
    "--table-preferred-width",
  );
  expect(preferredWidth).toContain("80px");
  expect(wrapper.style.getPropertyValue("--table-preferred-width")).toBe(
    preferredWidth,
  );
  expect(html.querySelector("col")!.style.width).toBe("80px");
});
