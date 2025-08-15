/**
 * Move a row in an array of rows.
 *
 * @internal
 */
export function moveRowInArrayOfRows<T>(
  rows: T[],
  indexesOrigin: number[],
  indexesTarget: number[],
  directionOverride: -1 | 1 | 0,
): T[] {
  const direction = indexesOrigin[0] > indexesTarget[0] ? -1 : 1

  const rowsExtracted = rows.splice(indexesOrigin[0], indexesOrigin.length)
  const positionOffset = rowsExtracted.length % 2 === 0 ? 1 : 0
  let target: number

  if (directionOverride === -1 && direction === 1) {
    target = indexesTarget[0] - 1
  } else if (directionOverride === 1 && direction === -1) {
    target = indexesTarget[indexesTarget.length - 1] - positionOffset + 1
  } else {
    target = direction === -1
      ? indexesTarget[0]
      : indexesTarget[indexesTarget.length - 1] - positionOffset
  }

  rows.splice(target, 0, ...rowsExtracted)
  return rows
}
