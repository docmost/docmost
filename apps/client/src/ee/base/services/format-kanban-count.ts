export const KANBAN_COUNT_CAP = 99;

export function formatKanbanCount(loaded: number, hasMore: boolean): string {
  return hasMore || loaded > KANBAN_COUNT_CAP
    ? `${KANBAN_COUNT_CAP}+`
    : String(loaded);
}
