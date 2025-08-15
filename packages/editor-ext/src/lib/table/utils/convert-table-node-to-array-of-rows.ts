import type { Node } from '@tiptap/pm/model'
import { TableMap } from '@tiptap/pm/tables'

/**
 * This function will transform the table node into a matrix of rows and columns
 * respecting merged cells, for example this table:
 *
 * ```
 * ┌──────┬──────┬─────────────┐
 * │  A1  │  B1  │     C1      │
 * ├──────┼──────┴──────┬──────┤
 * │  A2  │     B2      │      │
 * ├──────┼─────────────┤  D1  │
 * │  A3  │  B3  │  C3  │      │
 * └──────┴──────┴──────┴──────┘
 * ```
 *
 * will be converted to the below:
 *
 * ```javascript
 * [
 *   [A1, B1, C1, null],
 *   [A2, B2, null, D1],
 *   [A3, B3, C3, null],
 * ]
 * ```
 * @internal
 */
export function convertTableNodeToArrayOfRows(tableNode: Node): (Node | null)[][] {
  const map = TableMap.get(tableNode)
  const rows: (Node | null)[][] = []
  const rowCount = map.height
  const colCount = map.width
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const row: (Node | null)[] = []
    for (let colIndex = 0; colIndex < colCount; colIndex++) {
      let cellIndex = rowIndex * colCount + colIndex
      let cellPos = map.map[cellIndex]
      if (rowIndex > 0) {
        const topCellIndex = cellIndex - colCount
        const topCellPos = map.map[topCellIndex]
        if (cellPos === topCellPos) {
          row.push(null)
          continue
        }
      }
      if (colIndex > 0) {
        const leftCellIndex = cellIndex - 1
        const leftCellPos = map.map[leftCellIndex]
        if (cellPos === leftCellPos) {
          row.push(null)
          continue
        }
      }
      row.push(tableNode.nodeAt(cellPos))
    }
    rows.push(row)
  }

  return rows
}
