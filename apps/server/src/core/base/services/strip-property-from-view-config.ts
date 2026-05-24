import { ViewConfig } from '../base.schemas';

type FilterCondition = {
  propertyId: string;
  op: string;
  value?: unknown;
};
type FilterGroup = {
  op: 'and' | 'or';
  children: Array<FilterCondition | FilterGroup>;
};
type FilterNode = FilterCondition | FilterGroup;

function isGroup(node: FilterNode): node is FilterGroup {
  return 'children' in node;
}

function pruneFilter(
  node: FilterNode,
  propertyId: string,
): FilterNode | null {
  if (isGroup(node)) {
    const kept = node.children
      .map((c) => pruneFilter(c, propertyId))
      .filter((c): c is FilterNode => c !== null);
    return kept.length === 0 ? null : { op: node.op, children: kept };
  }
  return node.propertyId === propertyId ? null : node;
}

export function stripPropertyFromViewConfig(
  config: ViewConfig | undefined | null,
  propertyId: string,
): ViewConfig {
  if (!config) return {};
  const next: Record<string, unknown> = { ...config };

  if (config.sorts) {
    const sorts = config.sorts.filter((s) => s.propertyId !== propertyId);
    if (sorts.length > 0) next.sorts = sorts;
    else delete next.sorts;
  }

  if (config.filter) {
    const pruned = pruneFilter(config.filter, propertyId);
    if (pruned) next.filter = pruned;
    else delete next.filter;
  }

  if (config.groupByPropertyId === propertyId) {
    delete next.groupByPropertyId;
    delete next.hiddenChoiceIds;
    delete next.choiceOrder;
  }

  if (config.visiblePropertyIds) {
    const kept = config.visiblePropertyIds.filter((id) => id !== propertyId);
    if (kept.length > 0) next.visiblePropertyIds = kept;
    else delete next.visiblePropertyIds;
  }

  if (config.hiddenPropertyIds) {
    const kept = config.hiddenPropertyIds.filter((id) => id !== propertyId);
    if (kept.length > 0) next.hiddenPropertyIds = kept;
    else delete next.hiddenPropertyIds;
  }

  if (config.propertyOrder) {
    const kept = config.propertyOrder.filter((id) => id !== propertyId);
    if (kept.length > 0) next.propertyOrder = kept;
    else delete next.propertyOrder;
  }

  if (config.propertyWidths && propertyId in config.propertyWidths) {
    const { [propertyId]: _removed, ...rest } = config.propertyWidths;
    if (Object.keys(rest).length > 0) next.propertyWidths = rest;
    else delete next.propertyWidths;
  }

  return next as ViewConfig;
}
