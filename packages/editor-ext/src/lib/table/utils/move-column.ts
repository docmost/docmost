import type { Node } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'
import {
  CellSelection,
  TableMap,
} from '@tiptap/pm/tables'

import { convertArrayOfRowsToTableNode } from './convert-array-of-rows-to-table-node'
import { convertTableNodeToArrayOfRows } from './convert-table-node-to-array-of-rows'
import { getSelectionRangeInColumn } from './get-selection-range-in-column'
import { moveRowInArrayOfRows } from './move-row-in-array-of-rows'
import { findTable } from './query'
import { transpose } from './transpose'

export interface MoveColumnParams {
  tr: Transaction
  originIndex: number
  targetIndex: number
  select: boolean
  pos: number
}

/**
 * Move a column from index `origin` to index `target`.
 *
 * @internal
 */
export function moveColumn(moveColParams: MoveColumnParams): boolean {
  const { tr, originIndex, targetIndex, select, pos } = moveColParams
  const $pos = tr.doc.resolve(pos)
  const table = findTable($pos)
  if (!table) return false

  const indexesOriginColumn = getSelectionRangeInColumn(tr, originIndex)?.indexes
  const indexesTargetColumn = getSelectionRangeInColumn(tr, targetIndex)?.indexes

  if (!indexesOriginColumn || !indexesTargetColumn) return false

  if (indexesOriginColumn.includes(targetIndex)) return false

  const newTable = moveTableColumn(
    table.node,
    indexesOriginColumn,
    indexesTargetColumn,
    0,
  )

  tr.replaceWith(
    table.pos,
    table.pos + table.node.nodeSize,
    newTable,
  )

  if (!select) return true

  const map = TableMap.get(newTable)
  const start = table.start
  const index = targetIndex
  const lastCell = map.positionAt(map.height - 1, index, newTable)
  const $lastCell = tr.doc.resolve(start + lastCell)

  const firstCell = map.positionAt(0, index, newTable)
  const $firstCell = tr.doc.resolve(start + firstCell)

  tr.setSelection(CellSelection.colSelection($lastCell, $firstCell))
  return true
}

function moveTableColumn(
  table: Node,
  indexesOrigin: number[],
  indexesTarget: number[],
  direction: -1 | 1 | 0,
) {
  let rows = transpose(convertTableNodeToArrayOfRows(table))

  rows = moveRowInArrayOfRows(rows, indexesOrigin, indexesTarget, direction)
  rows = transpose(rows)

  return convertArrayOfRowsToTableNode(table, rows)
}
