const ABSOLUTE_ISO_DATE =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;

export function toISODateString(
  dateStr: string | null | undefined,
): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const absolute = ABSOLUTE_ISO_DATE.test(dateStr);
  const year = absolute ? date.getUTCFullYear() : date.getFullYear();
  const monthIndex = absolute ? date.getUTCMonth() : date.getMonth();
  const day = absolute ? date.getUTCDate() : date.getDate();
  const month = String(monthIndex + 1).padStart(2, "0");
  return `${year}-${month}-${String(day).padStart(2, "0")}`;
}

export function toDateCellValue(isoDate: string): string {
  return `${isoDate}T00:00:00.000Z`;
}
