import type { Node } from '@tiptap/pm/model'
import {
  describe,
  expect,
  it,
} from 'vitest'

import { setupTest } from '../../testing'

import { convertTableNodeToArrayOfRows } from './convert-table-node-to-array-of-rows'

describe('convertTableNodeToArrayOfRows', () => {
  const convert = (tableNode: Node): (string | null)[][] => {
    const rows = convertTableNodeToArrayOfRows(tableNode)
    return rows.map((row) => row.map((cell) => cell?.textContent ?? null))
  }

  it('should convert a simple table to array of rows', () => {
    const { n: { table, tr, td } } = setupTest()
    const tableNode = table(
      tr(td('A1'), td('B1')),
      tr(td('A2'), td('B2')),
    )

    expect(convert(tableNode)).toEqual([
      ['A1', 'B1'],
      ['A2', 'B2'],
    ])
  })

  it('should handle empty cells', () => {
    const { n: { table, tr, td } } = setupTest()
    const tableNode = table(
      tr(td('A1'), td()),
      tr(td(), td('B2')),
    )

    expect(convert(tableNode)).toEqual([
      ['A1', ''],
      ['', 'B2'],
    ])
  })

  it('should handle tables with equal row lengths', () => {
    const { n: { table, tr, td } } = setupTest()
    const tableNode = table(
      tr(td('A1'), td('B1'), td('C1')),
      tr(td('A2'), td('B2'), td('C2')),
    )

    expect(convert(tableNode)).toEqual([
      ['A1', 'B1', 'C1'],
      ['A2', 'B2', 'C2'],
    ])
  })

  it('should handle single row table', () => {
    const { n: { table, tr, td } } = setupTest()
    const tableNode = table(
      tr(td('Single'), td('Row')),
    )

    expect(convert(tableNode)).toEqual([
      ['Single', 'Row'],
    ])
  })

  it('should handle single column table', () => {
    const { n: { table, tr, td } } = setupTest()
    const tableNode = table(
      tr(td('A1')),
      tr(td('A2')),
      tr(td('A3')),
    )

    expect(convert(tableNode)).toEqual([
      ['A1'],
      ['A2'],
      ['A3'],
    ])
  })

  it('should handle table with merged cells', () => {
    const { n: { table, tr, td } } = setupTest()

    // ┌──────┬──────┬─────────────┐
    // │  A1  │  B1  │     C1      │
    // ├──────┼──────┴──────┬──────┤
    // │  A2  │     B2      │      │
    // ├──────┼─────────────┤  D1  │
    // │  A3  │  B3  │  C3  │      │
    // └──────┴──────┴──────┴──────┘
    const tableNode = table(
      tr(td('A1'), td('B1'), td('C1', { colspan: 2 })),
      tr(td('A2'), td('B2', { colspan: 2 }), td('D1', { rowspan: 2 })),
      tr(td('A3'), td('B3'), td('C3')),
    )

    expect(convert(tableNode)).toEqual([
      ['A1', 'B1', 'C1', null],
      ['A2', 'B2', null, 'D1'],
      ['A3', 'B3', 'C3', null],
    ])
  })
})
