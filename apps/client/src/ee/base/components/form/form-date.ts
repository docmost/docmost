import type { DateCell, DateKind } from "@docmost/base-formula/client";
import type { PublicFormField } from "@/ee/base/types/base.types";
import { fromWallString, toWallString } from "@/ee/base/utils/wall-clock";

export function formDateKind(field: Pick<PublicFormField, "includeTime">): DateKind {
  return field.includeTime === true ? "datetime" : "date";
}

export function toDateTimeInput(
  cell: DateCell | null,
  timeZone: string,
): string | null {
  if (!cell) return null;
  try {
    return toWallString(cell.start, timeZone);
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}

export function fromDateTimeInput(
  input: string | null,
  current: DateCell | null,
  timeZone: string,
): DateCell | null {
  if (!input) return null;
  const wall = input.slice(0, 19);
  if (current && toDateTimeInput(current, timeZone) === wall) return current;
  try {
    return { start: fromWallString(wall, timeZone) };
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}
