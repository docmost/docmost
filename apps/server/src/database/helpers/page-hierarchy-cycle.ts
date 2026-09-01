export type CycleTrackedRow = {
  isCycle: boolean;
};

export class PageHierarchyCycleError extends Error {
  readonly code = 'PAGE_HIERARCHY_CYCLE';

  constructor(readonly rootPageId: string) {
    super('Cyclic page hierarchy detected');
    this.name = 'PageHierarchyCycleError';
  }
}

export function assertAcyclicPageTraversal<T extends CycleTrackedRow>(
  rows: readonly T[],
  rootPageId: string,
): void {
  if (rows.some((row) => row.isCycle)) {
    throw new PageHierarchyCycleError(rootPageId);
  }
}

export function stripPageTraversalMetadata<T extends CycleTrackedRow>(
  row: T,
): Omit<T, 'isCycle'> {
  const { isCycle: _isCycle, ...publicRow } = row;
  return publicRow;
}
