import { TableCell as TiptapTableCell } from "@tiptap/extension-table-cell";

export const TableCell = TiptapTableCell.extend({
  name: "tableCell",
  content: "paragraph+",
});
