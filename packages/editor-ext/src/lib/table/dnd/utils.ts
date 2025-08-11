import { cellAround, TableMap } from "@tiptap/pm/tables"
import { EditorView } from "@tiptap/pm/view"

export function isHoveringCellInfoEqual(
  a?: HoveringCellInfo | null,
  b?: HoveringCellInfo | null,
): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return (
    a.rowIndex === b.rowIndex
    && a.colIndex === b.colIndex
    && a.cellPos === b.cellPos
    && a.rowFirstCellPos === b.rowFirstCellPos
    && a.colFirstCellPos === b.colFirstCellPos
  )
}

export function getHoveringCell(
  view: EditorView,
  event: MouseEvent,
): HoveringCellInfo | undefined {
  const domCell = domCellAround(event.target as HTMLElement | null)
  if (!domCell) return

  const { left, top, width, height } = domCell.getBoundingClientRect()
  const eventPos = view.posAtCoords({
    // Use the center coordinates of the cell to ensure we're within the
    // selected cell. This prevents potential issues when the mouse is on the
    // border of two cells.
    left: left + width / 2,
    top: top + height / 2,
  })
  if (!eventPos) return

  const $cellPos = cellAround(view.state.doc.resolve(eventPos.pos))
  if (!$cellPos) return

  const map = TableMap.get($cellPos.node(-1))
  const tableStart = $cellPos.start(-1)
  const cellRect = map.findCell($cellPos.pos - tableStart)
  const rowIndex = cellRect.top
  const colIndex = cellRect.left

  return {
    rowIndex,
    colIndex,
    cellPos: $cellPos.pos,
    rowFirstCellPos: getCellPos(map, tableStart, rowIndex, 0),
    colFirstCellPos: getCellPos(map, tableStart, 0, colIndex),
  }
}

function domCellAround(target: HTMLElement | null): HTMLElement | null {
  while (target && target.nodeName != 'TD' && target.nodeName != 'TH') {
    target = target.classList?.contains('ProseMirror')
      ? null
      : (target.parentNode as HTMLElement | null)
  }
  return target
}

export interface HoveringCellInfo {
  rowIndex: number
  colIndex: number
  cellPos: number
  rowFirstCellPos: number
  colFirstCellPos: number
}

function getCellPos(
  map: TableMap,
  tableStart: number,
  rowIndex: number,
  colIndex: number,
) {
  const cellIndex = getCellIndex(map, rowIndex, colIndex)
  const posInTable = map.map[cellIndex]
  return tableStart + posInTable
}

function getCellIndex(
  map: TableMap,
  rowIndex: number,
  colIndex: number,
): number {
  return map.width * rowIndex + colIndex
}