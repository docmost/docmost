import TiptapTableRow from "@tiptap/extension-table-row";

export const TableRow = TiptapTableRow.extend({
  allowGapCursor: false,
  content: "(tableCell | tableHeader)*",
});
