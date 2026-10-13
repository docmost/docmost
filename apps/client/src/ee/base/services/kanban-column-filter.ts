import { NO_VALUE_CHOICE_ID, FilterGroup, FilterNode } from "@/ee/base/types/base.types";
import { normalizeFilter } from "@/ee/base/queries/base-row-query";

export function buildColumnFilter(
  viewFilter: FilterGroup | undefined,
  groupByPropertyId: string,
  columnKey: string,
): FilterNode | undefined {
  const condition = columnKey === NO_VALUE_CHOICE_ID
    ? { propertyId: groupByPropertyId, op: "isEmpty" as const }
    : { propertyId: groupByPropertyId, op: "eq" as const, value: columnKey };
  const children: FilterGroup["children"] = viewFilter?.children?.length
    ? [viewFilter, condition]
    : [condition];
  return normalizeFilter({ op: "and", children });
}
