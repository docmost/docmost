import { cellAround, TableMap } from "@tiptap/pm/tables"
import { ResolvedPos } from "@tiptap/pm/model"
import { EditorView } from "@tiptap/pm/view"

export function getHoveringCell(
  view: EditorView,
  event: MouseEvent,
): HoveringCellInfo | undefined {
  const domCell = domCellAround(event.target as HTMLElement | null)
  if (!domCell) return

  // Resolve directly from the cell DOM rather than via coords. The previous
  // center-coords approach broke on tall merged cells — their visual center
  // can land in empty space whose closest PM position resolves to an
  // adjacent cell. `posAtDOM(td, 0)` is always inside this cell, regardless
  // of rowspan/colspan.
  let pos: number
  try {
    pos = view.posAtDOM(domCell, 0)
  } catch {
    return
  }
  const $cellPos = cellAround(view.state.doc.resolve(pos))
  if (!$cellPos) return

  return cellInfoFromResolvedCell($cellPos)
}

/**
 * Build HoveringCellInfo from a resolved position whose parent is a
 * table cell (i.e. the result of `cellAround` on some inner position).
 */
export function cellInfoFromResolvedCell(
  $cellPos: ResolvedPos,
): HoveringCellInfo {
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

function getTableDOMByPos(view: EditorView, pos: number): HTMLTableElement | undefined {
  const dom = view.domAtPos(pos).node
  if (!dom) return
  const element = dom instanceof HTMLElement ? dom : dom.parentElement
  const table = element?.closest('table')
  return table ?? undefined
}

function getTargetFirstCellDOM(table: HTMLTableElement, index: number, direction: 'row' | 'col'): HTMLTableCellElement | undefined {
  if (direction === 'row') {
    const row = table.querySelectorAll('tr')[index]
    const cell = row?.querySelector<HTMLTableCellElement>('th,td')
    return cell ?? undefined
  } else {
    const row = table.querySelector('tr')
    const cell = row?.querySelectorAll<HTMLTableCellElement>('th,td')[index]
    return cell ?? undefined
  }
}

export type DraggingDOMs = {
    table: HTMLTableElement
    cell: HTMLTableCellElement
}

export function getDndRelatedDOMs(view: EditorView, cellPos: number | undefined, draggingIndex: number, direction: 'row' | 'col'): DraggingDOMs | undefined {
  if (cellPos == null) return
  const table = getTableDOMByPos(view, cellPos)
  if (!table) return
  const cell = getTargetFirstCellDOM(table, draggingIndex, direction)
  if (!cell) return
  return { table, cell }
}