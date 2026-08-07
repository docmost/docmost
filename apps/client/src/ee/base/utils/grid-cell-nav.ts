import { CellCoord } from "@/ee/base/types/base.types";

export function computeNextCell(
  rowIds: string[],
  colIds: string[],
  current: CellCoord,
  rowDelta: number,
  colDelta: number,
  wrap: boolean,
): CellCoord | null {
  const colIndex = colIds.indexOf(current.propertyId);
  const rowIndex = rowIds.indexOf(current.rowId);
  if (colIndex === -1 || rowIndex === -1) return null;

  let nextCol = colIndex + colDelta;
  let nextRow = rowIndex + rowDelta;

  if (wrap) {
    if (nextCol < 0) {
      nextCol = colIds.length - 1;
      nextRow -= 1;
    } else if (nextCol >= colIds.length) {
      nextCol = 0;
      nextRow += 1;
    }
  } else if (nextCol < 0 || nextCol >= colIds.length) {
    return null;
  }

  if (nextRow < 0 || nextRow >= rowIds.length) return null;

  return { rowId: rowIds[nextRow], propertyId: colIds[nextCol] };
}
