import { Fragment, type Node } from '@tiptap/pm/model';
import * as Y from 'yjs';
import type {
  CellEdit,
  FormatSplice,
  StatusLabelSplice,
  TextSplice,
} from './block-edits.types';
import { applyTextChange, findTextChange } from './block-text';

export function editableCellValue(cell: Node): string | undefined {
  if (
    (cell.type.name !== 'tableCell' && cell.type.name !== 'tableHeader') ||
    cell.childCount !== 1 ||
    cell.firstChild.type.name !== 'paragraph'
  )
    return;
  const paragraph = cell.firstChild;
  if (paragraph.children.every((child) => child.isText))
    return paragraph.textContent;
  if (
    paragraph.childCount === 1 &&
    paragraph.firstChild.type.name === 'status' &&
    typeof paragraph.firstChild.attrs.text === 'string'
  )
    return paragraph.firstChild.attrs.text;
}

export type CellChange = {
  column: number;
  path: number[];
  cell: Node;
  splice?: TextSplice | FormatSplice | StatusLabelSplice;
};

export function resolveCellChanges(
  row: Node,
  rowPath: number[],
  changes: CellEdit[],
): CellChange[] | string {
  if (row.type.name !== 'tableRow')
    return 'update_cells requires a table row ref.';
  if (!Array.isArray(changes) || !changes.length)
    return 'update_cells requires at least one cell change.';
  const columns = new Set<number>();
  const result: CellChange[] = [];
  for (const change of changes) {
    const column = change?.column;
    if (!Number.isSafeInteger(column) || column < 1 || column > row.childCount)
      return `Select a physical cell from column 1 to ${row.childCount} in this row.`;
    if (columns.has(column))
      return `Column ${column} is specified more than once.`;
    columns.add(column);
    const { oldValue, newValue } = change;
    if (typeof oldValue !== 'string' || typeof newValue !== 'string')
      return `Column ${column} requires string oldValue and newValue.`;
    if (/\p{Surrogate}/u.test(newValue))
      return `Column ${column} contains an incomplete Unicode character.`;
    const cell = row.child(column - 1);
    const current = editableCellValue(cell);
    if (current === undefined)
      return `Column ${column} must contain a single paragraph of text or a single native status badge.`;
    if (current !== oldValue)
      return `The oldValue for column ${column} does not match its exact current value. Read the row again.`;

    const path = [...rowPath, column - 1];
    if (newValue === oldValue) {
      result.push({ column, path, cell });
      continue;
    }
    const blockPath = [...path, 0];
    const block = cell.firstChild;
    let after: Node;
    let splice: CellChange['splice'];
    if (block.firstChild?.type.name === 'status') {
      const badge = block.firstChild;
      const renamed = badge.type.create(
        { ...badge.attrs, text: newValue },
        badge.content,
        badge.marks,
      );
      after = block.copy(Fragment.from(renamed));
      splice = {
        path: blockPath,
        oldLabel: oldValue,
        newLabel: newValue,
        expected: [],
      };
    } else if (!oldValue) {
      after = block.copy(Fragment.from(block.type.schema.text(newValue)));
      splice = {
        path: blockPath,
        format: after.toJSON(),
        fill: true,
        expected: [],
      };
    } else {
      const text = findTextChange(block, blockPath, oldValue, newValue);
      if (typeof text === 'string') return `Column ${column}: ${text}`;
      after = applyTextChange(block, text);
      const marked = block.children.filter((node) => node.marks.length);
      const remaining = after.children.filter((node) => node.marks.length);
      if (
        marked.length !== remaining.length ||
        marked.some((node, i) => !node.sameMarkup(remaining[i]))
      )
        return `Column ${column} would lose existing formatting or a comment highlight.`;
      splice = text.splice;
    }
    result.push({
      column,
      path,
      cell: cell.copy(Fragment.from(after)),
      splice,
    });
  }
  return result;
}

export function prepareStatusLabel(
  paragraph: Y.XmlFragment,
  { oldLabel, newLabel }: StatusLabelSplice,
): (() => void) | null {
  if (!paragraph) return null;
  let badge: Y.XmlElement;
  for (const child of paragraph.toArray()) {
    if (child instanceof Y.XmlText && child.length === 0) continue;
    if (
      badge ||
      !(child instanceof Y.XmlElement) ||
      child.nodeName !== 'status'
    )
      return null;
    badge = child;
  }
  if (!badge || (badge.getAttribute('text') ?? '') !== oldLabel) return null;
  return () => badge.setAttribute('text', newLabel);
}
