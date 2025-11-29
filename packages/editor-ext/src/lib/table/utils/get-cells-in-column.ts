import type { Selection } from '@tiptap/pm/state'
import { TableMap } from '@tiptap/pm/tables'

import { findTable } from './query'
import type { CellPos } from './types'

/**
 * Returns an array of cells in a column(s), where `columnIndex` could be a column index or an array of column indexes.
 *
 * @internal
 */
export function getCellsInColumn(columnIndexes: number | number[], selection: Selection): CellPos[] | undefined {
  const table = findTable(selection.$from)
  if (!table) {
    return
  }

  const map = TableMap.get(table.node)
  const indexes = Array.isArray(columnIndexes) ? columnIndexes : [columnIndexes]

  return indexes
    .filter((index) => index >= 0 && index <= map.width - 1)
    .flatMap((index) => {
      const cells = map.cellsInRect({
        left: index,
        right: index + 1,
        top: 0,
        bottom: map.height,
      })
      return cells.map((nodePos) => {
        const node = table.node.nodeAt(nodePos)!
        const pos = nodePos + table.start
        return { pos, start: pos + 1, node, depth: table.depth + 2 }
      })
    })
}
