import type { Node } from '@tiptap/pm/model'
import { TableMap } from '@tiptap/pm/tables'

/**
 * Convert an array of rows to a table node.
 *
 * @internal
 */
export function convertArrayOfRowsToTableNode(
  tableNode: Node,
  arrayOfNodes: (Node | null)[][],
): Node {
  const rowsPM = []
  const map = TableMap.get(tableNode)
  for (let rowIndex = 0; rowIndex < map.height; rowIndex++) {
    const row = tableNode.child(rowIndex)
    const rowCells = []

    for (let colIndex = 0; colIndex < map.width; colIndex++) {
      if (!arrayOfNodes[rowIndex][colIndex]) continue

      const cellPos = map.map[rowIndex * map.width + colIndex]

      const cell = arrayOfNodes[rowIndex][colIndex]!
      const oldCell = tableNode.nodeAt(cellPos)!
      const newCell = oldCell.type.createChecked(
        Object.assign({}, cell.attrs),
        cell.content,
        cell.marks,
      )
      rowCells.push(newCell)
    }

    rowsPM.push(row.type.createChecked(row.attrs, rowCells, row.marks))
  }

  const newTable = tableNode.type.createChecked(
    tableNode.attrs,
    rowsPM,
    tableNode.marks,
  )

  return newTable
}
