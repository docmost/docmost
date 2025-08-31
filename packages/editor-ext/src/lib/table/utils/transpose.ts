/**
 * Transposes a 2D array by flipping columns to rows.
 *
 * Transposition is a familiar algebra concept where the matrix is flipped
 * along its diagonal. For more details, see:
 * https://en.wikipedia.org/wiki/Transpose
 *
 * @example
 * ```javascript
 * const arr = [
 *   ['a1', 'a2', 'a3'],
 *   ['b1', 'b2', 'b3'],
 *   ['c1', 'c2', 'c3'],
 *   ['d1', 'd2', 'd3'],
 * ];
 *
 * const result = transpose(arr);
 * result === [
 *   ['a1', 'b1', 'c1', 'd1'],
 *   ['a2', 'b2', 'c2', 'd2'],
 *   ['a3', 'b3', 'c3', 'd3'],
 * ]
 * ```
 */
export function transpose<T>(array: T[][]): T[][] {
  return array[0].map((_, i) => {
    return array.map((column) => column[i])
  })
}
