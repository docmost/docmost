import type { Node } from '@tiptap/pm/model'
import {
  describe,
  expect,
  it,
} from 'vitest'

import { setupTest } from '../../testing'
import type { CellAttrs } from '../table-spec.js'

import { convertArrayOfRowsToTableNode } from './convert-array-of-rows-to-table-node'
import { convertTableNodeToArrayOfRows } from './convert-table-node-to-array-of-rows'

function setup() {
  const { n } = setupTest()
  const defaultCellAttrs: CellAttrs = { colspan: 1, rowspan: 1, colwidth: null }

  const c = (text?: string, attrs?: Partial<CellAttrs>) => {
    return n.tableCell({ ...defaultCellAttrs, ...attrs }, text ? n.p(text) : n.p())
  }
  const r = n.tableRow

  return { n, c, r }
}

describe('convertArrayOfRowsToTableNode', () => {
  const expectTableEquals = (a: Node, b: Node) => {
    // a and b are not the same node
    expect(a !== b).toBe(true)

    // a and b have the same data
    expect(a.eq(b)).toBe(true)
  }

  it('should convert array of rows back to table node (roundtrip)', () => {
    const { n, c, r } = setup()
    const originalTable = n.table(
      r(c('A1'), c('B1')),
      r(c('A2'), c('B2')),
    )

    const arrayOfRows = convertTableNodeToArrayOfRows(originalTable)
    const newTable = convertArrayOfRowsToTableNode(originalTable, arrayOfRows)

    expectTableEquals(originalTable, newTable)
  })

  it('should handle modified cell content', () => {
    const { n, c, r } = setup()
    const originalTable = n.table(
      r(c('A1'), c('B1')),
      r(c('A2'), c('B2')),
    )

    const arrayOfRows = convertTableNodeToArrayOfRows(originalTable)
    // Modify the content of one cell
    arrayOfRows[0][1] = n.tableCell(n.p('Modified'))

    const newTable = convertArrayOfRowsToTableNode(originalTable, arrayOfRows)

    const expectedTable = n.table(
      r(c('A1'), c('Modified')),
      r(c('A2'), c('B2')),
    )

    expectTableEquals(expectedTable, newTable)
  })

  it('should handle empty cells in array', () => {
    const { n, c, r } = setup()
    const originalTable = n.table(
      r(c('A1'), c('B1')),
      r(c('A2'), c('B2')),
    )

    const arrayOfRows = convertTableNodeToArrayOfRows(originalTable)
    // Replace one cell with an empty cell
    arrayOfRows[1][0] = n.tableCell(n.p())

    const newTable = convertArrayOfRowsToTableNode(originalTable, arrayOfRows)

    const expectedTable = n.table(
      r(c('A1'), c('B1')),
      r(c(''), c('B2')),
    )

    expectTableEquals(expectedTable, newTable)
  })

  it('should handle multiple cell modifications', () => {
    const { n, c, r } = setup()
    const originalTable = n.table(
      r(c('A1'), c('B1'), c('C1')),
      r(c('A2'), c('B2'), c('C2')),
      r(c('A3'), c('B3'), c('C3')),
    )

    const arrayOfRows = convertTableNodeToArrayOfRows(originalTable)
    // Modify multiple cells
    arrayOfRows[0][0] = n.tableCell(n.p('New A1'))
    arrayOfRows[1][1] = n.tableCell(n.p('New B2'))
    arrayOfRows[2][2] = n.tableCell(n.p('New C3'))

    const newTable = convertArrayOfRowsToTableNode(originalTable, arrayOfRows)

    const expectedTable = n.table(
      r(c('New A1'), c('B1'), c('C1')),
      r(c('A2'), c('New B2'), c('C2')),
      r(c('A3'), c('B3'), c('New C3')),
    )

    expectTableEquals(expectedTable, newTable)
  })

  it('should handle tables with merged cells', () => {
    const { n: { table, tr, td }, c } = setup()
    const originalTable = table(
      tr(td('A1'), c('B1'), c('C1', { colspan: 2 })),
      tr(td('A2'), c('B2', { colspan: 2 }), c('D1', { rowspan: 2 })),
      tr(td('A3'), c('B3'), c('C3')),
    )

    const arrayOfRows = convertTableNodeToArrayOfRows(originalTable)
    const newTable = convertArrayOfRowsToTableNode(originalTable, arrayOfRows)

    expectTableEquals(originalTable, newTable)
  })

  it('should handle modified cells in merged table', () => {
    const { n, c, r } = setup()
    const originalTable = n.table(
      r(c('A1'), c('B1'), c('C1', { colspan: 2 })),
      r(c('A2'), c('B2', { colspan: 2 }), c('D1', { rowspan: 2 })),
      r(c('A3'), c('B3'), c('C3')),
    )

    const arrayOfRows = convertTableNodeToArrayOfRows(originalTable)
    // Modify a cell in the merged table
    arrayOfRows[0][2] = n.tableCell({ colspan: 2, rowspan: 1, colwidth: null }, n.p('Modified C1'))

    const newTable = convertArrayOfRowsToTableNode(originalTable, arrayOfRows)

    const expectedTable = n.table(
      r(c('A1'), c('B1'), c('Modified C1', { colspan: 2 })),
      r(c('A2'), c('B2', { colspan: 2 }), c('D1', { rowspan: 2 })),
      r(c('A3'), c('B3'), c('C3')),
    )

    expectTableEquals(expectedTable, newTable)
  })

  it('should handle single row table conversion', () => {
    const { n, c, r } = setup()
    const originalTable = n.table(
      r(c('Single'), c('Row'), c('Table')),
    )

    const arrayOfRows = convertTableNodeToArrayOfRows(originalTable)
    // Modify middle cell
    arrayOfRows[0][1] = n.tableCell(n.p('Modified'))

    const newTable = convertArrayOfRowsToTableNode(originalTable, arrayOfRows)

    const expectedTable = n.table(
      r(c('Single'), c('Modified'), c('Table')),
    )

    expectTableEquals(expectedTable, newTable)
  })

  it('should handle single column table conversion', () => {
    const { n, c, r } = setup()
    const originalTable = n.table(
      r(c('A1')),
      r(c('A2')),
      r(c('A3')),
    )

    const arrayOfRows = convertTableNodeToArrayOfRows(originalTable)
    // Modify middle cell
    arrayOfRows[1][0] = n.tableCell(n.p('Modified A2'))

    const newTable = convertArrayOfRowsToTableNode(originalTable, arrayOfRows)

    const expectedTable = n.table(
      r(c('A1')),
      r(c('Modified A2')),
      r(c('A3')),
    )

    expectTableEquals(expectedTable, newTable)
  })

  it('should preserve cell attributes when modifying content', () => {
    const { n, c, r } = setup()
    const originalTable = n.table(
      r(c('A1'), c('B1', { colspan: 2 })),
      r(c('A2', { rowspan: 2 }), c('B2'), c('C2')),
      r(c('B3'), c('C3')),
    )

    const arrayOfRows = convertTableNodeToArrayOfRows(originalTable)
    // Modify content while preserving attributes
    arrayOfRows[0][1] = n.tableCell({ colspan: 2, rowspan: 1, colwidth: null }, n.p('Modified B1'))
    arrayOfRows[1][0] = n.tableCell({ colspan: 1, rowspan: 2, colwidth: null }, n.p('Modified A2'))

    const newTable = convertArrayOfRowsToTableNode(originalTable, arrayOfRows)

    const expectedTable = n.table(
      r(c('A1'), c('Modified B1', { colspan: 2 })),
      r(c('Modified A2', { rowspan: 2 }), c('B2'), c('C2')),
      r(c('B3'), c('C3')),
    )

    expectTableEquals(expectedTable, newTable)
  })
})
