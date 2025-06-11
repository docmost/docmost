import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { Node as ProseMirrorNode } from 'prosemirror-model'

// 🔧 Overlay helper functions
function createOrUpdateOverlay(id: string, rect: DOMRect) {
  let overlay = document.getElementById(id) as HTMLElement
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id = id
    overlay.className = 'drag-overlay'
    document.body.appendChild(overlay)
  }

  overlay.style.top = `${rect.top + window.scrollY}px`
  overlay.style.left = `${rect.left + window.scrollX}px`
  overlay.style.width = `${rect.width}px`
  overlay.style.height = `${rect.height}px`
}

function removeOverlay(id: string) {
  const overlay = document.getElementById(id)
  if (overlay) overlay.remove()
}

function removeAllOverlays() {
  removeOverlay('drag-overlay')
  removeOverlay('drop-target-overlay')
}

export const TableDragManager = Extension.create({
  name: 'tableDragManager',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('table-drag-manager'),

        state: {
          init: () => DecorationSet.empty,
          apply: (tr, set) => set.map(tr.mapping, tr.doc),
        },

        props: {
          decorations(state) {
            const decorations: Decoration[] = []
            let tableIndex = 0

            state.doc.descendants((node, pos) => {
              if (node.type.name === 'table') {
                const tableId = `table-${tableIndex++}`

                let rowIndex = 0
                node.descendants((child, childPos) => {
                  const absPos = pos + 1 + childPos

                  if (child.type.name === 'tableHeader') {
                    decorations.push(
                      Decoration.node(absPos, absPos + child.nodeSize, {
                        draggable: 'true',
                        class: 'draggable-column-header',
                        'data-table-id': tableId,
                        'data-col-header': 'true',
                      })
                    )
                  }

                  if (child.type.name === 'tableRow') {
                    decorations.push(
                      Decoration.node(absPos, absPos + child.nodeSize, {
                        draggable: 'true',
                        class: 'draggable-table-row',
                        'data-table-id': tableId,
                        'data-row-index': String(rowIndex++),
                      })
                    )
                  }
                })
              }
            })

            return DecorationSet.create(state.doc, decorations)
          },

          handleDOMEvents: {
            dragstart(view, event) {
              const target = event.target as HTMLElement
              const th = target.closest('th')
              const trEl = target.closest('tr')

              if (th) {
                const index = Array.from(th.parentElement!.children).indexOf(th)
                const tableId = th.getAttribute('data-table-id') || ''
                event.dataTransfer?.setData('drag-type', 'col')
                event.dataTransfer?.setData('col-index', String(index))
                event.dataTransfer?.setData('table-id', tableId)

                setTimeout(() => {
                  const table = th.closest('table')
                  if (!table) return
                  const cells = Array.from(table.querySelectorAll(`tr > *:nth-child(${index + 1})`))
                  if (cells.length === 0) return

                  const first = cells[0] as HTMLElement
                  const last = cells[cells.length - 1] as HTMLElement
                  const rect1 = first.getBoundingClientRect()
                  const rect2 = last.getBoundingClientRect()

                  createOrUpdateOverlay('drag-overlay', new DOMRect(
                    rect1.left,
                    rect1.top,
                    rect1.width,
                    rect2.bottom - rect1.top
                  ))
                }, 0)

                return true
              }

              if (trEl) {
                const index = parseInt(trEl.getAttribute('data-row-index') || '0', 10)
                const tableId = trEl.getAttribute('data-table-id') || ''
                event.dataTransfer?.setData('drag-type', 'row')
                event.dataTransfer?.setData('row-index', String(index))
                event.dataTransfer?.setData('table-id', tableId)

                setTimeout(() => {
                  const rect = trEl.getBoundingClientRect()
                  createOrUpdateOverlay('drag-overlay', rect)
                }, 0)

                return true
              }

              return false
            },

            dragover(view, event) {
              event.preventDefault()
              const target = event.target as HTMLElement
              const dragType = event.dataTransfer?.getData('drag-type')

              if (dragType === 'col') {
                const targetTh = target.closest('th')
                if (targetTh) {
                  const table = targetTh.closest('table')
                  if (!table) return false
                  const index = Array.from(targetTh.parentElement!.children).indexOf(targetTh)
                  const cells = Array.from(table.querySelectorAll(`tr > *:nth-child(${index + 1})`))
                  if (cells.length === 0) return false

                  const first = cells[0] as HTMLElement
                  const last = cells[cells.length - 1] as HTMLElement
                  const rect1 = first.getBoundingClientRect()
                  const rect2 = last.getBoundingClientRect()

                  createOrUpdateOverlay('drop-target-overlay', new DOMRect(
                    rect1.left,
                    rect1.top,
                    rect1.width,
                    rect2.bottom - rect1.top
                  ))
                }
              }

              if (dragType === 'row') {
                const targetRow = target.closest('tr')
                if (targetRow) {
                  const rect = targetRow.getBoundingClientRect()
                  createOrUpdateOverlay('drop-target-overlay', rect)
                }
              }

              return false
            },

            drop(view, event) {
              removeAllOverlays()

              const target = event.target as HTMLElement
              const dragType = event.dataTransfer?.getData('drag-type')
              const tableId = event.dataTransfer?.getData('table-id')
              const { state, dispatch } = view
              const tr = state.tr
              let tableMatchIndex = 0

              if (dragType === 'col') {
                const fromIndex = parseInt(event.dataTransfer?.getData('col-index') || '-1', 10)
                const targetTh = target.closest('th')
                if (!targetTh || !tableId || fromIndex === -1) return false

                const toIndex = Array.from(targetTh.parentElement!.children).indexOf(targetTh)
                if (fromIndex === toIndex) return false

                state.doc.descendants((node, pos) => {
                  if (node.type.name === 'table') {
                    const currentId = `table-${tableMatchIndex++}`
                    if (currentId !== tableId) return

                    node.descendants((rowNode, rowPos) => {
                      if (rowNode.type.name === 'tableRow') {
                        const cells: ProseMirrorNode[] = []
                        for (let i = 0; i < rowNode.childCount; i++) {
                          cells.push(rowNode.child(i))
                        }

                        const fromCell = cells[fromIndex]
                        if (!fromCell) return

                        const newCells = [...cells]
                        newCells.splice(fromIndex, 1)
                        newCells.splice(toIndex, 0, fromCell)

                        const absRowPos = pos + 1 + rowPos
                        let offset = 0
                        newCells.forEach((cell, i) => {
                          const oldCell = rowNode.child(i)
                          const cellPos = absRowPos + offset
                          tr.replaceWith(cellPos, cellPos + oldCell.nodeSize, cell)
                          offset += cell.nodeSize
                        })
                      }
                    })
                  }
                })

                dispatch(tr)
                return true
              }

              if (dragType === 'row') {
                const fromIndex = parseInt(event.dataTransfer?.getData('row-index') || '-1', 10)
                const targetRow = target.closest('tr')
                if (!targetRow || !tableId || fromIndex === -1) return false

                const toIndex = parseInt(targetRow.getAttribute('data-row-index') || '-1', 10)
                if (fromIndex === toIndex) return false

                state.doc.descendants((node, pos) => {
                  if (node.type.name === 'table') {
                    const currentId = `table-${tableMatchIndex++}`
                    if (currentId !== tableId) return

                    const rows: ProseMirrorNode[] = []
                    node.forEach((rowNode) => {
                      if (rowNode.type.name === 'tableRow') {
                        rows.push(rowNode)
                      }
                    })

                    const fromRow = rows[fromIndex]
                    if (!fromRow) return

                    const newRows = [...rows]
                    newRows.splice(fromIndex, 1)
                    newRows.splice(toIndex, 0, fromRow)

                    let offset = 0
                    newRows.forEach((rowNode, i) => {
                      const oldRow = rows[i]
                      const rowPos = pos + 1 + offset
                      tr.replaceWith(rowPos, rowPos + oldRow.nodeSize, rowNode)
                      offset += rowNode.nodeSize
                    })
                  }
                })

                dispatch(tr)
                return true
              }

              return false
            },

            dragend() {
              removeAllOverlays()
              return false
            },
          },
        },
      }),
    ]
  },
})
