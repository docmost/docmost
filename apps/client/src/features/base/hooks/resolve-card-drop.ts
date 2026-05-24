import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import { IBaseRow, NO_VALUE_CHOICE_ID } from "@/features/base/types/base.types";

type Edge = "top" | "bottom";

export type ResolveCardDropInput = {
  draggedCardId: string;
  targetCardId: string;
  edge: Edge | null;
  sourceColumnKey: string;
  targetColumnKey: string;
  groupByPropertyId: string;
  columnRows: IBaseRow[]; // rows currently in the target column, in display order
  sortsActive: boolean;
};

export type ResolveCardDropResult = {
  cells: Record<string, unknown> | undefined;
  position: string | undefined;
};

export function resolveCardDrop(
  input: ResolveCardDropInput,
): ResolveCardDropResult {
  const {
    draggedCardId,
    targetCardId,
    edge,
    sourceColumnKey,
    targetColumnKey,
    groupByPropertyId,
    columnRows,
    sortsActive,
  } = input;

  const sameColumn = sourceColumnKey === targetColumnKey;

  // Compute the cells patch first.
  const cells = sameColumn
    ? undefined
    : {
        [groupByPropertyId]:
          targetColumnKey === NO_VALUE_CHOICE_ID ? null : targetColumnKey,
      };

  // Same column + sort active → block (caller should have stopped the drag
  // via canDrop, but we return no-op for safety).
  if (sameColumn && sortsActive) {
    return { cells: undefined, position: undefined };
  }

  // Sort active and cross-column → only cells, no position.
  if (sortsActive) {
    return { cells, position: undefined };
  }

  // Sort inactive → compute the slot.
  // Filter the dragged card out of the column (it may already be there
  // when intra-column drag).
  const target = columnRows.filter((r) => r.id !== draggedCardId);
  const targetIndex = target.findIndex((r) => r.id === targetCardId);

  let lower: string | null;
  let upper: string | null;

  if (targetIndex === -1) {
    // Drop on column body / sentinel / below-last → append.
    const last = target[target.length - 1];
    lower = last?.position ?? null;
    upper = null;
  } else if (edge === "top") {
    lower = target[targetIndex - 1]?.position ?? null;
    upper = target[targetIndex].position;
  } else {
    lower = target[targetIndex].position;
    upper = target[targetIndex + 1]?.position ?? null;
  }

  let position: string;
  try {
    position = generateJitteredKeyBetween(lower, upper);
  } catch {
    // Throws whenever `lower >= upper` (the row ordering in `columnRows`
    // briefly diverged from position ordering — typically during a
    // concurrent reorder). Fall back to insert-after-lower. The card lands
    // at the end of the column rather than at the dropped slot; surprising
    // but better than rejecting the drop. The reconciliation arrives via
    // the realtime patch.
    position = generateJitteredKeyBetween(lower, null);
  }
  return { cells, position };
}
