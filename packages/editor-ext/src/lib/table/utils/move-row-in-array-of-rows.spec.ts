import {
  describe,
  expect,
  it,
} from 'vitest'

import { setupTest } from '../../testing'

import { moveRowInArrayOfRows } from './move-row-in-array-of-rows'

describe('moveRowInArrayOfRows', () => {
  describe('single element moves', () => {
    it('should move element down (forward)', () => {
      const rows = [0, 1, 2, 3, 4]
      const result = moveRowInArrayOfRows(rows, [1], [3], 0)
      expect(result).toEqual([0, 2, 3, 1, 4])
    })

    it('should move element up (backward)', () => {
      const rows = [0, 1, 2, 3, 4]
      const result = moveRowInArrayOfRows(rows, [3], [1], 0)
      expect(result).toEqual([0, 3, 1, 2, 4])
    })

    it('should move first element to end', () => {
      const rows = [0, 1, 2, 3]
      const result = moveRowInArrayOfRows(rows, [0], [3], 0)
      expect(result).toEqual([1, 2, 3, 0])
    })

    it('should move last element to beginning', () => {
      const rows = [0, 1, 2, 3]
      const result = moveRowInArrayOfRows(rows, [3], [0], 0)
      expect(result).toEqual([3, 0, 1, 2])
    })
  })

  describe('multiple element moves', () => {
    it('should move two consecutive elements down', () => {
      const rows = [0, 1, 2, 3, 4, 5]
      const result = moveRowInArrayOfRows(rows, [1, 2], [4, 5], 0)
      expect(result).toEqual([0, 3, 4, 5, 1, 2])
    })

    it('should move two consecutive elements up', () => {
      const rows = [0, 1, 2, 3, 4, 5]
      const result = moveRowInArrayOfRows(rows, [4, 5], [1, 2], 0)
      expect(result).toEqual([0, 4, 5, 1, 2, 3])
    })

    it('should move three elements', () => {
      const rows = [0, 1, 2, 3, 4, 5, 6]
      const result = moveRowInArrayOfRows(rows, [1, 2, 3], [5, 6], 0)
      expect(result).toEqual([0, 4, 5, 6, 1, 2, 3])
    })
  })

  describe('direction overrides', () => {
    it('should handle override -1 (force before target)', () => {
      const rows = [0, 1, 2, 3, 4, 5]
      const result = moveRowInArrayOfRows(rows, [1], [4], -1)
      expect(result).toEqual([0, 2, 3, 1, 4, 5])
    })

    it('should handle override 0 (natural direction)', () => {
      const rows = [0, 1, 2, 3, 4, 5]
      const result = moveRowInArrayOfRows(rows, [1], [4], 0)
      expect(result).toEqual([0, 2, 3, 4, 1, 5])
    })

    it('should handle override +1 (force after target)', () => {
      const rows = [0, 1, 2, 3, 4]
      const result = moveRowInArrayOfRows(rows, [3], [1], 1)
      expect(result).toEqual([0, 1, 3, 2, 4])
    })
  })

  describe('edge cases', () => {
    it('should handle single element array', () => {
      const rows = [0]
      const result = moveRowInArrayOfRows(rows, [0], [0], 0)
      expect(result).toEqual([0])
    })

    it('should handle two element array', () => {
      const rows = [0, 1]
      const result = moveRowInArrayOfRows(rows, [0], [1], 0)
      expect(result).toEqual([1, 0])
    })

    it('should handle moving to same position', () => {
      const rows = [0, 1, 2, 3]
      const result = moveRowInArrayOfRows(rows, [2], [2], 0)
      expect(result).toEqual([0, 1, 2, 3])
    })

    it('should handle adjacent elements', () => {
      const rows = [0, 1, 2, 3]
      const result = moveRowInArrayOfRows(rows, [1], [2], 0)
      expect(result).toEqual([0, 2, 1, 3])
    })
  })

  describe('data types', () => {
    it('should work with strings', () => {
      const rows = ['a', 'b', 'c', 'd']
      const result = moveRowInArrayOfRows(rows, [0], [2], 0)
      expect(result).toEqual(['b', 'c', 'a', 'd'])
    })

    it('should work with mixed types', () => {
      const rows = [1, 'a', true, null, 4]
      const result = moveRowInArrayOfRows(rows, [1], [3], 0)
      expect(result).toEqual([1, true, null, 'a', 4])
    })

    it('should work with table cell nodes', () => {
      const { n: { td } } = setupTest()
      const rows = [
        [td('0'), td('A')],
        [td('1'), td('B')],
        [td('2'), td('C')],
      ]

      const result = moveRowInArrayOfRows(rows, [2], [0], 0)
      expect(result[0][0]?.textContent).toBe('2')
      expect(result[1][0]?.textContent).toBe('0')
      expect(result[2][0]?.textContent).toBe('1')
    })
  })

  describe('complex scenarios', () => {
    it('should handle large arrays', () => {
      const rows = Array.from({ length: 10 }, (_, i) => i) // [0,1,2,3,4,5,6,7,8,9]
      const result = moveRowInArrayOfRows(rows, [2, 3, 4], [7, 8, 9], 0)
      expect(result).toEqual([0, 1, 5, 6, 7, 8, 9, 2, 3, 4])
    })

    it('should handle moving entire beginning to end', () => {
      const rows = [0, 1, 2, 3, 4]
      const result = moveRowInArrayOfRows(rows, [0, 1, 2], [4], 0)
      expect(result).toEqual([3, 4, 0, 1, 2])
    })

    it('should handle moving entire end to beginning', () => {
      const rows = [0, 1, 2, 3, 4]
      const result = moveRowInArrayOfRows(rows, [3, 4], [0, 1], 0)
      expect(result).toEqual([3, 4, 0, 1, 2])
    })
  })
})
