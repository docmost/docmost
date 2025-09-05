function findDragOverElement(
  elements: Element[],
  pointer: number,
  axis: 'x' | 'y',
): [Element, number] | undefined {
  const startProp = axis === 'x' ? 'left' : 'top'
  const endProp = axis === 'x' ? 'right' : 'bottom'
  const lastIndex = elements.length - 1

  const index = elements.findIndex((el, index) => {
    const rect = el.getBoundingClientRect()
    const boundaryStart = rect[startProp]
    const boundaryEnd = rect[endProp]

    // The pointer is within the boundary of the current element.
    if (boundaryStart <= pointer && pointer <= boundaryEnd) return true
    // The pointer is beyond the last element.
    if (index === lastIndex && pointer > boundaryEnd) return true
    // The pointer is before the first element.
    if (index === 0 && pointer < boundaryStart) return true

    return false
  })

  return index >= 0 ? [elements[index], index] : undefined
}

export function getDragOverColumn(
  table: HTMLTableElement,
  pointerX: number,
): [element: Element, index: number] | undefined {
  const firstRow = table.querySelector('tr')
  if (!firstRow) return
  const cells = Array.from(firstRow.children)
  return findDragOverElement(cells, pointerX, 'x')
}

export function getDragOverRow(
  table: HTMLTableElement,
  pointerY: number,
): [element: Element, index: number] | undefined {
  const rows = Array.from(table.querySelectorAll('tr'))
  return findDragOverElement(rows, pointerY, 'y')
}