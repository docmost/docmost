import { TableRow as TiptapTableRow } from "@tiptap/extension-table";

export const TableRow = TiptapTableRow.extend({
  content: "(tableCell | tableHeader)*",
});
