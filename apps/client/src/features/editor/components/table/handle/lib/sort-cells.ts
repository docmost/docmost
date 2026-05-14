import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export type SortDirection = "asc" | "desc";

export interface SortableItem<T> {
  payload: T;
  text: string;
  isHeader: boolean;
  isEmpty: boolean;
  originalOrder: number;
}

const HEADER_TYPE_NAMES = new Set(["tableHeader", "table_header"]);

export function isHeaderCell(node: ProseMirrorNode): boolean {
  if (HEADER_TYPE_NAMES.has(node.type.name)) return true;
  return node.attrs?.header === true;
}

export function getCellSortText(node: ProseMirrorNode): string {
  let text = "";
  node.descendants((child) => {
    if (child.isText) text += child.text ?? "";
    return true;
  });
  return text.trim().toLowerCase();
}

export function isCellEmpty(node: ProseMirrorNode): boolean {
  return getCellSortText(node) === "";
}

export const collator = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

export function sortItems<T>(
  data: SortableItem<T>[],
  direction: SortDirection,
): SortableItem<T>[] {
  return [...data].sort((a, b) => {
    if (a.isEmpty && !b.isEmpty) return 1;
    if (!a.isEmpty && b.isEmpty) return -1;
    if (a.isEmpty && b.isEmpty) return a.originalOrder - b.originalOrder;
    const cmp = collator.compare(a.text, b.text);
    return direction === "asc" ? cmp : -cmp;
  });
}

export function weaveItems<T>(
  all: SortableItem<T>[],
  sortedData: SortableItem<T>[],
): SortableItem<T>[] {
  const dataQueue = [...sortedData];
  return all.map((item) => (item.isHeader ? item : dataQueue.shift()!));
}
