export function clearPreviewDOM(previewRoot: HTMLElement): void {
  while (previewRoot.firstChild) {
    previewRoot.removeChild(previewRoot.firstChild)
  }
}

export function createPreviewDOM(
  table: HTMLTableElement,
  previewRoot: HTMLElement,
  index: number,
  direction: 'row' | 'col',
): void {
  clearPreviewDOM(previewRoot)

  const previewTable = document.createElement('table')
  const previewTableBody = document.createElement('tbody')
  previewTable.appendChild(previewTableBody)
  previewRoot.appendChild(previewTable)

  const rows = table.querySelectorAll('tr')

  if (direction === 'row') {
    const row = rows[index]
    const rowDOM = row.cloneNode(true)
    previewTableBody.appendChild(rowDOM)
  } else {
    rows.forEach((row) => {
      const rowDOM = row.cloneNode(false)
      const cells = row.querySelectorAll('th,td')
      if (cells[index]) {
        const cellDOM = cells[index].cloneNode(true)
        rowDOM.appendChild(cellDOM)
        previewTableBody.appendChild(rowDOM)
      }
    })
  }
}