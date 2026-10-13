import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import { NO_VALUE_CHOICE_ID, type IBaseRow } from "@/ee/base/types/base.types";

export function resolveCardDrop(args: {
  draggedRowId: string;
  targetRowId: string | null;
  edge: "top" | "bottom" | null;
  targetColumnKey: string;
  sourceColumnKey: string;
  targetColumnRows: IBaseRow[];
}): { columnChanged: boolean; destChoiceValue: string | null; position: string } | null {
  const { draggedRowId, targetRowId, edge, targetColumnKey, sourceColumnKey, targetColumnRows } = args;
  const columnChanged = sourceColumnKey !== targetColumnKey;
  if (!columnChanged && draggedRowId === targetRowId) return null;
  const destChoiceValue = targetColumnKey === NO_VALUE_CHOICE_ID ? null : targetColumnKey;
  const rows = targetColumnRows.filter((r) => r.id !== draggedRowId);
  let position: string;
  if (!targetRowId || edge === null) {
    const last = rows[rows.length - 1];
    position = generateJitteredKeyBetween(last?.position ?? null, null);
  } else {
    const idx = rows.findIndex((r) => r.id === targetRowId);
    if (idx === -1) {
      const last = rows[rows.length - 1];
      position = generateJitteredKeyBetween(last?.position ?? null, null);
    } else {
      const neighbor = edge === "top" ? idx - 1 : idx + 1;
      const lower = edge === "top" ? rows[neighbor]?.position ?? null : rows[idx].position;
      const upper = edge === "top" ? rows[idx].position : rows[neighbor]?.position ?? null;
      position = generateJitteredKeyBetween(lower, upper);
    }
  }
  return { columnChanged, destChoiceValue, position };
}
