import { useMemo } from "react";
import { IBase, IBaseView, KanbanColumn, NO_VALUE_CHOICE_ID, SelectTypeOptions } from "@/ee/base/types/base.types";

export type KanbanGroup = KanbanColumn & { hidden: boolean };

export function useKanbanColumns(
  base: IBase | undefined,
  view: IBaseView | undefined,
): {
  groupByPropertyId: string | undefined;
  columns: KanbanColumn[];
  allGroups: KanbanGroup[];
  hasValidGroupBy: boolean;
} {
  return useMemo(() => {
    const groupByPropertyId = view?.config?.groupByPropertyId;
    const prop = groupByPropertyId ? base?.properties.find((p) => p.id === groupByPropertyId) : undefined;
    const groupable = prop && (prop.type === "select" || prop.type === "status");

    if (!groupable || !prop || !view) {
      return { groupByPropertyId, columns: [], allGroups: [], hasValidGroupBy: false };
    }

    const typeOptions = prop.typeOptions as SelectTypeOptions;
    const choices = typeOptions?.choices ?? [];
    const choiceMap = new Map(choices.map((c) => [c.id, c]));
    const validKeys = new Set([NO_VALUE_CHOICE_ID, ...choices.map((c) => c.id)]);

    const config = view.config;
    const configChoiceOrder: string[] = config.choiceOrder?.length
      ? config.choiceOrder.filter((k) => validKeys.has(k))
      : [...(typeOptions?.choiceOrder ?? choices.map((c) => c.id)), NO_VALUE_CHOICE_ID];

    const inOrder = new Set(configChoiceOrder);
    const baseOrder = [
      ...configChoiceOrder,
      ...choices.map((c) => c.id).filter((id) => !inOrder.has(id)),
    ];

    const hidden = new Set(config.hiddenChoiceIds ?? []);
    const allGroups: KanbanGroup[] = baseOrder.map((k) => {
      if (k === NO_VALUE_CHOICE_ID) {
        return { key: k, name: "No value", color: undefined, isNoValue: true, hidden: hidden.has(k) };
      }
      const choice = choiceMap.get(k);
      return { key: k, name: choice?.name ?? k, color: choice?.color, isNoValue: false, hidden: hidden.has(k) };
    });
    const columns: KanbanColumn[] = allGroups.filter((g) => !g.hidden);

    return { groupByPropertyId, columns, allGroups, hasValidGroupBy: true };
  }, [base, view]);
}
