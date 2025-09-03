import type { Transaction } from '@tiptap/pm/state'

import { getCellsInColumn } from './get-cells-in-column'
import { getCellsInRow } from './get-cells-in-row'
import type { CellSelectionRange } from './types'

/**
 * Returns a range of rectangular selection spanning all merged cells around a
 * column at index `columnIndex`.
 *
 * Original implementation from Atlassian (Apache License 2.0)
 *
 * https://bitbucket.org/atlassian/atlassian-frontend-mirror/src/5f91cb871e8248bc3bae5ddc30bb9fd9200fadbb/editor/editor-tables/src/utils/get-selection-range-in-column.ts#editor/editor-tables/src/utils/get-selection-range-in-column.ts
 *
 * @internal
 */
export function getSelectionRangeInColumn(tr: Transaction, startColIndex: number, endColIndex: number = startColIndex): CellSelectionRange | undefined {
  let startIndex = startColIndex
  let endIndex = endColIndex

  // looking for selection start column (startIndex)
  for (let i = startColIndex; i >= 0; i--) {
    const cells = getCellsInColumn(i, tr.selection)
    if (cells) {
      cells.forEach((cell) => {
        const maybeEndIndex = cell.node.attrs.colspan + i - 1
        if (maybeEndIndex >= startIndex) {
          startIndex = i
        }
        if (maybeEndIndex > endIndex) {
          endIndex = maybeEndIndex
        }
      })
    }
  }
  // looking for selection end column (endIndex)
  for (let i = startColIndex; i <= endIndex; i++) {
    const cells = getCellsInColumn(i, tr.selection)
    if (cells) {
      cells.forEach((cell) => {
        const maybeEndIndex = cell.node.attrs.colspan + i - 1
        if (cell.node.attrs.colspan > 1 && maybeEndIndex > endIndex) {
          endIndex = maybeEndIndex
        }
      })
    }
  }

  // filter out columns without cells (where all rows have colspan > 1 in the same column)
  const indexes = []
  for (let i = startIndex; i <= endIndex; i++) {
    const maybeCells = getCellsInColumn(i, tr.selection)
    if (maybeCells && maybeCells.length > 0) {
      indexes.push(i)
    }
  }
  startIndex = indexes[0]
  endIndex = indexes[indexes.length - 1]

  const firstSelectedColumnCells = getCellsInColumn(startIndex, tr.selection)
  const firstRowCells = getCellsInRow(0, tr.selection)
  if (!firstSelectedColumnCells || !firstRowCells) {
    return
  }

  const $anchor = tr.doc.resolve(
    firstSelectedColumnCells[firstSelectedColumnCells.length - 1].pos,
  )

  let headCell
  for (let i = endIndex; i >= startIndex; i--) {
    const columnCells = getCellsInColumn(i, tr.selection)
    if (columnCells && columnCells.length > 0) {
      for (let j = firstRowCells.length - 1; j >= 0; j--) {
        if (firstRowCells[j].pos === columnCells[0].pos) {
          headCell = columnCells[0]
          break
        }
      }
      if (headCell) {
        break
      }
    }
  }
  if (!headCell) {
    return
  }

  const $head = tr.doc.resolve(headCell.pos)
  return { $anchor, $head, indexes }
}
