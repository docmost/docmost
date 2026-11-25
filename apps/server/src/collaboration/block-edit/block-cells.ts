import { Fragment, type Node } from '@tiptap/pm/model';
import type {
  CellEdit,
  FormatSplice,
  StatusSplice,
  TextSplice,
} from './block-edits.types';
import { isStatusColor, statusSplice } from './block-status';
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
  color?: CellEdit['color'];
  splice?: TextSplice | FormatSplice | StatusSplice;
};

type CellChangeFailure = { error: string; column?: number; code?: string };

export function resolveCellChanges(
  row: Node,
  rowPath: number[],
  changes: CellEdit[],
): CellChange[] | CellChangeFailure {
  if (row.type.name !== 'tableRow')
    return { error: 'update_cells requires a table row ref.' };
  if (!Array.isArray(changes) || !changes.length)
    return { error: 'update_cells requires at least one cell change.' };
  const columns = new Set<number>();
  const result: CellChange[] = [];
  for (const change of changes) {
    const column = change?.column;
    if (!Number.isSafeInteger(column) || column < 1 || column > row.childCount)
      return {
        code: 'invalid_cell_column',
        error: `Select a physical cell from column 1 to ${row.childCount} in this row.`,
      };
    if (columns.has(column))
      return { column, error: `Column ${column} is specified more than once.` };
    columns.add(column);
    const { oldValue, newValue, color } = change;
    if (typeof oldValue !== 'string' || typeof newValue !== 'string')
      return {
        column,
        error: `Column ${column} requires string oldValue and newValue.`,
      };
    if (/\p{Surrogate}/u.test(newValue))
      return {
        column,
        error: `Column ${column} contains an incomplete Unicode character.`,
      };
    const cell = row.child(column - 1);
    const current = editableCellValue(cell);
    if (current === undefined)
      return {
        column,
        error: `Column ${column} must contain a single paragraph of text or a single native status badge.`,
      };
    if (current !== oldValue)
      return {
        column,
        code: 'cell_value_mismatch',
        error: `The oldValue for column ${column} does not match its exact current value. Read the row again.`,
      };

    const path = [...rowPath, column - 1];
    const block = cell.firstChild;
    const badge =
      block.firstChild?.type.name === 'status' ? block.firstChild : undefined;
    if (color !== undefined) {
      if (!badge)
        return {
          column,
          error: `Column ${column} needs a single native status badge to set its color.`,
        };
      if (!isStatusColor(color))
        return {
          column,
          error: `Column ${column} has an unsupported status color.`,
        };
    }
    if (newValue === oldValue && color === undefined) {
      result.push({ column, path, cell });
      continue;
    }
    const blockPath = [...path, 0];
    let after: Node;
    let splice: CellChange['splice'];
    if (badge) {
      splice = statusSplice(block, blockPath, 0, newValue, color);
      const updated = badge.type.create(
        { ...badge.attrs, ...splice.patch },
        badge.content,
        badge.marks,
      );
      after = block.copy(Fragment.from(updated));
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
      if (typeof text === 'string')
        return { column, error: `Column ${column}: ${text}` };
      after = applyTextChange(block, text);
      const marked = block.children.filter((node) => node.marks.length);
      const remaining = after.children.filter((node) => node.marks.length);
      if (
        marked.length !== remaining.length ||
        marked.some((node, i) => !node.sameMarkup(remaining[i]))
      )
        return {
          column,
          error: `Column ${column} would lose existing formatting or a comment highlight.`,
        };
      splice = text.splice;
    }
    result.push({
      column,
      color,
      path,
      cell: cell.copy(Fragment.from(after)),
      splice,
    });
  }
  return result;
}
