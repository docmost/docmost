import { useMemo } from "react";
import {
  IBaseProperty,
  IBaseRow,
  NO_VALUE_CHOICE_ID,
  SelectTypeOptions,
} from "@/features/base/types/base.types";

export type KanbanColumn = {
  key: string;            // choice id or NO_VALUE_CHOICE_ID
  choiceId: string | null; // null for NO_VALUE column
  name: string;
  color: string | null;
  rows: IBaseRow[];
};

export type PartitionResult = {
  columns: KanbanColumn[];
  groupByPropertyId: string | null;
};

function readChoiceOptions(property: IBaseProperty | undefined): {
  ids: string[];
  byId: Map<string, { id: string; name: string; color: string }>;
} {
  if (!property) return { ids: [], byId: new Map() };
  const opts = (property.typeOptions ?? {}) as Partial<SelectTypeOptions>;
  const choices = opts.choices ?? [];
  const order = (opts.choiceOrder ?? []).filter((id) =>
    choices.some((c) => c.id === id),
  );
  // Any choice not in order: append in choices-array order.
  const ordered = [
    ...order,
    ...choices.filter((c) => !order.includes(c.id)).map((c) => c.id),
  ];
  const byId = new Map<string, { id: string; name: string; color: string }>(
    choices.map((c) => [c.id, c]),
  );
  return { ids: ordered, byId };
}

export function partitionRowsByGroup(
  rows: IBaseRow[],
  property: IBaseProperty | undefined,
  hiddenChoiceIds: string[] | undefined,
  choiceOrderOverride: string[] | undefined,
): PartitionResult {
  if (!property) return { columns: [], groupByPropertyId: null };
  const { ids: propertyChoiceIds, byId } = readChoiceOptions(property);

  // Resolve column key order.
  let order: string[];
  if (choiceOrderOverride && choiceOrderOverride.length > 0) {
    const valid = new Set<string>([...propertyChoiceIds, NO_VALUE_CHOICE_ID]);
    const fromOverride = choiceOrderOverride.filter((id) => valid.has(id));
    const overrideSet = new Set(fromOverride);
    const missingChoices = propertyChoiceIds.filter(
      (id) => !overrideSet.has(id),
    );
    // Only inject NO_VALUE implicitly when there are newly-discovered choices
    // to append — when the override fully covers the current property, leave
    // NO_VALUE off unless the user listed it explicitly.
    const tail =
      missingChoices.length > 0
        ? overrideSet.has(NO_VALUE_CHOICE_ID)
          ? missingChoices
          : [NO_VALUE_CHOICE_ID, ...missingChoices]
        : [];
    order = [...fromOverride, ...tail];
  } else {
    order = [NO_VALUE_CHOICE_ID, ...propertyChoiceIds];
  }
  const hidden = new Set(hiddenChoiceIds ?? []);
  order = order.filter((id) => !hidden.has(id));

  // Build empty buckets first so empty columns still render.
  const buckets = new Map<string, IBaseRow[]>();
  for (const key of order) buckets.set(key, []);

  for (const row of rows) {
    const value = (row.cells ?? {})[property.id];
    const key =
      typeof value === "string" && buckets.has(value)
        ? value
        : NO_VALUE_CHOICE_ID;
    if (!buckets.has(key)) continue; // hidden
    buckets.get(key)!.push(row);
  }

  const columns: KanbanColumn[] = order.map((key) => {
    if (key === NO_VALUE_CHOICE_ID) {
      return {
        key,
        choiceId: null,
        name: "No value",
        color: null,
        rows: buckets.get(key) ?? [],
      };
    }
    const c = byId.get(key);
    return {
      key,
      choiceId: key,
      name: c?.name ?? "",
      color: c?.color ?? null,
      rows: buckets.get(key) ?? [],
    };
  });

  return { columns, groupByPropertyId: property.id };
}

export function useKanbanGroups(
  rows: IBaseRow[],
  property: IBaseProperty | undefined,
  hiddenChoiceIds: string[] | undefined,
  choiceOrderOverride: string[] | undefined,
): PartitionResult {
  return useMemo(
    () =>
      partitionRowsByGroup(
        rows,
        property,
        hiddenChoiceIds,
        choiceOrderOverride,
      ),
    [rows, property, hiddenChoiceIds, choiceOrderOverride],
  );
}
